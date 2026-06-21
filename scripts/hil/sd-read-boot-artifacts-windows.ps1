#Requires -Version 5.1
# ブートストラップ未完了時のみ: SD から起動ログを収集（真 HIL では SSH ログを使う）。
[CmdletBinding()]
param(
    [int] $WaitSec = 0
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\sd-common.ps1"
Initialize-SdLog

$cfg = Load-SdConfig
if ($WaitSec -le 0) { $WaitSec = $cfg.sdWaitSec }

$sd = Resolve-SdCard $cfg
if (-not $sd) {
    Write-SdLogEvent 'wait_sd' 'start' "polling ${WaitSec}s"
    $deadline = (Get-Date).AddSeconds($WaitSec)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 5
        $sd = Resolve-SdCard $cfg
        if ($sd) { break }
    }
}

if (-not $sd) {
    Write-SdLogEvent 'read_artifacts' 'fail' 'SD not found'
    Write-SdNdjsonLog $cfg 'sd_read_boot_artifacts' 20
    exit 20
}

$outDir = Join-Path $cfg.logDir ("boot-artifacts-$(Get-Date -Format 'yyyyMMdd_HHmmss')")
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$artifactNames = @(
    'atomhack.log', 'tools.log', 'update.log', 'hack.ini', 'hostname',
    'factory_t31_ZMC6tiIDQN', 'rootfs_hack.squashfs', 'authorized_keys', 'healthcheck.log'
)

$fileReport = @()
foreach ($name in $artifactNames) {
    $src = Join-Path $sd.RootPath $name
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $outDir $name) -Force
        $fileReport += "${name}=$((Get-Item $src).Length)"
    } else {
        $fileReport += "${name}=missing"
    }
}

Get-ChildItem $sd.RootPath -Force | Select-Object Name, Length, LastWriteTime |
    Export-Csv (Join-Path $outDir 'root_listing.csv') -NoTypeInformation

$logLines = @()
if (Test-Path (Join-Path $outDir 'atomhack.log')) {
    $logLines = Get-Content (Join-Path $outDir 'atomhack.log') -ErrorAction SilentlyContinue
}
if (Test-Path (Join-Path $outDir 'healthcheck.log')) {
    $logLines += Get-Content (Join-Path $outDir 'healthcheck.log') -ErrorAction SilentlyContinue
}

$hints = Diagnose-BootLog $logLines
if (Test-Path (Join-Path $outDir 'hack.ini')) {
    $authLine = Get-Content (Join-Path $outDir 'hack.ini') | Where-Object { $_ -match '^TAILSCALE_AUTH_KEY=' } | Select-Object -First 1
    if ($authLine -match '^TAILSCALE_AUTH_KEY=tskey-client-') {
        $hints += 'auth_key_is_client_type_may_be_expired'
    }
    Get-Content (Join-Path $outDir 'hack.ini') | ForEach-Object { Redact-Secrets $_ } |
        Set-Content (Join-Path $outDir 'hack.ini.redacted')
}

$diag = [ordered]@{
    artifacts_dir = $outDir
    files           = $fileReport
    hints           = $hints
    log_tail        = @($logLines | Select-Object -Last 30)
}
$diag | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $outDir 'diagnosis.json') -Encoding utf8

Write-SdLogEvent 'read_artifacts' 'ok' "dir=$outDir"
Write-SdNdjsonLog $cfg 'sd_read_boot_artifacts' 0 @{ artifacts = $outDir; hints = ($hints -join ',') }
exit 0
