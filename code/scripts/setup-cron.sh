#!/bin/bash
# ============================================================
# BICEC VeriPass — Setup Cron Job for Docker Prune
# ============================================================
# Usage: sudo ./setup-cron.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_PRUNE_SCRIPT="${SCRIPT_DIR}/docker_prune.sh"
LOG_FILE="/var/log/docker_prune.log"
CRON_SCHEDULE="0 2 * * *"  # Daily at 2 AM

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (sudo)"
    exit 1
fi

# Ensure script is executable
chmod +x "$DOCKER_PRUNE_SCRIPT"

# Create log file with proper permissions
touch "$LOG_FILE"
chmod 644 "$LOG_FILE"

# Create cron job
CRON_JOB="$CRON_SCHEDULE $DOCKER_PRUNE_SCRIPT --force >> $LOG_FILE 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$DOCKER_PRUNE_SCRIPT"; then
    echo "Cron job already exists. Updating..."
    crontab -l 2>/dev/null | grep -v "$DOCKER_PRUNE_SCRIPT" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✓ Cron job installed successfully"
echo "  Schedule: Daily at 2:00 AM"
echo "  Script: $DOCKER_PRUNE_SCRIPT"
echo "  Log: $LOG_FILE"
echo ""
echo "To view cron jobs: crontab -l"
echo "To remove: crontab -e (then delete the line)"
echo "To test manually: $DOCKER_PRUNE_SCRIPT --dry-run"
