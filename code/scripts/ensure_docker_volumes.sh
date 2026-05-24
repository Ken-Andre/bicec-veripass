#!/bin/bash
# ============================================================
# BICEC VeriPass - non-destructive Docker volume bootstrap
# ============================================================
# Creates missing persistent volumes with retention labels.
# Existing volumes are never recreated, migrated, or relabeled.

set -euo pipefail

DOCUMENTS_VOLUME_NAME="${VP_DOCUMENTS_VOLUME_NAME:-code_documents_storage}"
DB_VOLUME_NAME="${VP_DB_VOLUME_NAME:-code_db_storage}"
DB_BACKUPS_VOLUME_NAME="${VP_DB_BACKUPS_VOLUME_NAME:-code_db_backups}"

check_docker() {
    if ! docker version --format '{{.Server.Version}}' >/dev/null 2>&1; then
        echo "ERROR: Docker is not running or is not accessible." >&2
        exit 1
    fi
}

ensure_volume() {
    local name=$1
    local type=$2

    if docker volume inspect "$name" >/dev/null 2>&1; then
        echo "Volume exists, leaving untouched: $name"
        return 0
    fi

    echo "Creating missing persistent volume: $name"
    docker volume create \
        --label "com.bicec.retention=10y" \
        --label "com.bicec.type=$type" \
        "$name" >/dev/null
}

check_docker
ensure_volume "$DOCUMENTS_VOLUME_NAME" "pii-documents"
ensure_volume "$DB_VOLUME_NAME" "pii-database"
ensure_volume "$DB_BACKUPS_VOLUME_NAME" "backup"
echo "Critical Docker volumes are present."
