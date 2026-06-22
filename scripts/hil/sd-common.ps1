# Shared helpers for AtomCam SD install / boot probe scripts (atomcam_tools 正本).
Set-StrictMode -Version Latest

function Write-AgentDebugLog {
    param(
        [string] $Location,
        [string] $Message,
        [string] $HypothesisId,
        [object] $Data = @{},
        [string] $RunId = 'boot-wait'
    )
    #region agent log
    $logPaths = @(
        'C:\Users\no5\.cursor\projects\empty-window\debug-6ef2a6.log',
        (Join-Path (Get-RepoRoot) 'debug-6ef2a6.log')
    )
    $payload = [ordered]@{
        sessionId    = '6ef2a6'
        runId        = $RunId
        hypothesisId = $HypothesisId
        location     = $Location
        message      = $Message
        data         = $Data
        timestamp    = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    }
    $line = ($payload | ConvertTo-Json -Compress -Depth 6)
    foreach ($lp in $logPaths) {
        try {
            $dir = Split-Path $lp -Parent
            if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
            Add-Content -Path $lp -Value $line -Encoding utf8
        } catch { }
    }
    try {
        Invoke-RestMethod -Uri 'http://127.0.0.1:7361/ingest/52aec31a-90d8-4407-b808-d3c6cbd14b78' `
            -Method Post -ContentType 'application/json' `
            -Headers @{ 'X-Debug-Session-Id' = '6ef2a6' } `
            -Body $line -TimeoutSec 2 | Out-Null
    } catch { }
    #endregion
}

function Get-TailnetPeerSummary {
    $raw = tailscale status --json 2>$null
    if (-not $raw) { return @{ peer_count = 0; camera_peers = @() } }
    $json = $raw | ConvertFrom-Json
    $cam = @()
    if ($json.Peer) {
        foreach ($prop in $json.Peer.PSObject.Properties) {
            $p = $prop.Value
            $dns = ($p.DNSName -replace '\.$', '')
            if ($dns -match 'atom|cam|test' -or $p.HostName -match 'atom|cam|test') {
                $cam += [ordered]@{ host = $p.HostName; dns = $dns; online = $p.Online }
            }
        }
    }
    return [ordered]@{
        peer_count   = if ($json.Peer) { @($json.Peer.PSObject.Properties).Count } else { 0 }
        camera_peers = $cam
        self_online  = $json.Self.Online
    }
}

function Expand-EnvPath([string] $Path) {
    if ($Path -match '%') {
        $Path = [Environment]::ExpandEnvironmentVariables($Path)
    }
    if ($Path -match '^~') {
        $Path = $Path -replace '^~', $env:USERPROFILE
    }
    return $Path
}

function Get-RepoRoot {
    if ($env:ATOMCAM_TOOLS_ROOT) {
        return (Resolve-Path $env:ATOMCAM_TOOLS_ROOT).Path
    }
    return (Resolve-Path (Join-Path $PSScriptRoot '..', '..')).Path
}

function Load-SdConfig {
    $repo = Get-RepoRoot
    $configPath = Join-Path $repo 'config\sd-install.json'
    if (-not (Test-Path $configPath)) {
        throw "Config not found: $configPath (set ATOMCAM_TOOLS_ROOT)"
    }
    $cfg = Get-Content $configPath -Raw | ConvertFrom-Json
    $cfg | Add-Member -NotePropertyName repoRoot -NotePropertyValue $repo -Force
    $cfg | Add-Member -NotePropertyName zipCache -NotePropertyValue (Join-Path $repo ($cfg.zipCacheRelative -replace '/', '\')) -Force
    $cfg | Add-Member -NotePropertyName stagingDir -NotePropertyValue (Join-Path $repo ($cfg.stagingDirRelative -replace '/', '\')) -Force
    $cfg | Add-Member -NotePropertyName logDir -NotePropertyValue (Join-Path $repo ($cfg.logDirRelative -replace '/', '\')) -Force
    if ($cfg.preserveDirRelative) {
        $cfg | Add-Member -NotePropertyName preserveDir -NotePropertyValue (Join-Path $repo ($cfg.preserveDirRelative -replace '/', '\')) -Force
    } else {
        $cfg | Add-Member -NotePropertyName preserveDir -NotePropertyValue (Join-Path (Split-Path $cfg.zipCache -Parent) 'preserve') -Force
    }
    $cfg | Add-Member -NotePropertyName tailscaleEnv -NotePropertyValue (Expand-EnvPath $cfg.tailscaleEnv) -Force
    if ($cfg.wifiEnv) {
        $cfg | Add-Member -NotePropertyName wifiEnv -NotePropertyValue (Expand-EnvPath $cfg.wifiEnv) -Force
    }
    if (-not $cfg.bootWaitSec) { $cfg | Add-Member -NotePropertyName bootWaitSec -NotePropertyValue 300 -Force }
    if (-not $cfg.sdWaitSec) { $cfg | Add-Member -NotePropertyName sdWaitSec -NotePropertyValue 600 -Force }
    if (-not $cfg.bootPollSec) { $cfg | Add-Member -NotePropertyName bootPollSec -NotePropertyValue 15 -Force }
    if ($cfg.hackIniBootstrapFile) {
        $cfg | Add-Member -NotePropertyName hackIniBootstrapPath -NotePropertyValue (Join-Path $repo ($cfg.hackIniBootstrapFile -replace '/', '\')) -Force
    }
    return $cfg
}

function Initialize-SdLog {
    $script:LogEvents = @()
}

function Write-SdLogEvent([string] $Step, [string] $Result, [string] $Detail = '') {
    $evt = [ordered]@{
        ts     = (Get-Date).ToString('o')
        step   = $Step
        result = $Result
        detail = $Detail
    }
    $script:LogEvents += $evt
    $color = switch ($Result) {
        'ok' { 'Green' }
        'fail' { 'Red' }
        'skip' { 'Yellow' }
        default { 'Gray' }
    }
    Write-Host "[$Step] $Result" -ForegroundColor $color
    if ($Detail) { Write-Host "  $Detail" }
}

function Get-ExpectedHostnames([object] $Cfg) {
    $names = @()
    if ($Cfg.expectedHostnames) {
        $names += @($Cfg.expectedHostnames)
    }
    if (Test-Path $Cfg.tailscaleEnv) {
        $hn = Get-Content $Cfg.tailscaleEnv | Where-Object { $_ -match '^TAILSCALE_HOSTNAME=' }
        if ($hn) {
            $val = ($hn -replace '^TAILSCALE_HOSTNAME=', '').Trim()
            if ($val) { $names += $val }
        }
    }
    $names += 'atomcam33'
    return @($names | Select-Object -Unique)
}

function Resolve-SdCard([object] $Cfg) {
    $part = Get-Partition | Where-Object {
        $_.UniqueId -like "*$($Cfg.partitionUniqueIdContains)*"
    } | Select-Object -First 1

    if (-not $part) {
        return $null
    }

    $disk = Get-Disk -Number $part.DiskNumber -ErrorAction SilentlyContinue
    if (-not $disk -or $disk.Size -ne $Cfg.expectedDiskSizeBytes) {
        return $null
    }

    $vol = Get-Volume | Where-Object {
        $_.FileSystemLabel -eq 'ATOMCAM' -or $_.UniqueId -like "*$($Cfg.volumeGuid)*"
    } | Select-Object -First 1
    if (-not $vol) {
        return $null
    }

    $drivePath = $part.AccessPaths | Where-Object { $_ -match '^[A-Z]:\\$' } | Select-Object -First 1
    if (-not $drivePath) {
        return $null
    }

    Write-SdLogEvent 'resolve_sd' 'ok' "disk=$($part.DiskNumber) path=$drivePath"
    return [pscustomobject]@{
        Volume    = $vol
        Partition = $part
        Disk      = $disk
        RootPath  = $drivePath
    }
}

function Write-SdNdjsonLog([object] $Cfg, [string] $Tool, [int] $ExitCode, [hashtable] $Extra = @{}) {
    if (-not (Test-Path $Cfg.logDir)) { New-Item -ItemType Directory -Path $Cfg.logDir -Force | Out-Null }
    $ts = Get-Date -Format 'yyyyMMdd_HHmmss'
    $logPath = Join-Path $Cfg.logDir "$Tool-$ts.ndjson"

    $summary = [ordered]@{
        tool   = $Tool
        result = if ($ExitCode -eq 0) { 'ok' } else { 'fail' }
        exit   = $ExitCode
        ts     = (Get-Date).ToString('o')
    }
    foreach ($k in $Extra.Keys) { $summary[$k] = $Extra[$k] }

    $lines = @((ConvertTo-Json $summary -Compress))
    foreach ($evt in $script:LogEvents) {
        $lines += (ConvertTo-Json $evt -Compress)
    }
    Set-Content -Path $logPath -Value ($lines -join "`n") -Encoding utf8
    Write-Host "log: $logPath"
    return $logPath
}

function Redact-Secrets([string] $Line) {
    if ($Line -match '^(TAILSCALE_AUTH_KEY|TS_AUTHKEY)=') {
        return ($Line -replace '=.*', '=***')
    }
    return $Line
}

function Diagnose-BootLog([string[]] $LogLines) {
    $hints = @()
    $patterns = @(
        @{ pat = 'Network error'; hint = 'network_healthcheck_fail' }
        @{ pat = 'retry error -> reboot'; hint = 'healthcheck_reboot_loop' }
        @{ pat = 'TAILSCALE_AUTH_KEY is not set'; hint = 'tailscale_auth_key_missing' }
        @{ pat = 'tailscale binary health check failed'; hint = 'tailscale_binary_fail' }
        @{ pat = 'failed to parse kernel version from uname'; hint = 'tailscale_uname_kernel_panic' }
        @{ pat = 'wpa_supplicant_not_running'; hint = 'wpa_supplicant_not_running' }
        @{ pat = 'invalid cipher'; hint = 'wpa_config_cipher_incompatible' }
        @{ pat = 'failed to parse network block'; hint = 'wpa_config_parse_fail' }
        @{ pat = 'iwlist: not found'; hint = 'iwlist_missing_use_wpa_cli' }
        @{ pat = 'network_init.sh restart'; hint = 'network_init_restart_in_cron' }
        @{ pat = 'inet addr:169\.254'; hint = 'wifi_link_local_only' }
        @{ pat = 'Kernel panic'; hint = 'kernel_panic' }
        @{ pat = 'VFS: Cannot open root device'; hint = 'rootfs_mount_fail' }
        @{ pat = 'iCamera'; hint = 'icamera_log_present' }
        @{ pat = 'Error'; hint = 'generic_error_in_log' }
    )
    foreach ($line in $LogLines) {
        foreach ($p in $patterns) {
            if ($line -match $p.pat -and $hints -notcontains $p.hint) {
                $hints += $p.hint
            }
        }
    }
    return $hints
}

function Find-TailnetPeer([string[]] $Hostnames) {
    $raw = tailscale status --json 2>$null
    if (-not $raw) { return $null }
    $json = $raw | ConvertFrom-Json
    if (-not $json.Peer) { return $null }

    foreach ($prop in $json.Peer.PSObject.Properties) {
        $peer = $prop.Value
        $dns = ($peer.DNSName -replace '\.$', '')
        $peerHost = $peer.HostName
        foreach ($want in $Hostnames) {
            if ($dns -eq $want -or $peerHost -eq $want) {
                return [pscustomobject]@{
                    Name         = $want
                    DNS          = $dns
                    Online       = $peer.Online
                    TailscaleIPs = @($peer.TailscaleIPs)
                }
            }
        }
    }
    return $null
}

function Get-TailnetSnapshot([object] $Cfg) {
    $hostnames = Get-ExpectedHostnames $Cfg
    $peer = Find-TailnetPeer $hostnames
    $raw = tailscale status --json 2>$null
    $selfIp = $null
    if ($raw) {
        $j = $raw | ConvertFrom-Json
        if ($j.Self.TailscaleIPs) { $selfIp = $j.Self.TailscaleIPs[0] }
    }
    return [ordered]@{
        expected_hostnames = $hostnames
        peer_found         = if ($peer) { $peer.Name } else { $null }
        peer_online        = if ($peer) { $peer.Online } else { $false }
        peer_ips           = if ($peer) { $peer.TailscaleIPs } else { @() }
        local_tailscale_ip = $selfIp
    }
}

function Copy-SdArtifacts([string] $RootPath, [string] $OutDir, [string[]] $Names) {
    $report = @()
    foreach ($name in $Names) {
        $src = Join-Path $RootPath $name
        if (Test-Path $src) {
            Copy-Item $src (Join-Path $OutDir $name) -Force
            $report += "${name}=$((Get-Item $src).Length)"
        } else {
            $report += "${name}=missing"
        }
    }
    return $report
}

function Copy-SdTreeLogs {
    param(
        [string] $RootPath,
        [string] $OutDir,
        [long] $MaxFileBytes = 2MB,
        [long] $MaxTotalBytes = 20MB
    )
    $report = @()
    $total = 0L
    foreach ($sub in @('tmp', 'update')) {
        $srcDir = Join-Path $RootPath $sub
        if (-not (Test-Path $srcDir)) { continue }
        $dstDir = Join-Path $OutDir $sub
        New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
        Get-ChildItem $srcDir -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
            if ($total -ge $MaxTotalBytes) { return }
            if ($_.Length -gt $MaxFileBytes) {
                $report += "$sub/$($_.Name)=skipped_large($($_.Length))"
                return
            }
            $rel = $_.FullName.Substring($srcDir.Length).TrimStart('\')
            $dest = Join-Path $dstDir $rel
            $parent = Split-Path $dest -Parent
            if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
            Copy-Item $_.FullName $dest -Force
            $total += $_.Length
            $report += "$sub/$rel=$($_.Length)"
        }
    }
    return $report
}

function Write-LfOnlyText([string] $Path, [string[]] $Lines) {
    [System.IO.File]::WriteAllText($Path, (($Lines -join "`n") + "`n"), [System.Text.UTF8Encoding]::new($false))
}

function Get-AtomcamWifiCredentials([object] $Cfg) {
    $wifiEnv = $Cfg.wifiEnv
    if ($wifiEnv -match '%') {
        $wifiEnv = [Environment]::ExpandEnvironmentVariables($wifiEnv)
    }
    if (-not (Test-Path $wifiEnv)) {
        Write-SdLogEvent 'wifi_env' 'fail' "missing $wifiEnv"
        return $null
    }
    $ssid = $null
    $pass = $null
    foreach ($line in Get-Content $wifiEnv -ErrorAction SilentlyContinue) {
        if ($line -match '^WIFI_SSID=(.+)$') { $ssid = $Matches[1].Trim().Trim('"').Replace("`r", '') }
        if ($line -match '^WIFI_PASS=(.+)$') { $pass = $Matches[1].Trim().Trim('"').Replace("`r", '') }
    }
    if (-not $ssid -or -not $pass) {
        Write-SdLogEvent 'wifi_env' 'fail' 'WIFI_SSID or WIFI_PASS empty'
        return $null
    }
    return [ordered]@{ ssid = $ssid; pass = $pass; env_path = $wifiEnv }
}

function Format-AtomcamWpaConf([string] $Ssid, [string] $Pass) {
    return @(
        'ctrl_interface=/var/run/wpa_supplicant'
        'update_config=1'
        ''
        'network={'
        "    ssid=`"$Ssid`""
        '    scan_ssid=1'
        '    key_mgmt=WPA-PSK'
        '    proto=RSN'
        '    pairwise=CCMP'
        '    group=CCMP'
        "    psk=`"$Pass`""
        '}'
    )
}

function Write-CompatibleWpa([object] $Cfg, [object] $Sd) {
    $cred = Get-AtomcamWifiCredentials $Cfg
    if (-not $cred) { return $false }
    $lines = Format-AtomcamWpaConf $cred.ssid $cred.pass
    $fatPath = Join-Path $Sd.RootPath 'wpa_supplicant.conf'
    Write-LfOnlyText $fatPath $lines
    $stagePath = Join-Path $Cfg.stagingDir 'wpa_supplicant.conf'
    if (Test-Path (Split-Path $stagePath -Parent)) {
        Write-LfOnlyText $stagePath $lines
    }
    Write-SdLogEvent 'write_wpa' 'ok' "ssid=$($cred.ssid) cipher=CCMP"
    Write-AgentDebugLog -Location 'sd-install:write_wpa' -Message 'compatible_wpa_written' -HypothesisId 'W' -RunId 'install' -Data @{
        ssid = $cred.ssid; fat_path = $fatPath; size = (Get-Item $fatPath).Length; group = 'CCMP'
    }
    return $true
}

function Invoke-PatchToolsConfigsWpa {
    param(
        [string] $ImagePath,
        [string] $WpaPath,
        [string] $SshHost = 'lll-legacy'
    )
    if (-not (Test-Path $ImagePath) -or -not (Test-Path $WpaPath)) { return $false }
    $scp = 'C:\Windows\System32\OpenSSH\scp.exe'
    $ssh = 'C:\Windows\System32\OpenSSH\ssh.exe'
    $stamp = Get-Date -Format 'yyyyMMddHHmmss'
    $remoteImg = "/tmp/tools_configs_patch_$stamp"
    $remoteWpa = "/tmp/wpa_patch_$stamp.conf"
    $remoteScript = "/tmp/patch-tools-configs-wpa_$stamp.sh"
    $localScript = Join-Path (Get-RepoRoot) 'scripts/hil/patch-tools-configs-wpa.sh'
    if (-not (Test-Path $localScript)) {
        Write-SdLogEvent 'patch_tools_configs' 'fail' "missing $localScript"
        return $false
    }
    & $scp -o BatchMode=yes $ImagePath "${SshHost}:${remoteImg}" 2>$null
    if ($LASTEXITCODE -ne 0) { return $false }
    & $scp -o BatchMode=yes $WpaPath "${SshHost}:${remoteWpa}" 2>$null
    if ($LASTEXITCODE -ne 0) { return $false }
    & $scp -o BatchMode=yes $localScript "${SshHost}:${remoteScript}" 2>$null
    if ($LASTEXITCODE -ne 0) { return $false }
    $out = & $ssh -o BatchMode=yes $SshHost "chmod +x $remoteScript; $remoteScript $remoteImg $remoteWpa; rm -f $remoteScript $remoteWpa" 2>$null
    if ($LASTEXITCODE -ne 0) { return $false }
    & $scp -o BatchMode=yes "${SshHost}:${remoteImg}" $ImagePath 2>$null
    & $ssh -o BatchMode=yes $SshHost "rm -f $remoteImg" 2>$null
    if ($LASTEXITCODE -ne 0) { return $false }
    Write-SdLogEvent 'patch_tools_configs' 'ok' 'wpa in ext2 updated'
    Write-AgentDebugLog -Location 'sd-install:patch_tools_configs' -Message 'tools_configs_wpa_patched' -HypothesisId 'W' -RunId 'install' -Data @{
        image = $ImagePath; ssh = $SshHost; result = @($out | Select-Object -Last 1)
    }
    return $true
}

function Invoke-ToolsConfigsWpaExtract {
    param(
        [string] $ImagePath,
        [string] $OutDir,
        [string] $SshHost = 'lll-legacy'
    )
    $scp = 'C:\Windows\System32\OpenSSH\scp.exe'
    $ssh = 'C:\Windows\System32\OpenSSH\ssh.exe'
    $remoteImg = "/tmp/tools_configs_extract_$(Get-Date -Format 'yyyyMMddHHmmss')"
    & $scp -o BatchMode=yes $ImagePath "${SshHost}:${remoteImg}" 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    $jsonRaw = & $ssh -o BatchMode=yes $SshHost "chmod +x /home/lll/atomcam_tools/scripts/hil/extract-tools-configs-wpa.sh 2>/dev/null; /home/lll/atomcam_tools/scripts/hil/extract-tools-configs-wpa.sh $remoteImg; rm -f $remoteImg" 2>$null
    if (-not $jsonRaw) { return $null }
    $line = @($jsonRaw | Where-Object { $_ -match '^\{' }) | Select-Object -Last 1
    if (-not $line) { return $null }
    $obj = $line | ConvertFrom-Json
    $obj | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $OutDir 'wpa_diag.json') -Encoding utf8
    if ($obj.wpa_redacted) {
        $obj.wpa_redacted | Set-Content (Join-Path $OutDir 'wpa_supplicant.redacted') -Encoding utf8
    }
    return $obj
}

