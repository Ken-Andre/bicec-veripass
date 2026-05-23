#!/usr/bin/env bash
# =============================================================================
# BICEC VeriPass — Backup mensuel des images Docker
#
# Sauvegarde toutes les images du docker-compose.yml dans un archive .tar.gz
# datée, puis supprime les backups de plus de 90 jours.
#
# Usage :
#   bash scripts/backup-docker-images.sh
#
# Automation (cron — 1er jour du mois à 2h) :
#   0 2 1 * * /chemin/vers/code/scripts/backup-docker-images.sh
# =============================================================================
set -euo pipefail

DATE=$(date +%Y-%m-%d)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_DIR/backups/docker-images"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"

mkdir -p "$BACKUP_DIR"

echo "=== Backup des images Docker — $DATE ==="

# Extraire la liste des images du docker-compose.yml
# (images buildées + images externes référencées)
IMAGES=()

# Images buildées localement (section build:)
while IFS= read -r line; do
    if [[ "$line" =~ image:\ +([^#]+) ]]; then
        img="${BASH_REMATCH[1]}"
        img="${img//\$\{*\}/}"  # Skip template variables
        if [ -n "$img" ]; then
            IMAGES+=("$img")
        fi
    fi
done < <(grep -E '^\s+image:\s+' "$COMPOSE_FILE" | sort -u)

# Ajouter les images externes explicites
EXTERNAL_IMAGES=(
    "code-api:latest"
    "code-pwa:latest"
    "code-backoffice:latest"
    "code-nginx:latest"
    "postgres:17-bookworm"
    "redis:7-bookworm"
    "mher/flower:2.0"
    "axllent/mailpit:latest"
    "nginxinc/nginx-unprivileged:1.27-alpine"
)

OUTPUT="$BACKUP_DIR/veripass-images-$DATE.tar.gz"

echo "Images à sauvegarder :"
for img in "${EXTERNAL_IMAGES[@]}"; do
    if docker image inspect "$img" &>/dev/null; then
        echo "  ✅ $img"
    else
        echo "  ⚠️  $img — introuvable, ignorée"
    fi
done

echo ""
echo "Création de l'archive : $OUTPUT"

# Sauvegarder uniquement les images qui existent
AVAILABLE_IMAGES=()
for img in "${EXTERNAL_IMAGES[@]}"; do
    if docker image inspect "$img" &>/dev/null; then
        AVAILABLE_IMAGES+=("$img")
    fi
done

if [ ${#AVAILABLE_IMAGES[@]} -eq 0 ]; then
    echo "❌ Aucune image trouvée à sauvegarder"
    exit 1
fi

docker save "${AVAILABLE_IMAGES[@]}" | gzip > "$OUTPUT"

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "✅ Backup terminé — $SIZE"

# Nettoyage des backups de plus de 90 jours
echo ""
echo "Nettoyage des backups > 90 jours..."
find "$BACKUP_DIR" -name "veripass-images-*.tar.gz" -type f -mtime +90 -delete
echo "✅ Terminé"

echo "=== Backup terminé avec succès ==="
