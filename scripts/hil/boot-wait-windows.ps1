#Requires -Version 5.1
# Tailscale 上で AtomCam の起動到達を待つ。
[CmdletBinding()]
param(
    [int] $WaitSec = 0,
    [int] $PollSec = 0
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\sd-common.ps1"
Initialize-SdLog

$cfg = Load-SdConfig
if ($WaitSec -le 0) { $WaitSec = $cfg.bootWaitSec }
if ($PollSec -le 0) { $PollSec = $cfg.bootPollSec }

$hostnames = Get-ExpectedHostnames $cfg
Write-SdLogEvent 'boot_wait' 'start' "hostnames=$($hostnames -join ',') wait=${WaitSec}s"

$deadline = (Get-Date).AddSeconds($WaitSec)
while ((Get-Date) -lt $deadline) {
    $peer = Find-TailnetPeer $hostnames
    if ($peer) {
        Write-SdLogEvent 'boot_wait' 'ok' "found=$($peer.Name) online=$($peer.Online)"
        Write-SdNdjsonLog $cfg 'boot_wait_windows' 0 @{ peer = $peer.Name; online = $peer.Online }
        exit 0
    }
    Start-Sleep -Seconds $PollSec
}

Write-SdLogEvent 'boot_wait' 'fail' 'timeout'
Write-SdNdjsonLog $cfg 'boot_wait_windows' 20 @{ hostnames = ($hostnames -join ',') }
exit 20