function Invoke-ConfigsPartitionExtract {
    param(
        [string] $ImagePath,
        [string] $SshHost = 'lll-legacy'
    )
    $scp = 'C:\Windows\System32\OpenSSH\scp.exe'
    $ssh = 'C:\Windows\System32\OpenSSH\ssh.exe'
    $remoteImg = "/tmp/configs_extract_$(Get-Date -Format 'yyyyMMddHHmmss')"
    & $scp -o BatchMode=yes $ImagePath "${SshHost}:${remoteImg}" 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    $out = & $ssh -o BatchMode=yes $SshHost "debugfs -R 'cat /.user_config' $remoteImg 2>/dev/null; echo '---PRODUCT---'; debugfs -R 'cat /.product_config' $remoteImg 2>/dev/null | head -25; rm -f $remoteImg" 2>$null
    if (-not $out) { return $null }
    $inNet = $false
    $netBlock = @()
    $ssid = $null
    $pass = $null
    $model = $null
    foreach ($line in $out) {
        if ($line -eq '---PRODUCT---') { $inNet = $false; continue }
        if ($line -match '^\[NET\]') { $inNet = $true; $netBlock += $line; continue }
        if ($inNet -and $line -match '^\[') { $inNet = $false }
        if ($inNet) { $netBlock += $line }
        if ($line -match 'PRODUCT_MODEL=(.+)') { $model = $Matches[1].Trim() }
    }
    foreach ($line in $netBlock) {
        if ($line -match 'ssid=(.+)') { $ssid = $Matches[1].Trim() }
        if ($line -match 'password=(.+)') { $pass = $Matches[1].Trim() }
    }
    return [ordered]@{
        net_block      = $netBlock
        ssid           = $ssid
        password_set   = [bool]$pass
        product_model  = $model
    }
}

