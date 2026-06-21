# Shared helpers for AtomCam SD install / boot probe scripts (atomcam_tools 正本).
Set-StrictMode -Version Latest

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
