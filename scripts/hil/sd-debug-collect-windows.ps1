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
    'hack.ini', 'hostname', 'authorized_keys', 'wpa_supplicant.conf',
    'atom-debug', 'atom-log', 'crontab', 'tailscale_wrapper.sh', 'wifi_audit.sh',
    'wifi_audit.log',
    'factory_t31_ZMC6tiIDQN', 'rootfs_hack.squashfs',
    'tools_configs', 'configs'
)
$fileReport = Copy-SdArtifacts -RootPath $sd.RootPath -OutDir $outDir -Names $topArtifacts

# tmp/ update/ 内のログ（サイズ上限付き）
$extraCopied = Copy-SdTreeLogs -RootPath $sd.RootPath -OutDir $outDir -MaxFileBytes 2MB -MaxTotalBytes 20MB
$fileReport += $extraCopied

Get-ChildItem $sd.RootPath -Force | Select-Object Name, Length, LastWriteTime |
    Export-Csv (Join-Path $outDir 'root_listing.csv') -NoTypeInformation

# --- FAT 直下 wpa（network_init 最優先パス）---
$fatWpaPath = Join-Path $sd.RootPath 'wpa_supplicant.conf'
$fatWpaDiag = $null
if (Test-Path $fatWpaPath) {
    $fatWpaText = Get-Content $fatWpaPath -Raw -ErrorAction SilentlyContinue
    if ($fatWpaText) {
        $fatWpaDiag = @{
            size_bytes = (Get-Item $fatWpaPath).Length
            has_network_block = $fatWpaText -match 'network=\{'
            ssid = if ($fatWpaText -match 'ssid="([^"]+)"') { $Matches[1] } else { $null }
        }
    }
}

# --- tools_configs / wpa 解析 ---
$wpaDiag = $null
$tcPath = Join-Path $outDir 'tools_configs'
if (Test-Path $tcPath) {
    $wpaDiag = Invoke-ToolsConfigsWpaExtract -ImagePath $tcPath -OutDir $outDir -SshHost $cfg.zipSourceHost
    if ($wpaDiag) {
        Write-SdLogEvent 'wpa_extract' 'ok' "ssid=$($wpaDiag.ssid) cr=$($wpaDiag.ssid_diag.has_cr)"
        Write-AgentDebugLog -Location 'sd-debug-collect:wpa' -Message 'wpa_diag' -HypothesisId 'A,D' -RunId 'debug-collect' -Data @{
            ssid       = $wpaDiag.ssid
            ssid_cr    = $wpaDiag.ssid_diag.has_cr
            psk_cr     = $wpaDiag.psk_diag.has_cr
            has_network = $wpaDiag.has_network_block
            size       = (Get-Item $tcPath).Length
        }
    } else {
        Write-SdLogEvent 'wpa_extract' 'fail' 'ssh/debugfs extract failed'
    }
}

# --- configs ext2 NET 整合性 ---
$configsDiag = $null
$configsPath = Join-Path $sd.RootPath 'configs'
if (Test-Path $configsPath) {
    $configsDiag = Invoke-ConfigsPartitionExtract -ImagePath $configsPath -SshHost $cfg.zipSourceHost
}

$consistency = Get-SdWifiConsistency -RootPath $sd.RootPath -Cfg $cfg -WpaToolsDiag $wpaDiag -ConfigsDiag $configsDiag
$consistency | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $outDir 'wifi_consistency.json') -Encoding utf8
Write-AgentDebugLog -Location 'sd-debug-collect:consistency' -Message 'wifi_consistency' -HypothesisId 'S' -RunId 'pre-boot' -Data @{
    aligned    = $consistency.aligned
    ssids      = @($consistency.unique_ssids)
    mismatches = @($consistency.mismatches)
    model      = if ($configsDiag) { $configsDiag.product_model } else { $null }
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
    'udhcpc', 'Reboot', 'error', 'fail', 'iCamera', 'lighttpd', 'AUTH_KEY',
    'ESSID:', 'TARGET_SSID', 'iwlist', 'wpa_state', 'COMPLETED', 'inet addr'
)
$allLogLines = @()
$highlights = @{}
$tails = @{}

