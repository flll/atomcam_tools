#Requires -Version 5.1
<#
.SYNOPSIS
  AtomCam SD カードへビルド済み zip を冪等インストール（atomcam_tools 正本）。

.DESCRIPTION
  既定は --FilesOnly（format なし・tools_configs 温存）。
  初回ブートストラップのみ --Bootstrap（diskpart clean + preserve）。

.PARAMETER Bootstrap
  初回のみ: format + 5 ファイル配置。

.PARAMETER FilesOnly
  反復開発既定: format しない。tools_configs / configs を preserve。

.PARAMETER RefreshZip
  lll-legacy から target/sd_initial.zip を再取得（scp）。

.EXIT CODES
  0  - 配置・検証 OK
  10 - 検証失敗
  20 - SD 未検出
  30 - zip 取得失敗
#>
[CmdletBinding(DefaultParameterSetName = 'FilesOnly')]
param(
    [Parameter(ParameterSetName = 'Bootstrap')]
    [switch] $Bootstrap,
    [Parameter(ParameterSetName = 'FilesOnly')]
    [switch] $FilesOnly,
    [switch] $RefreshZip,
    [switch] $ImportTailscaleOnly,
    [switch] $VerifyOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:ExitCode = 0
$script:SshExe = 'C:\Windows\System32\OpenSSH\ssh.exe'
$script:ScpExe = 'C:\Windows\System32\OpenSSH\scp.exe'

. "$PSScriptRoot\sd-common.ps1"
Initialize-SdLog

function Fetch-Zip([object] $Cfg) {
    $cacheDir = Split-Path $Cfg.zipCache -Parent
    if (-not (Test-Path $cacheDir)) { New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null }

    if ((Test-Path $Cfg.zipCache) -and -not $RefreshZip) {
        Write-SdLogEvent 'fetch' 'ok' 'using cache'
        return $true
    }

    $remote = "$($Cfg.zipSourceHost):$($Cfg.zipSourcePath)"
    Write-SdLogEvent 'fetch' 'start' $remote
    $proc = Start-Process -FilePath $script:ScpExe -ArgumentList @(
        '-o', 'BatchMode=yes',
        $remote,
        $Cfg.zipCache
    ) -Wait -PassThru -NoNewWindow

    if ($proc.ExitCode -ne 0) {
        Write-SdLogEvent 'fetch' 'fail' "scp exit $($proc.ExitCode)"
        return $false
    }
    Write-SdLogEvent 'fetch' 'ok' "cached $((Get-Item $Cfg.zipCache).Length) bytes"
    return $true
}

function Format-SdCard([object] $Sd) {
    Write-SdLogEvent 'format' 'start' $Sd.RootPath
    $partNum = $Sd.Partition.PartitionNumber
    $diskNum = $Sd.Partition.DiskNumber
    $dpScript = Join-Path $env:TEMP "atomcam-format-$diskNum-$partNum.dp"
    @"
select disk $diskNum
clean
create partition primary
format fs=fat32 quick label=ATOMCAM
assign letter=H
"@ | Set-Content -Path $dpScript -Encoding ascii

    $gsudo = (Get-Command gsudo -ErrorAction SilentlyContinue).Source
    if (-not $gsudo) { $gsudo = 'C:\Program Files\gsudo\Current\gsudo.exe' }
    & $gsudo diskpart /s $dpScript
    $exit = $LASTEXITCODE
    Remove-Item $dpScript -Force -ErrorAction SilentlyContinue
    if ($exit -ne 0) {
        Write-SdLogEvent 'format' 'fail' "diskpart exit $exit"
        return $false
    }
    Write-SdLogEvent 'format' 'ok' 'FAT32 quick via diskpart'
    return $true
}

function Stage-Zip([object] $Cfg) {
    if (Test-Path $Cfg.stagingDir) { Remove-Item $Cfg.stagingDir -Recurse -Force }
    New-Item -ItemType Directory -Path $Cfg.stagingDir -Force | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($Cfg.zipCache, $Cfg.stagingDir)
    Write-SdLogEvent 'stage' 'ok' "$((Get-ChildItem $Cfg.stagingDir -File).Count) files"
    return $true
}

function Preserve-SdFiles([object] $Sd, [object] $Cfg, [switch] $SkipOptionalBootstrap) {
    if (-not $Cfg.preserveFiles) { return }
    New-Item -ItemType Directory -Path $Cfg.preserveDir -Force | Out-Null
    foreach ($name in @($Cfg.preserveFiles)) {
        if ($SkipOptionalBootstrap -and @($Cfg.optionalBootstrapFiles) -contains $name) {
            Write-SdLogEvent 'preserve' 'skip' "$name (refresh zip)"
            continue
        }
        $src = Join-Path $Sd.RootPath $name
        if (Test-Path $src) {
            Copy-Item $src (Join-Path $Cfg.preserveDir $name) -Force
            Write-SdLogEvent 'preserve' 'ok' $name
        }
    }
}

function Restore-SdFiles([object] $Sd, [object] $Cfg, [switch] $SkipOptionalBootstrap) {
    if (-not $Cfg.preserveFiles) { return }
    foreach ($name in @($Cfg.preserveFiles)) {
        if ($SkipOptionalBootstrap -and @($Cfg.optionalBootstrapFiles) -contains $name) {
            continue
        }
        $src = Join-Path $Cfg.preserveDir $name
        if (Test-Path $src) {
            Copy-Item $src (Join-Path $Sd.RootPath $name) -Force
            Write-SdLogEvent 'restore' 'ok' $name
        }
    }
}

function Copy-OptionalBootstrap([object] $Cfg, [object] $Sd, [switch] $ForceUpdate) {
    if (-not $Cfg.optionalBootstrapFiles) { return $true }
    foreach ($name in @($Cfg.optionalBootstrapFiles)) {
        $src = Join-Path $Cfg.stagingDir $name
        $dst = Join-Path $Sd.RootPath $name
        if (Test-Path $src) {
            if ($ForceUpdate -or -not (Test-Path $dst)) {
                Copy-Item $src $dst -Force
                Write-SdLogEvent 'copy_optional' 'ok' $name
            } else {
                Write-SdLogEvent 'copy_optional' 'skip' "$name exists on SD"
            }
        }
    }
    return $true
}

function Patch-HackIni([object] $Cfg) {
    $hackIni = Join-Path $Cfg.stagingDir 'hack.ini'
    if (-not (Test-Path $hackIni)) {
        Write-SdLogEvent 'patch_hackini' 'fail' 'hack.ini missing in staging'
        return $false
    }
    if (-not (Test-Path $Cfg.tailscaleEnv)) {
        Write-SdLogEvent 'patch_hackini' 'fail' 'tailscale env not found'
        return $false
    }
    $bootstrap = @()
    if ($Cfg.hackIniBootstrapPath -and (Test-Path $Cfg.hackIniBootstrapPath)) {
        $bootstrap = @(Get-Content $Cfg.hackIniBootstrapPath)
    }
    $baseLines = Get-Content $hackIni | Where-Object {
        $_ -notmatch '^TAILSCALE_' -and $_ -notmatch '^(CONFIG_VER|MONITORING_|REBOOT=|HEALTHCHECK)='
    }
    $tsLines = Get-Content $Cfg.tailscaleEnv | Where-Object { $_ -match '^TAILSCALE_' }
    if ($tsLines.Count -eq 0) {
        Write-SdLogEvent 'patch_hackini' 'fail' 'no TAILSCALE_* in env'
        return $false
    }
    $merged = @($bootstrap) + @($baseLines) + @($tsLines)
    # 重複キー除去（後勝ち → bootstrap/Tailscale 正本を優先）
    $map = [ordered]@{}
    foreach ($line in $merged) {
        if ($line -match '^([A-Za-z0-9_]+)=(.*)$') { $map[$Matches[1]] = $line }
        elseif ($line.Trim()) { $map["__raw_$([guid]::NewGuid().ToString('N').Substring(0,8))"] = $line }
    }
    $merged = @($map.Values)
    Set-Content -Path $hackIni -Value (($merged -join "`n") + "`n") -Encoding utf8
    Write-SdLogEvent 'patch_hackini' 'ok' "$($tsLines.Count) tailscale lines"
    return $true
}

function Copy-PackageFiles([object] $Cfg, [object] $Sd) {
    foreach ($name in $Cfg.packageFiles) {
        $src = Join-Path $Cfg.stagingDir $name
        $dst = Join-Path $Sd.RootPath $name
        if (-not (Test-Path $src)) {
            Write-SdLogEvent 'copy' 'fail' "missing staging: $name"
            return $false
        }
        Copy-Item -Path $src -Destination $dst -Force
    }
    Write-SdLogEvent 'copy' 'ok' "$($Cfg.packageFiles.Count) files"
    return $true
}

function Verify-SdInstall([object] $Cfg, [object] $Sd) {
    $failures = @()
    foreach ($name in $Cfg.packageFiles) {
        $path = Join-Path $Sd.RootPath $name
        if (-not (Test-Path $path)) {
            $failures += "missing:$name"
            continue
        }
        $size = (Get-Item $path).Length
        $expectedProp = $Cfg.expectedFiles.PSObject.Properties[$name]
        if ($expectedProp -and $null -ne $expectedProp.Value -and $expectedProp.Value -gt 0) {
            if ($size -ne $expectedProp.Value) {
                $failures += "size:$name ($size != $($expectedProp.Value))"
            }
        }
    }
    $hackIni = Join-Path $Sd.RootPath 'hack.ini'
    $hasKey = @(Get-Content $hackIni -ErrorAction SilentlyContinue | Where-Object { $_ -match '^TAILSCALE_AUTH_KEY=.+'}).Count -gt 0
    if (-not $hasKey) { $failures += 'hack.ini:TAILSCALE_AUTH_KEY missing' }

    $extra = @(Get-ChildItem $Sd.RootPath -File | Where-Object {
        $Cfg.packageFiles -notcontains $_.Name -and @($Cfg.preserveFiles) -notcontains $_.Name -and @($Cfg.optionalBootstrapFiles) -notcontains $_.Name
    })
    $extraDirs = @(Get-ChildItem $Sd.RootPath -Directory -Force | Where-Object { $_.Name -ne 'System Volume Information' })
    if ($extra.Count -gt 0 -or $extraDirs.Count -gt 0) {
        $failures += "extra_content_on_sd"
    }
    if ($failures.Count -gt 0) {
        Write-SdLogEvent 'verify' 'fail' ($failures -join '; ')
        return $false
    }
    Write-SdLogEvent 'verify' 'ok' 'all checks passed'
    return $true
}

function Import-TailscaleFromSd([object] $Sd, [object] $Cfg) {
    $hackIni = Join-Path $Sd.RootPath 'hack.ini'
    $lines = @(Get-Content $hackIni -ErrorAction SilentlyContinue | Where-Object { $_ -match '^TAILSCALE_' })
    if ($lines.Count -eq 0) { return $false }
    $existing = @()
    if (Test-Path $Cfg.tailscaleEnv) { $existing = Get-Content $Cfg.tailscaleEnv }
    $map = [ordered]@{}
    foreach ($line in $existing) {
        if ($line -match '^([A-Z_]+)=(.*)$') { $map[$Matches[1]] = $line }
    }
    foreach ($line in $lines) {
        if ($line -match '^([A-Z_]+)=(.*)$') { $map[$Matches[1]] = $line }
    }
    $dir = Split-Path $Cfg.tailscaleEnv -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Set-Content -Path $Cfg.tailscaleEnv -Value (($map.Values -join "`n") + "`n") -Encoding utf8
    Write-SdLogEvent 'import_tailscale' 'ok' "$($lines.Count) lines"
    return $true
}

$cfg = Load-SdConfig
$mode = if ($Bootstrap) { 'bootstrap' } else { 'files-only' }
Write-SdLogEvent 'mode' 'ok' $mode

$sd = Resolve-SdCard $cfg
if (-not $sd) {
    Write-SdNdjsonLog $cfg 'sd_install_windows' 20 @{ mode = $mode }
    exit 20
}

if ($ImportTailscaleOnly) {
    Import-TailscaleFromSd $sd $cfg | Out-Null
    Write-SdNdjsonLog $cfg 'sd_install_windows' 0 @{ mode = $mode }
    exit 0
}

if ($VerifyOnly) {
    $exit = if (Verify-SdInstall $cfg $sd) { 0 } else { 10 }
    Write-SdNdjsonLog $cfg 'sd_install_windows' $exit @{ mode = $mode }
    exit $exit
}

if (-not (Fetch-Zip $cfg)) {
    Write-SdNdjsonLog $cfg 'sd_install_windows' 30 @{ mode = $mode }
    exit 30
}

Preserve-SdFiles $sd $cfg -SkipOptionalBootstrap:$RefreshZip

if ($Bootstrap) {
    if (-not (Format-SdCard $sd)) {
        Write-SdNdjsonLog $cfg 'sd_install_windows' 10 @{ mode = $mode }
        exit 10
    }
    $sd = Resolve-SdCard $cfg
    if (-not $sd) {
        Write-SdNdjsonLog $cfg 'sd_install_windows' 20 @{ mode = $mode }
        exit 20
    }
} else {
    Write-SdLogEvent 'format' 'skip' 'FilesOnly — no diskpart'
}

if (-not (Stage-Zip $cfg)) {
    Write-SdNdjsonLog $cfg 'sd_install_windows' 10 @{ mode = $mode }
    exit 10
}
if (-not (Patch-HackIni $cfg)) {
    Write-SdNdjsonLog $cfg 'sd_install_windows' 10 @{ mode = $mode }
    exit 10
}
if (-not (Copy-PackageFiles $cfg $sd)) {
    Write-SdNdjsonLog $cfg 'sd_install_windows' 10 @{ mode = $mode }
    exit 10
}
Copy-OptionalBootstrap $cfg $sd -ForceUpdate:$RefreshZip | Out-Null
Restore-SdFiles $sd $cfg -SkipOptionalBootstrap:$RefreshZip

if (-not (Verify-SdInstall $cfg $sd)) {
    Write-SdNdjsonLog $cfg 'sd_install_windows' 10 @{ mode = $mode }
    exit 10
}

Write-SdNdjsonLog $cfg 'sd_install_windows' 0 @{ mode = $mode }
exit 0
