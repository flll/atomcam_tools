#Requires -Version 5.1
<#
.SYNOPSIS
  ブートストラップ例外パス: 起動待ち → SD ログ → FilesOnly 再投入。

  真 HIL（SSH 到達後）は scripts/hil/true-hil.sh / make deploy-test を使う。
#>
[CmdletBinding()]
param(
    [int] $MaxIterations = 3,
    [switch] $WaitOnly,
    [switch] $RefreshZip,
    [switch] $Bootstrap
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\sd-common.ps1"
Initialize-SdLog

$cfg = Load-SdConfig
$installScript = Join-Path $PSScriptRoot 'sd-install-windows.ps1'
$bootWaitScript = Join-Path $PSScriptRoot 'boot-wait-windows.ps1'
$readScript = Join-Path $PSScriptRoot 'sd-read-boot-artifacts-windows.ps1'

for ($i = 1; $i -le $MaxIterations; $i++) {
    Write-SdLogEvent 'iteration' 'start' "$i/$MaxIterations"

    if (-not $WaitOnly) {
        $sd = Resolve-SdCard $cfg
        if ($sd) {
            $installArgs = @('-NoProfile', '-File', $installScript)
            if ($RefreshZip) { $installArgs += '-RefreshZip' }
            if ($Bootstrap -and $i -eq 1) { $installArgs += '-Bootstrap' }
            else { $installArgs += '-FilesOnly' }
            & pwsh @installArgs
            $installExit = $LASTEXITCODE
            Write-SdLogEvent 'install' $(if ($installExit -eq 0) { 'ok' } else { 'fail' }) "exit=$installExit"
            if ($installExit -ne 0) { continue }
            Write-Host '>>> SD を AtomCam に挿入して電源 ON' -ForegroundColor Cyan
        }
    }

    & pwsh -NoProfile -File $bootWaitScript
    if ($LASTEXITCODE -eq 0) {
        Write-SdNdjsonLog $cfg 'sd_boot_loop' 0 @{ iteration = $i }
        exit 0
    }

    & pwsh -NoProfile -File $readScript -WaitSec $cfg.sdWaitSec
    if ($i -ge $MaxIterations) { break }
}

Write-SdNdjsonLog $cfg 'sd_boot_loop' 10 @{ iterations = $MaxIterations }
exit 10
