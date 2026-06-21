#Requires -Version 5.1
<#
.SYNOPSIS
  SD ブートストラップ用の詳細デバッグバンドルを収集する。

.DESCRIPTION
  read-artifacts の拡張版。tools_configs 内 wpa 抽出、ログ grep、hack.ini 解析、
  tailnet スナップショット、debug-report.md を sim-results/sd-bootstrap/logs/ に出力。

.PARAMETER WaitSec
  SD 未挿入時の待機秒数。

.PARAMETER TailLines
  各ログの tail 行数（既定 80）。
#>
[CmdletBinding()]
param(
    [int] $WaitSec = 0,
    [int] $TailLines = 80
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
    Write-SdLogEvent 'debug_collect' 'fail' 'SD not found'
    Write-SdNdjsonLog $cfg 'sd_debug_collect' 20
    exit 20
}

$outDir = Join-Path $cfg.logDir ("debug-bundle-$(Get-Date -Format 'yyyyMMdd_HHmmss')")
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $outDir 'highlights') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $outDir 'tails') -Force | Out-Null

# --- SD ファイル収集 ---
$topArtifacts = @(
    'atomhack.log', 'tools.log', 'update.log', 'healthcheck.log',
    'hack.ini', 'hostname', 'authorized_keys',
    'factory_t31_ZMC6tiIDQN', 'rootfs_hack.squashfs',
    'tools_configs', 'configs'
)
$fileReport = Copy-SdArtifacts -RootPath $sd.RootPath -OutDir $outDir -Names $topArtifacts

# tmp/ update/ 内のログ（サイズ上限付き）
$extraCopied = Copy-SdTreeLogs -RootPath $sd.RootPath -OutDir $outDir -MaxFileBytes 2MB -MaxTotalBytes 20MB
$fileReport += $extraCopied

Get-ChildItem $sd.RootPath -Force | Select-Object Name, Length, LastWriteTime |
    Export-Csv (Join-Path $outDir 'root_listing.csv') -NoTypeInformation

# --- tools_configs / wpa 解析 ---
$wpaDiag = $null
$tcPath = Join-Path $outDir 'tools_configs'
if (Test-Path $tcPath) {
    $wpaDiag = Invoke-ToolsConfigsWpaExtract -ImagePath $tcPath -OutDir $outDir -SshHost $cfg.zipSourceHost
    if ($wpaDiag) {
        Write-SdLogEvent 'wpa_extract' 'ok' "ssid=$($wpaDiag.ssid) cr=$($wpaDiag.ssid_diag.has_cr)"
    } else {
        Write-SdLogEvent 'wpa_extract' 'fail' 'ssh/debugfs extract failed'
    }
}

# --- hack.ini 解析 ---
$hackDiag = $null
$hackPath = Join-Path $outDir 'hack.ini'
if (Test-Path $hackPath) {
    $hackDiag = Analyze-HackIni -Path $hackPath
    (Get-Content $hackPath | ForEach-Object { Redact-Secrets $_ }) |
        Set-Content (Join-Path $outDir 'hack.ini.redacted') -Encoding utf8
}

# --- ログ grep / tail ---
$grepPatterns = @(
    'Network error', 'Network restart', 'tailscale', 'TAILSCALE', 'wpa', 'wlan',
    'udhcpc', 'Reboot', 'error', 'fail', 'iCamera', 'lighttpd', 'AUTH_KEY'
)
$allLogLines = @()
$highlights = @{}
$tails = @{}

Get-ChildItem $outDir -File | Where-Object {
    $_.Extension -in '.log', '.txt', '.ini' -or $_.Name -match '\.log$'
} | ForEach-Object {
    $lines = @(Get-Content $_.FullName -ErrorAction SilentlyContinue)
    if ($lines.Count -eq 0) { return }
    $allLogLines += $lines
    $tails[$_.Name] = @($lines | Select-Object -Last $TailLines)
    $tails[$_.Name] | Set-Content (Join-Path $outDir "tails\$($_.Name)") -Encoding utf8
    $hits = @($lines | Select-String -Pattern ($grepPatterns -join '|') -CaseSensitive:$false)
    if ($hits.Count -gt 0) {
        $highlights[$_.Name] = @($hits | ForEach-Object { $_.Line } | Select-Object -First 200)
        $highlights[$_.Name] | Set-Content (Join-Path $outDir "highlights\$($_.Name)") -Encoding utf8
    }
}

$hints = Diagnose-BootLog $allLogLines
if ($wpaDiag) {
    if ($wpaDiag.ssid_diag.has_cr -or $wpaDiag.psk_diag.has_cr) {
        $hints += 'wpa_config_has_crlf'
    }
    if (-not $wpaDiag.has_network_block) {
        $hints += 'wpa_network_block_missing'
    }
}
if ($hackDiag) {
    if ($hackDiag.duplicate_keys.Count -gt 0) {
        $hints += 'hack_ini_duplicate_keys'
    }
    if ($hackDiag.effective.MONITORING_NETWORK -ne 'off') {
        $hints += 'monitoring_network_not_off_at_runtime'
    }
}
if (Test-Path $hackPath) {
    $authLine = Get-Content $hackPath | Where-Object { $_ -match '^TAILSCALE_AUTH_KEY=' } | Select-Object -First 1
    if ($authLine -match '^TAILSCALE_AUTH_KEY=tskey-client-') {
        $hints += 'auth_key_is_client_type_may_be_expired'
    }
}

$tailnet = Get-TailnetSnapshot -Cfg $cfg

$report = [ordered]@{
    collected_at   = (Get-Date).ToString('o')
    sd_root        = $sd.RootPath
    artifacts_dir  = $outDir
    files          = $fileReport
    tailnet        = $tailnet
    wpa            = $wpaDiag
    hack_ini       = $hackDiag
    hints          = @($hints | Select-Object -Unique)
    highlights     = $highlights
    log_tail_files = (Join-Path $outDir 'tails')
}
$report | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $outDir 'debug-report.json') -Encoding utf8

Write-DebugReportMarkdown -Report $report -OutPath (Join-Path $outDir 'debug-report.md')

Write-SdLogEvent 'debug_collect' 'ok' "dir=$outDir hints=$($hints -join ',')"
Write-Host ""
Write-Host "=== debug bundle ===" -ForegroundColor Cyan
Write-Host $outDir
Write-Host (Join-Path $outDir 'debug-report.md')
Write-SdNdjsonLog $cfg 'sd_debug_collect' 0 @{
    artifacts = $outDir
    hints     = ($hints -join ',')
    report    = (Join-Path $outDir 'debug-report.json')
}
exit 0
