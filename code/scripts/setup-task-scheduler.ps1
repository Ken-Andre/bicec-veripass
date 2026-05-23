# ============================================================
# BICEC VeriPass — Setup Windows Task Scheduler for Docker Prune
# ============================================================
# Usage: Run as Administrator
# .\setup-task-scheduler.ps1

#Requires -RunAsAdministrator

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$dockerPruneScript = Join-Path $scriptPath "docker_prune.ps1"
$taskName = "VeriPass Docker Prune"
$taskDescription = "Automatic Docker disk space cleanup for BICEC VeriPass"

# Check if script exists
if (-not (Test-Path $dockerPruneScript)) {
    Write-Error "docker_prune.ps1 not found at: $dockerPruneScript"
    exit 1
}

# Remove existing task if it exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Removing existing task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Create task action
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -NoProfile -File `"$dockerPruneScript`" -Force"

# Create task trigger (daily at 2 AM)
$trigger = New-ScheduledTaskTrigger -Daily -At 2am

# Create task settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$false `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

# Create task principal (run with highest privileges)
$principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

# Register the task
Register-ScheduledTask `
    -TaskName $taskName `
    -Description $taskDescription `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Force | Out-Null

Write-Host "✓ Task Scheduler job created successfully" -ForegroundColor Green
Write-Host ""
Write-Host "Task Name: $taskName" -ForegroundColor Cyan
Write-Host "Schedule: Daily at 2:00 AM" -ForegroundColor Cyan
Write-Host "Script: $dockerPruneScript" -ForegroundColor Cyan
Write-Host ""
Write-Host "To view the task:" -ForegroundColor Yellow
Write-Host "  Get-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
Write-Host ""
Write-Host "To run manually:" -ForegroundColor Yellow
Write-Host "  Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
Write-Host ""
Write-Host "To remove:" -ForegroundColor Yellow
Write-Host "  Unregister-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
Write-Host ""
Write-Host "To test the script:" -ForegroundColor Yellow
Write-Host "  .\docker_prune.ps1 -DryRun" -ForegroundColor Gray
