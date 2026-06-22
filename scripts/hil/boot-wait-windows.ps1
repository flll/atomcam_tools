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
Write-AgentDebugLog -Location 'boot-wait-windows.ps1:start' -Message 'boot_wait_start' -HypothesisId 'C' -Data @{
    hostnames = ($hostnames -join ',')
    wait_sec  = $WaitSec
    poll_sec  = $PollSec
}

$deadline = (Get-Date).AddSeconds($WaitSec)
$pollNum = 0
while ((Get-Date) -lt $deadline) {
    $pollNum++
    $peer = Find-TailnetPeer $hostnames
    $summary = Get-TailnetPeerSummary
    Write-AgentDebugLog -Location 'boot-wait-windows.ps1:poll' -Message 'boot_wait_poll' -HypothesisId 'B,C' -Data @{
        poll        = $pollNum
        peer_found  = [bool]$peer
        peer_online = if ($peer) { $peer.Online } else { $false }
        peer_name   = if ($peer) { $peer.Name } else { $null }
        summary     = $summary
        elapsed_s   = [int]($WaitSec - ($deadline - (Get-Date)).TotalSeconds)
    }
    if ($peer) {
        Write-SdLogEvent 'boot_wait' 'ok' "found=$($peer.Name) online=$($peer.Online)"
        Write-AgentDebugLog -Location 'boot-wait-windows.ps1:success' -Message 'boot_wait_ok' -HypothesisId 'B' -Data @{
            peer = $peer.Name; online = $peer.Online; ips = ($peer.TailscaleIPs -join ',')
        }
        Write-SdNdjsonLog $cfg 'boot_wait_windows' 0 @{ peer = $peer.Name; online = $peer.Online }
        exit 0
    }
    Start-Sleep -Seconds $PollSec
}

Write-SdLogEvent 'boot_wait' 'fail' 'timeout'
Write-AgentDebugLog -Location 'boot-wait-windows.ps1:timeout' -Message 'boot_wait_timeout' -HypothesisId 'A,B,C' -Data @{
    polls    = $pollNum
    summary  = (Get-TailnetPeerSummary)
    hostnames = ($hostnames -join ',')
}
Write-SdNdjsonLog $cfg 'boot_wait_windows' 20 @{ hostnames = ($hostnames -join ',') }
exit 20
