#Requires -Version 5.1
# 後方互換: 詳細収集は sd-debug-collect-windows.ps1 に委譲。
[CmdletBinding()]
param(
    [int] $WaitSec = 0
)

$args = @('-NoProfile', '-File', (Join-Path $PSScriptRoot 'sd-debug-collect-windows.ps1'))
if ($WaitSec -gt 0) { $args += '-WaitSec', $WaitSec }
& pwsh @args
exit $LASTEXITCODE
