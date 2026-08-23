[CmdletBinding()]
param(
    [string]$TaskName = "Dyl Nawful Hourly Refresh"
)

$ErrorActionPreference = "Stop"
$runner = Join-Path $PSScriptRoot "refresh-and-publish.ps1"
if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) {
    throw "Refresh runner was not found at $runner"
}

$arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $runner
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments -WorkingDirectory (Split-Path -Parent $PSScriptRoot)
$trigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(2)) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 20)
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Description "Collect and publish the latest Dyl Nawful posts every hour." -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Output "Registered scheduled task: $TaskName"
