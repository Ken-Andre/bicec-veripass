# PreToolUse Hook: start-dev-env (PowerShell)
# Démarre l'environnement de dev avant les opérations

$input = [Console]::In.ReadToEnd() | ConvertFrom-Json
$tool = $input.preToolUse.tool
$command = $input.preToolUse.parameters.command

# Vérifier si on lance un serveur de dev
if ($tool -eq "execute_command" -and ($command -like "*npm run dev*" -or $command -like "*docker compose up*")) {
    Write-Host "🚀 Vérification de l'environnement de développement..." -ForegroundColor Cyan
    
    # Vérifier Docker
    try {
        $dockerInfo = docker info 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Output '{"cancel":true,"errorMessage":"Docker n'\''est pas en cours d'\''exécution. Veuillez démarrer Docker avant de continuer."}'
            exit 0
        }
    }
    catch {
        Write-Output '{"cancel":true,"errorMessage":"Docker n'\''est pas accessible. Vérifiez votre installation Docker."}'
        exit 0
    }
}

Write-Output '{"cancel":false}'