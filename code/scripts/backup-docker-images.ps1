# =============================================================================
# BICEC VeriPass - Backup mensuel des images Docker (Windows PowerShell)
#
# Sauvegarde toutes les images du docker-compose.yml dans un archive .tar.gz
# datee, puis supprime les backups de plus de 90 jours.
#
# IMPORTANT:
#   Ce script sauvegarde uniquement les images Docker.
#   Il ne sauvegarde pas les volumes, la base PostgreSQL, Redis, les documents,
#   les caches modeles, le projet Docker Desktop, ni les fichiers Compose.
#   Pour remettre un environnement runnable a un encadreur, utiliser plutot:
#     powershell -File scripts/export-docker-stack.ps1 -IncludeEnv
#
# Usage :
#   powershell -File scripts/backup-docker-images.ps1
#
# Automation (Task Scheduler - mensuel) :
#   1. Ouvrir "Task Scheduler"
#   2. Creer une tache -> Declencheur : mensuel, 1er jour du mois
#   3. Action : demarrer powershell.exe
#   4. Argument : -File "C:\chemin\vers\code\scripts\backup-docker-images.ps1"
# =============================================================================

$DATE = Get-Date -Format "yyyy-MM-dd"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_DIR = Split-Path -Parent $SCRIPT_DIR
$BACKUP_DIR = Join-Path $PROJECT_DIR "backups\docker-images"
$COMPOSE_FILE = Join-Path $PROJECT_DIR "docker-compose.yml"

New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null

Write-Output "=== Backup des images Docker - $DATE ==="

$IMAGES = @()
if (Test-Path $COMPOSE_FILE) {
    $IMAGES = @(docker compose -f $COMPOSE_FILE --project-name code config --images | Where-Object {
        -not [string]::IsNullOrWhiteSpace($_)
    } | Sort-Object -Unique)
}

if ($LASTEXITCODE -ne 0 -or $IMAGES.Count -eq 0) {
    Write-Output "Impossible de lire les images via docker compose config; fallback statique."
    $IMAGES = @(
        "postgres:17-bookworm"
        "redis:7-bookworm"
        "code-api"
        "code-celery_ocr"
        "code-celery_notifications"
        "code-celery_beat"
        "code-backoffice"
        "code-pwa"
        "mher/flower:2.0"
        "axllent/mailpit"
        "code-storage_init"
        "code-nginx"
    )
}

$OUTPUT = Join-Path $BACKUP_DIR "veripass-images-$DATE.tar.gz"

Write-Output "Images a sauvegarder :"
$AVAILABLE = @()
foreach ($img in $IMAGES) {
    $null = docker image inspect $img 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Output "  [OK] $img"
        $AVAILABLE += $img
    } else {
        Write-Output "  [--] $img - introuvable, ignoree"
    }
}

if ($AVAILABLE.Count -eq 0) {
    Write-Output "Aucune image trouvee a sauvegarder"
    exit 1
}

Write-Output ""
Write-Output "Creation de l'archive : $OUTPUT"

$TEMP_TAR = Join-Path $env:TEMP "veripass-images-$DATE.tar"
docker save $AVAILABLE -o $TEMP_TAR

if ($LASTEXITCODE -ne 0) {
    Write-Output "Erreur lors de docker save"
    exit 1
}

# Compresser avec gzip via .NET
$inputBytes = [System.IO.File]::ReadAllBytes($TEMP_TAR)
$outputStream = [System.IO.File]::OpenWrite($OUTPUT)
$gzipStream = New-Object System.IO.Compression.GzipStream($outputStream, [System.IO.Compression.CompressionMode]::Compress)
$gzipStream.Write($inputBytes, 0, $inputBytes.Length)
$gzipStream.Close()
$outputStream.Close()

Remove-Item $TEMP_TAR -Force

$SIZE = [math]::Round((Get-Item $OUTPUT).Length / 1GB, 2)
Write-Output "Backup termine - ${SIZE} GB"

# Nettoyage des backups de plus de 90 jours
Write-Output ""
Write-Output "Nettoyage des backups > 90 jours..."
$cutoff = (Get-Date).AddDays(-90)
Get-ChildItem $BACKUP_DIR -Filter "veripass-images-*.tar.gz" | Where-Object {
    $_.CreationTime -lt $cutoff
} | Remove-Item -Force
Write-Output "Termine"

Write-Output "=== Backup termine avec succes ==="
