#!/bin/sh

# ============================================================
# BICEC VeriPass — Docker Disk Prune Script
# ============================================================
# Goal: Reclaim disk space if usage is > 85%
# Crons: This script is intended to be run daily.
# ============================================================

THRESHOLD=85
LOG_FILE="/var/log/docker_prune.log"

# Check disk usage of the partition where /var/lib/docker or current dir is
# Using . because we assume we are monitoring the volume space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')

echo "[$(date)] Current disk usage: ${DISK_USAGE}%" >> ${LOG_FILE}

if [ "${DISK_USAGE}" -gt "${THRESHOLD}" ]; then
    echo "[$(date)] Usage above ${THRESHOLD}%. Running docker system prune..." >> ${LOG_FILE}
    # -f: force, no confirmation
    # --volumes: also remove unused volumes (caution)
    # For MVP, we'll start with a safe prune (unused images, containers, networks)
    docker system prune -f >> ${LOG_FILE} 2>&1
    
    # Optional: remove unused volumes if still high (uncomment with care)
    # docker volume prune -f >> ${LOG_FILE} 2>&1
    
    echo "[$(date)] Prune complete." >> ${LOG_FILE}
else
    echo "[$(date)] Usage within limits. No action taken." >> ${LOG_FILE}
fi
