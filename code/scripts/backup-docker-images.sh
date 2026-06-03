#!/usr/bin/env bash
# =============================================================================
# BICEC VeriPass - Backup mensuel des images Docker
#
# Sauvegarde uniquement les images Docker du docker-compose.yml dans une archive
# .tar.gz datee, puis supprime les backups de plus de 90 jours.
#
# IMPORTANT:
#   Ce script sauvegarde uniquement les images Docker.
#   Il ne sauvegarde pas les volumes, la base PostgreSQL, Redis, les documents,
#   les caches modeles, le projet Docker Desktop, ni les fichiers Compose.
#   Pour remettre un environnement runnable a un encadreur, utiliser plutot:
#     powershell -File scripts/export-docker-stack.ps1 -IncludeEnv
#
# Usage :
#   bash scripts/backup-docker-images.sh
#
# Automation (cron - 1er jour du mois a 2h) :
#   0 2 1 * * /chemin/vers/code/scripts/backup-docker-images.sh
# =============================================================================
set -euo pipefail

DATE=$(date +%Y-%m-%d)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_DIR/backups/docker-images"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"

mkdir -p "$BACKUP_DIR"

echo "=== Backup des images Docker - $DATE ==="

mapfile -t IMAGES < <(docker compose -f "$COMPOSE_FILE" --project-name code config --images | sort -u || true)

if [ ${#IMAGES[@]} -eq 0 ]; then
    echo "Impossible de lire les images via docker compose config; fallback statique."
    IMAGES=(
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
fi

OUTPUT="$BACKUP_DIR/veripass-images-$DATE.tar.gz"

echo "Images a sauvegarder :"
AVAILABLE_IMAGES=()
for img in "${IMAGES[@]}"; do
    if docker image inspect "$img" &>/dev/null; then
        echo "  [OK] $img"
        AVAILABLE_IMAGES+=("$img")
    else
        echo "  [--] $img - introuvable, ignoree"
    fi
done

if [ ${#AVAILABLE_IMAGES[@]} -eq 0 ]; then
    echo "Aucune image trouvee a sauvegarder"
    exit 1
fi

echo ""
echo "Creation de l'archive : $OUTPUT"
docker save "${AVAILABLE_IMAGES[@]}" | gzip > "$OUTPUT"

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "Backup termine - $SIZE"

echo ""
echo "Nettoyage des backups > 90 jours..."
find "$BACKUP_DIR" -name "veripass-images-*.tar.gz" -type f -mtime +90 -delete
echo "Termine"

echo "=== Backup termine avec succes ==="
