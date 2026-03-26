#!/bin/bash
# restore_db.sh — PostgreSQL restore for bicec-veripass
# Runs from HOST — uses pg_restore via network
# Usage: ./restore_db.sh <backup_file> [target_db]
# Example: ./restore_db.sh backups/db/veripass_20260324_030000.dump

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Config
DB_USER="${DB_USER:-vp_user}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-15432}"

# Load DB_PASSWORD from .env if not set
if [ -z "${DB_PASSWORD:-}" ] && [ -f "${PROJECT_DIR}/.env" ]; then
    DB_PASSWORD=$(grep -E '^DB_PASSWORD=' "${PROJECT_DIR}/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
fi

if [ -z "${DB_PASSWORD:-}" ]; then
    echo "[ERROR] DB_PASSWORD not set. Export it or ensure .env exists."
    exit 1
fi

if [ -z "${1:-}" ]; then
    echo "Usage: $0 <backup_file> [target_db]"
    echo "Example: $0 backups/db/veripass_20260324_030000.dump"
    echo ""
    echo "Available backups:"
    find "${PROJECT_DIR}/backups/db" -name "*.dump" -type f 2>/dev/null | sort -r | head -10
    exit 1
fi

BACKUP_FILE="$1"
TARGET_DB="${2:-veripass}"

# Resolve path
if [ ! -f "$BACKUP_FILE" ]; then
    BACKUP_FILE="${PROJECT_DIR}/backups/db/$1"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "[ERROR] Backup file not found: $1"
    echo "Available backups:"
    find "${PROJECT_DIR}/backups/db" -name "*.dump" -type f 2>/dev/null | sort -r | head -10
    exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restore from: $BACKUP_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Target DB: $TARGET_DB"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: This will DROP and recreate the database!"
read -p "Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

START_TIME=$(date +%s)

# Drop and recreate
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Dropping existing database..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$TARGET_DB' AND pid <> pg_backend_pid();" > /dev/null 2>&1 || true
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS $TARGET_DB;" > /dev/null
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
    -c "CREATE DATABASE $TARGET_DB OWNER $DB_USER;" > /dev/null

# Restore
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restoring..."
PGPASSWORD="$DB_PASSWORD" pg_restore \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$TARGET_DB" \
    --clean --if-exists \
    "$BACKUP_FILE"

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restore completed in ${ELAPSED}s."

if [ "$ELAPSED" -gt 1800 ]; then
    echo "[WARN] Restore took more than 30 minutes (SLA breach)."
fi

exit 0
