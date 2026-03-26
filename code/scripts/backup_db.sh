#!/bin/bash
# backup_db.sh — PostgreSQL daily backup for bicec-veripass
# Runs from HOST (not inside container) — uses pg_dump via network
# Usage: ./backup_db.sh [retention_days]
# Default retention: 7 days

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Config
BACKUP_DIR="${PROJECT_DIR}/backups/db"
RETENTION_DAYS="${1:-7}"
DB_NAME="${DB_NAME:-veripass}"
DB_USER="${DB_USER:-vp_user}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-15432}"
CONTAINER_NAME="${CONTAINER_NAME:-vp_postgres}"

# Load DB_PASSWORD from .env if not set
if [ -z "${DB_PASSWORD:-}" ] && [ -f "${PROJECT_DIR}/.env" ]; then
    DB_PASSWORD=$(grep -E '^DB_PASSWORD=' "${PROJECT_DIR}/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
fi

if [ -z "${DB_PASSWORD:-}" ]; then
    echo "[ERROR] DB_PASSWORD not set. Export it or ensure .env exists."
    exit 1
fi

mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.dump"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup → $BACKUP_FILE"

# pg_dump via network (custom compressed format)
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -Fc \
    "$DB_NAME" > "$BACKUP_FILE"

if [ -s "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup OK: $SIZE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Backup file is empty!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Rotation — delete backups older than RETENTION_DAYS
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Rotating backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "*.dump" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

REMAINING=$(find "$BACKUP_DIR" -name "*.dump" 2>/dev/null | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Done. ${REMAINING} backup(s) retained."

exit 0
