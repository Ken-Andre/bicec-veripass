# TaskStart Hook: init-env (PowerShell)
# Initialise l'environnement au démarrage d'une nouvelle tâche

Write-Host "🎯 Initialisation de l'environnement BICEC VeriPass..." -ForegroundColor Green

# Vérifier Docker
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker est en cours d'exécution" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Docker n'est pas en cours d'exécution" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Docker n'est pas accessible" -ForegroundColor Yellow
}

# Vérifier si les services sont déjà lancés
try {
    $services = docker compose ps 2>&1
    if ($services -match "running") {
        Write-Host "✅ Services Docker déjà actifs" -ForegroundColor Green
    } else {
        Write-Host "ℹ️ Services Docker non lancés (utilisez docker compose up -d)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "ℹ️ Impossible de vérifier les services Docker" -ForegroundColor Cyan
}

# Vérifier les variables d'environnement
if (Test-Path ".env") {
    Write-Host "✅ Fichier .env trouvé" -ForegroundColor Green
} else {
    Write-Host "⚠️ Fichier .env manquant (copiez .env.example)" -ForegroundColor Yellow
}

Write-Output '{"cancel":false}'