function Get-SdWifiConsistency {
    param(
        [string] $RootPath,
        [object] $Cfg,
        [object] $WpaToolsDiag,
        [object] $ConfigsDiag
    )
    $fatWpa = Join-Path $RootPath 'wpa_supplicant.conf'
    $fat = @{ ssid = $null; psk_set = $false }
    if (Test-Path $fatWpa) {
        $t = Get-Content $fatWpa -Raw
        if ($t -match 'ssid="([^"]+)"') { $fat.ssid = $Matches[1] }
        $fat.psk_set = $t -match 'psk="'
    }
    $tools = @{ ssid = $null; psk_set = $false }
    if ($WpaToolsDiag) {
        $tools.ssid = $WpaToolsDiag.ssid
        $tools.psk_set = $WpaToolsDiag.psk_set
    }
    $configs = @{ ssid = $null; password_set = $false }
    if ($ConfigsDiag) {
        $configs.ssid = $ConfigsDiag.ssid
        $configs.password_set = $ConfigsDiag.password_set
    }
    $envSsid = $null
    $envPassSet = $false
    if ($Cfg.wifiEnv -and (Test-Path $Cfg.wifiEnv)) {
        foreach ($line in Get-Content $Cfg.wifiEnv) {
            if ($line -match '^WIFI_SSID=(.+)$') { $envSsid = $Matches[1].Trim() }
            if ($line -match '^WIFI_PASS=(.+)$') { $envPassSet = [bool]$Matches[1].Trim() }
        }
    }
    $ssids = @(@($fat.ssid, $tools.ssid, $configs.ssid, $envSsid) | Where-Object { $_ } | Select-Object -Unique)
    $mismatches = @()
    if ($ssids.Count -gt 1) { $mismatches += 'ssid_mismatch_across_sources' }
    if ($fat.ssid -and $tools.ssid -and $fat.ssid -ne $tools.ssid) { $mismatches += 'fat_vs_tools_configs' }
    if ($fat.ssid -and $configs.ssid -and $fat.ssid -ne $configs.ssid) { $mismatches += 'fat_vs_configs' }
    if ($envSsid -and $fat.ssid -and $envSsid -ne $fat.ssid) { $mismatches += 'env_vs_fat' }
    $hackHost = $null
    $hackIni = Join-Path $RootPath 'hack.ini'
    if (Test-Path $hackIni) {
        $hn = Get-Content $hackIni | Where-Object { $_ -match '^TAILSCALE_HOSTNAME=' } | Select-Object -First 1
        if ($hn -match '^TAILSCALE_HOSTNAME=(.+)$') { $hackHost = $Matches[1].Trim() }
    }
    $hostname = $null
    $hostPath = Join-Path $RootPath 'hostname'
    if (Test-Path $hostPath) { $hostname = (Get-Content $hostPath -Raw).Trim() }
    return [ordered]@{
        fat_wpa        = $fat
        tools_configs  = $tools
        configs_ext2   = $configs
        wifi_env       = @{ ssid = $envSsid; pass_set = $envPassSet }
        hostname_sd    = $hostname
        tailscale_host = $hackHost
        unique_ssids   = @($ssids)
        mismatches     = @($mismatches)
        aligned        = ($mismatches.Count -eq 0 -and $ssids.Count -le 1)
    }
}

