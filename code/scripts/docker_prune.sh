#!/bin/bash
# ============================================================
# BICEC VeriPass — Docker Disk Space Management Script
# ============================================================
# Purpose: Automatically clean up Docker resources when disk usage exceeds threshold
# Usage: ./docker_prune.sh [--force] [--threshold=85]
# Cron: 0 2 * * * /path/to/docker_prune.sh >> /var/log/docker_prune.log 2>&1

set -euo pipefail

# Configuration
THRESHOLD=${DOCKER_PRUNE_THRESHOLD:-85}
FORCE_MODE=false
LOG_FILE="${DOCKER_PRUNE_LOG:-/var/log/docker_prune.log}"
DRY_RUN=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE_MODE=true
            shift
            ;;
        --threshold=*)
            THRESHOLD="${1#*=}"
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --force              Skip confirmation prompt"
            echo "  --threshold=N        Set disk usage threshold (default: 85%)"
            echo "  --dry-run            Show what would be cleaned without doing it"
            echo "  --help               Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  DOCKER_PRUNE_THRESHOLD    Disk usage threshold (default: 85)"
            echo "  DOCKER_PRUNE_LOG          Log file path (default: /var/log/docker_prune.log)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"
}

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        log "ERROR" "${RED}Docker is not running or not accessible${NC}"
        exit 1
    fi
}

# Get disk usage percentage
get_disk_usage() {
    local docker_root=$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || echo "/var/lib/docker")
    df -h "$docker_root" | awk 'NR==2 {print $5}' | sed 's/%//'
}

# Display current Docker disk usage
show_docker_stats() {
    log "INFO" "Current Docker disk usage:"
    echo ""
    docker system df
    echo ""
}

# Prune Docker resources
prune_docker() {
    local disk_usage=$1
    
    log "INFO" "${YELLOW}Starting Docker cleanup (disk usage: ${disk_usage}%)${NC}"
    
    if [ "$DRY_RUN" = true ]; then
        log "INFO" "${YELLOW}DRY RUN MODE - No actual cleanup will be performed${NC}"
        echo ""
        echo "Would clean non-volume Docker resources:"
        echo "  - stopped containers"
        echo "  - dangling images"
        echo "  - unused networks"
        echo "  - build cache"
        echo "  - Docker volumes: skipped"
        docker system df
        return 0
    fi
    
    # Remove stopped containers
    log "INFO" "Removing stopped containers..."
    docker container prune -f || log "WARN" "Failed to prune containers"
    
    # Remove dangling images
    log "INFO" "Removing dangling images..."
    docker image prune -f || log "WARN" "Failed to prune images"
    
    # Remove unused networks
    log "INFO" "Removing unused networks..."
    docker network prune -f || log "WARN" "Failed to prune networks"
    
    # Never prune volumes automatically: this project stores database backups,
    # PostgreSQL data, and KYC documents in persistent Docker volumes.
    log "INFO" "Skipping volume prune; persistent volumes are never removed automatically."
    
    # Remove build cache
    log "INFO" "Removing build cache..."
    docker builder prune -f || log "WARN" "Failed to prune build cache"
    
    log "INFO" "${GREEN}Docker cleanup completed${NC}"
}

# Main execution
main() {
    log "INFO" "========== Docker Prune Script Started =========="
    
    check_docker
    
    local current_usage=$(get_disk_usage)
    log "INFO" "Current disk usage: ${current_usage}%"
    log "INFO" "Threshold: ${THRESHOLD}%"
    
    show_docker_stats
    
    if [ "$current_usage" -ge "$THRESHOLD" ]; then
        log "WARN" "${YELLOW}Disk usage (${current_usage}%) exceeds threshold (${THRESHOLD}%)${NC}"
        
        if [ "$FORCE_MODE" = false ] && [ "$DRY_RUN" = false ]; then
            echo -e "${YELLOW}Do you want to proceed with cleanup? (y/N)${NC}"
            read -r response
            if [[ ! "$response" =~ ^[Yy]$ ]]; then
                log "INFO" "Cleanup cancelled by user"
                exit 0
            fi
        fi
        
        prune_docker "$current_usage"
        
        # Check disk usage after cleanup
        local new_usage=$(get_disk_usage)
        local freed=$((current_usage - new_usage))
        log "INFO" "${GREEN}Cleanup complete. Freed ${freed}% disk space${NC}"
        log "INFO" "New disk usage: ${new_usage}%"
        
        show_docker_stats
    else
        log "INFO" "${GREEN}Disk usage is below threshold. No cleanup needed.${NC}"
    fi
    
    log "INFO" "========== Docker Prune Script Finished =========="
}

# Run main function
main
