# PostToolUse Hook: log-actions (PowerShell)
# Log toutes les actions effectuées dans un fichier de journal

$input = [Console]::In.ReadToEnd() | ConvertFrom-Json
$tool = $input.postToolUse.tool
$success = $input.postToolUse.success
$duration = $input.postToolUse.durationMs
$timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz"

# Log dans un fichier
$logFile = "$HOME\.cline-actions.log"
$logEntry = "$timestamp | $tool | success=$success | ${duration}ms"
Add-Content -Path $logFile -Value $logEntry

# Si l'action a échoué, notifier
if ($success -eq $false) {
    Write-Host "⚠️ Action $tool a échoué (voir $logFile pour détails)" -ForegroundColor Yellow
}

Write-Output '{"cancel":false}'