function Parse-WifiAuditBeacons {
    param([string[]] $Lines)
    $essids = @()
    $targetSeen = $false
    $targetMissing = $false
    foreach ($line in $Lines) {
        if ($line -match 'ESSID:"([^"]*)"') {
            $e = $Matches[1]
            if ($e) { $essids += $e }
        }
        if ($line -match '\[ESS\]\s+(\S+)\s*$') {
            $essids += $Matches[1]
        }
        if ($line -match 'TARGET_SSID_SEEN') { $targetSeen = $true; $targetMissing = $false }
        if ($line -match 'TARGET_SSID_NOT_SEEN') { $targetMissing = $true }
    }
    $essids = @($essids | Select-Object -Unique)
    if ($targetSeen) { $targetMissing = $false }
    return [ordered]@{
        essids           = $essids
        count            = $essids.Count
        target_fuk_nomap = $targetSeen
        target_missing   = $targetMissing
    }
}

function Analyze-HackIni([string] $Path) {
    $lines = Get-Content $Path
    $map = [ordered]@{}
    $duplicates = @()
    foreach ($line in $lines) {
        if ($line -notmatch '^([A-Za-z0-9_]+)=(.*)$') { continue }
        $k = $Matches[1]
        $v = $Matches[2]
        if ($map.Contains($k)) { $duplicates += $k }
        $map[$k] = $v
    }
    $effective = [ordered]@{}
    foreach ($k in @('MONITORING_NETWORK', 'MONITORING_REBOOT', 'REBOOT', 'HEALTHCHECK', 'TAILSCALE_ENABLE')) {
        if ($map.Contains($k)) { $effective[$k] = $map[$k] }
    }
    $diag = [ordered]@{
        line_count      = $lines.Count
        duplicate_keys  = @($duplicates | Select-Object -Unique)
        effective       = $effective
        has_auth_key    = $map.Contains('TAILSCALE_AUTH_KEY')
        auth_key_prefix = if ($map.TAILSCALE_AUTH_KEY) { $map.TAILSCALE_AUTH_KEY.Substring(0, [Math]::Min(12, $map.TAILSCALE_AUTH_KEY.Length)) } else { '' }
    }
    $diag | ConvertTo-Json -Depth 4 | Set-Content ((Join-Path (Split-Path $Path -Parent) 'hack_ini_diag.json')) -Encoding utf8
    return $diag
}