Get-ChildItem $outDir -File | Where-Object {
    $_.Extension -in '.log', '.txt' -or $_.Name -match '\.log$'
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
$hasLibcallbackErr = @($allLogLines | Where-Object { $_ -match 'libcallback error' }).Count -gt 0
$hasTailscaleLog = @($allLogLines | Where-Object { $_ -match 'tailscale|TAILSCALE|tailscaled' }).Count -gt 0
$hasWlanIfconfig = @($allLogLines | Where-Object { $_ -match 'wlan0' }).Count -gt 0
Write-AgentDebugLog -Location 'sd-debug-collect:logs' -Message 'sd_log_hints' -HypothesisId 'K,L,M' -RunId 'debug-collect' -Data @{
    hints           = @($hints | Select-Object -Unique)
    health_lines    = @($allLogLines | Where-Object { $_ -match 'Network|health|wpa|tailscale|Reboot|libcallback|wlan0' } | Select-Object -Last 15)
    has_tailscale   = $hasTailscaleLog
    has_libcallback_err = $hasLibcallbackErr
    has_wlan_ifconfig = $hasWlanIfconfig
    atom_debug      = Test-Path (Join-Path $sd.RootPath 'atom-debug')
    atom_log        = Test-Path (Join-Path $sd.RootPath 'atom-log')
    fat_wpa         = $fatWpaDiag
    network_errors  = @($allLogLines | Where-Object { $_ -match 'Network error' }).Count
    reboot_count    = @($allLogLines | Where-Object { $_ -match 'Reboot' }).Count
}
if ($hasLibcallbackErr) { $hints += 'libcallback_reboot_loop' }
if (-not $hasTailscaleLog) { $hints += 'no_tailscale_in_logs' }
if ($fatWpaDiag -and -not $fatWpaDiag.has_network_block) { $hints += 'fat_wpa_missing_network_block' }
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
$crontabOnSd = Join-Path $sd.RootPath 'crontab'
if (Test-Path $crontabOnSd) {
    $crBytes = [System.IO.File]::ReadAllBytes($crontabOnSd)
    $hasCr = ($crBytes -contains 13)
    Write-AgentDebugLog -Location 'sd-debug-collect:crontab' -Message 'crontab_crlf_check' -HypothesisId 'P' -RunId 'debug-collect' -Data @{
        size = $crBytes.Length; has_cr = $hasCr
    }
    if ($hasCr) { $hints += 'crontab_has_crlf' }
    $hasNetworkInitRestart = @(Get-Content $crontabOnSd -ErrorAction SilentlyContinue | Where-Object { $_ -match 'network_init\.sh restart' }).Count -gt 0
    Write-AgentDebugLog -Location 'sd-debug-collect:crontab' -Message 'crontab_network_init' -HypothesisId 'U' -RunId 'debug-collect' -Data @{
        has_network_init_restart = $hasNetworkInitRestart
        lines = @(Get-Content $crontabOnSd -ErrorAction SilentlyContinue)
    }
    if ($hasNetworkInitRestart) { $hints += 'network_init_restart_in_cron' }
}

if ($consistency -and -not $consistency.aligned) { $hints += 'wifi_config_mismatch' }

$wifiBeaconLines = @()
$wifiAuditPath = Join-Path $outDir 'wifi_audit.log'
if (Test-Path $wifiAuditPath) {
    $wifiBeaconLines = @(Get-Content $wifiAuditPath -ErrorAction SilentlyContinue)
}
$wifiBeacons = if ($wifiBeaconLines.Count -gt 0) { Parse-WifiAuditBeacons $wifiBeaconLines } else { $null }
if ($wifiBeacons) {
    Write-AgentDebugLog -Location 'sd-debug-collect:beacons' -Message 'wifi_beacons' -HypothesisId 'L,S' -RunId 'debug-collect' -Data $wifiBeacons
    if ($wifiBeacons.target_missing) { $hints += 'target_ssid_beacon_not_seen' }
    if ($wifiBeacons.target_fuk_nomap) { $hints += 'target_ssid_beacon_seen' }
}

$tailnet = Get-TailnetSnapshot -Cfg $cfg

$report = [ordered]@{
    collected_at   = (Get-Date).ToString('o')
    sd_root        = $sd.RootPath
    artifacts_dir  = $outDir
    files          = $fileReport
    tailnet        = $tailnet
    wpa            = $wpaDiag
    fat_wpa        = $fatWpaDiag
    consistency    = $consistency
    wifi_beacons   = $wifiBeacons
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
