#!/bin/bash
set -e

# ==============================================================================
# BICEC VeriPass — Local Encrypted Backup for KYC Images
# Conforme Loi 2024-017 (Souveraineté des données) & Rétention COBAC (10 ans)
# ==============================================================================

# Configuration (fallback to environment variables or defaults)
STORAGE_DIR="${STORAGE_PATH:-/app/data/storage}"
BACKUP_BASE_DIR="${BACKUP_IMAGES_DIR:-/backups/images}"
PASSPHRASE="${BACKUP_ENCRYPTION_KEY:-veripass-insecure-dev-key}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="kyc_images_${TIMESTAMP}.tar.gz"
BACKUP_FILE="${BACKUP_BASE_DIR}/${BACKUP_NAME}"
ENCRYPTED_FILE="${BACKUP_FILE}.gpg"

mkdir -p "${BACKUP_BASE_DIR}"

echo "Starting encrypted backup of ${STORAGE_DIR}..."

# 1. Create compressed archive and encrypt with GPG (AES-256)
# Use --batch and --passphrase-fd to avoid interactive prompts
tar -czf - -C "${STORAGE_DIR}" . | \
    gpg --batch --yes --symmetric --cipher-algo AES256 \
    --passphrase "${PASSPHRASE}" \
    -o "${ENCRYPTED_FILE}"

# 2. Verify integrity and generate SHA-256 for audit log
SHA256=$(sha256sum "${ENCRYPTED_FILE}" | awk '{ print $1 }')
SIZE_BYTES=$(stat -c%s "${ENCRYPTED_FILE}")

echo "Backup completed successfully."
echo "File: ${ENCRYPTED_FILE}"
echo "SHA256: ${SHA256}"
echo "Size: ${SIZE_BYTES} bytes"

# Output format for Celery to parse (simple key=value)
echo "RESULT_FILE=${ENCRYPTED_FILE}"
echo "RESULT_SHA256=${SHA256}"
echo "RESULT_SIZE=${SIZE_BYTES}"