function Write-DebugReportMarkdown {
    param([object] $Report, [string] $OutPath)
    $hints = @($Report.hints) -join ', '
    $wpa = $Report.wpa
    $hack = $Report.hack_ini
    $md = @"
# AtomCam SD デバッグレポート

- 収集: $($Report.collected_at)
- SD: $($Report.sd_root)
- 出力: $($Report.artifacts_dir)

## hints

$hints

## tailnet

- 期待ホスト: $($Report.tailnet.expected_hostnames -join ', ')
- 検出: $($Report.tailnet.peer_found) (online=$($Report.tailnet.peer_online))

## hack.ini 実効値

$(if ($hack) { ($hack.effective | ConvertTo-Json -Compress) } else { 'n/a' })

重複キー: $(if ($hack) { $hack.duplicate_keys -join ', ' } else { 'n/a' })

## wpa_supplicant (tools_configs)

$(if ($wpa) { "- ssid: $($wpa.ssid)`n- ssid CR: $($wpa.ssid_diag.has_cr)`n- psk CR: $($wpa.psk_diag.has_cr)" } else { '抽出失敗' })

## WiFi 整合性 (SD)

$(if ($Report.consistency) {
    "- aligned: $($Report.consistency.aligned)`n- ssids: $($Report.consistency.unique_ssids -join ', ')`n- mismatches: $($Report.consistency.mismatches -join ', ')`n- hostname: $($Report.consistency.hostname_sd) / tailscale: $($Report.consistency.tailscale_host)`n- configs NET: ssid=$($Report.consistency.configs_ext2.ssid)"
} else { 'n/a' })

## WiFi ビーコン (wifi_audit.log)

$(if ($Report.wifi_beacons) {
    "- 検出 SSID 数: $($Report.wifi_beacons.count)`n- fuk_nomap 検出: $($Report.wifi_beacons.target_fuk_nomap)`n- SSIDs: $($Report.wifi_beacons.essids -join ', ')"
} else { '未収集（起動後に wifi_audit.log が生成されます）' })

## ファイル

$(($Report.files | ForEach-Object { "- $_" }) -join "`n")

## 詳細

- ``debug-report.json`` — 機械可読
- ``highlights/`` — ログ grep ヒット
- ``tails/`` — 各ログ末尾行
- ``wpa_diag.json`` / ``hack_ini_diag.json``
"@
    Set-Content -Path $OutPath -Value $md -Encoding utf8
}
