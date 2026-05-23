#!/bin/bash
# test-backup-restore.sh — Integration test for backup/restore workflow
# Prerequisites: Docker Compose stack running with PostgreSQL accessible
# Usage: ./test-backup-restore.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================="
echo "PostgreSQL Backup/Restore Integration Test"
echo "========================================="
echo ""

# Load .env
if [ -f "${PROJECT_DIR}/.env" ]; then
    export $(grep -v '^#' "${PROJECT_DIR}/.env" | xargs)
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-15432}"
DB_USER="${DB_USER:-vp_user}"
DB_NAME="veripass"
TEST_DB="veripass_test_restore"

echo "[1/6] Checking PostgreSQL connectivity..."
if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
    echo "ERROR: Cannot connect to PostgreSQL at $DB_HOST:$DB_PORT"
    echo "Ensure docker-compose stack is running: docker compose up -d postgres"
    exit 1
fi
echo "✓ PostgreSQL accessible"
echo ""

echo "[2/6] Creating test data in $DB_NAME..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<SQL
CREATE TABLE IF NOT EXISTS backup_test (
    id SERIAL PRIMARY KEY,
    test_data TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO backup_test (test_data) VALUES ('Test backup $(date +%s)');
SQL
echo "✓ Test data inserted"
echo ""

echo "[3/6] Running backup..."
START_TIME=$(date +%s)
bash "${SCRIPT_DIR}/backup_db.sh" 7
BACKUP_TIME=$(($(date +%s) - START_TIME))
echo "✓ Backup completed in ${BACKUP_TIME}s"
echo ""

echo "[4/6] Finding latest backup..."
LATEST_BACKUP=$(find "${PROJECT_DIR}/backups/db" -name "*.dump" -type f | sort -r | head -1)
if [ -z "$LATEST_BACKUP" ]; then
    echo "ERROR: No backup file found"
    exit 1
fi
BACKUP_SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)
echo "✓ Latest backup: $(basename "$LATEST_BACKUP") ($BACKUP_SIZE)"
echo ""

echo "[5/6] Testing restore to $TEST_DB..."
START_TIME=$(date +%s)
# Non-interactive restore
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS $TEST_DB;" > /dev/null
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
    -c "CREATE DATABASE $TEST_DB OWNER $DB_USER;" > /dev/null
PGPASSWORD="$DB_PASSWORD" pg_restore \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$TEST_DB" \
    --clean --if-exists \
    "$LATEST_BACKUP" > /dev/null 2>&1
RESTORE_TIME=$(($(date +%s) - START_TIME))
echo "✓ Restore completed in ${RESTORE_TIME}s"
echo ""

echo "[6/6] Verifying restored data..."
ROW_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB" \
    -t -c "SELECT COUNT(*) FROM backup_test;" | xargs)
if [ "$ROW_COUNT" -gt 0 ]; then
    echo "✓ Data verified: $ROW_COUNT rows in backup_test table"
else
    echo "ERROR: No data found in restored database"
    exit 1
fi
echo ""

# Cleanup test database
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS $TEST_DB;" > /dev/null

echo "========================================="
echo "✅ ALL TESTS PASSED"
echo "========================================="
echo "Backup time: ${BACKUP_TIME}s"
echo "Restore time: ${RESTORE_TIME}s"
if [ "$RESTORE_TIME" -gt 1800 ]; then
    echo "⚠️  WARNING: Restore time exceeds 30min SLA"
else
    echo "✓ Restore time within 30min SLA"
fi
echo ""

exit 0
