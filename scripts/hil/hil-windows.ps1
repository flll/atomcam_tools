#Requires -Version 5.1
<#
.SYNOPSIS
  AtomCam HIL Windows 統一エントリポイント（atomcam_tools 正本）。

.DESCRIPTION
  ATOMCAM_TOOLS_ROOT が未設定ならリポジトリルート（scripts/hil の親の親）を使用する。
#>
param(
    [Parameter(Position = 0)]
    [ValidateSet('install', 'install-bootstrap', 'verify', 'boot-wait', 'read-artifacts', 'debug-collect', 'boot-loop')]
    [string] $Action = 'install',
    [switch] $RefreshZip,
    [switch] $DebugBoot
)

$ErrorActionPreference = 'Stop'

if ($env:ATOMCAM_TOOLS_ROOT) {
    $repoRoot = (Resolve-Path $env:ATOMCAM_TOOLS_ROOT).Path
} else {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
}
$env:ATOMCAM_TOOLS_ROOT = $repoRoot
$hil = Join-Path $repoRoot 'scripts/hil'

switch ($Action) {
    'install' {
        $args = @('-NoProfile', '-File', (Join-Path $hil 'sd-install-windows.ps1'), '-FilesOnly')
        if ($RefreshZip) { $args += '-RefreshZip' }
        if ($DebugBoot) { $args += '-DebugBoot' }
        & pwsh @args
    }
    'install-bootstrap' {
        $args = @('-NoProfile', '-File', (Join-Path $hil 'sd-install-windows.ps1'), '-Bootstrap')
        if ($RefreshZip) { $args += '-RefreshZip' }
        if ($DebugBoot) { $args += '-DebugBoot' }
        & pwsh @args
    }
    'verify' {
        & pwsh -NoProfile -File (Join-Path $hil 'sd-install-windows.ps1') -VerifyOnly
    }
    'boot-wait' {
        & pwsh -NoProfile -File (Join-Path $hil 'boot-wait-windows.ps1')
    }
    'read-artifacts' {
        & pwsh -NoProfile -File (Join-Path $hil 'sd-debug-collect-windows.ps1')
    }
    'debug-collect' {
        & pwsh -NoProfile -File (Join-Path $hil 'sd-debug-collect-windows.ps1')
    }
    'boot-loop' {
        $args = @('-NoProfile', '-File', (Join-Path $hil 'sd-boot-loop-windows.ps1'))
        if ($RefreshZip) { $args += '-RefreshZip' }
        & pwsh @args
    }
}
exit $LASTEXITCODE
