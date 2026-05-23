# ============================================================
# BICEC VeriPass — Docker Disk Space Management Script (Windows)
# ============================================================
# Purpose: Automatically clean up Docker resources when disk usage exceeds threshold
# Usage: .\docker_prune.ps1 [-Force] [-Threshold 85] [-DryRun]
# Task Scheduler: Run daily at 2 AM

param(
    [switch]$Force,
    [int]$Threshold = 85,
    [switch]$DryRun,
    [string]$LogFile = "$PSScriptRoot\..\logs\docker_prune.log"
)

# Ensure log directory exists
$logDir = Split-Path -Parent $LogFile
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# Logging function
function Write-Log {
    param(
        [string]$Level,
        [string]$Message
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "$timestamp [$Level] $Message"
    Write-Host $logMessage
    Add-Content -Path $LogFile -Value $logMessage
}

# Check if Docker is running
function Test-Docker {
    try {
        docker info | Out-Null
        return $true
    }
    catch {
        Write-Log "ERROR" "Docker is not running or not accessible"
        return $false
    }
}

# Get disk usage percentage for Docker drive
function Get-DiskUsage {
    try {
        $dockerInfo = docker info --format "{{.DockerRootDir}}" 2>$null
        if (-not $dockerInfo) {
            $dockerInfo = "C:\"
        }
        
        $drive = ($dockerInfo -split ':')[0] + ":"
        $disk = Get-PSDrive -Name ($drive -replace ':', '') -ErrorAction SilentlyContinue
        
        if ($disk) {
            $usedPercent = [math]::Round((($disk.Used / ($disk.Used + $disk.Free)) * 100), 2)
            return $usedPercent
        }
        return 0
    }
    catch {
        Write-Log "WARN" "Could not determine disk usage: $_"
        return 0
    }
}

# Display current Docker disk usage
function Show-DockerStats {
    Write-Log "INFO" "Current Docker disk usage:"
    docker system df
}

# Prune Docker resources
function Invoke-DockerPrune {
    param([double]$DiskUsage)
    
    Write-Log "INFO" "Starting Docker cleanup (disk usage: $DiskUsage%)"
    
    if ($DryRun) {
        Write-Log "INFO" "DRY RUN MODE - No actual cleanup will be performed"
        Write-Host "`nWould remove:"
        docker system df
        return
    }
    
    # Remove stopped containers
    Write-Log "INFO" "Removing stopped containers..."
    try { docker container prune -f | Out-Null } catch { Write-Log "WARN" "Failed to prune containers" }
    
    # Remove dangling images
    Write-Log "INFO" "Removing dangling images..."
    try { docker image prune -f | Out-Null } catch { Write-Log "WARN" "Failed to prune images" }
    
    # Remove unused networks
    Write-Log "INFO" "Removing unused networks..."
    try { docker network prune -f | Out-Null } catch { Write-Log "WARN" "Failed to prune networks" }
    
    # Remove unused volumes
    Write-Log "INFO" "Removing unused volumes..."
    try { docker volume prune -f | Out-Null } catch { Write-Log "WARN" "Failed to prune volumes" }
    
    # Remove build cache
    Write-Log "INFO" "Removing build cache..."
    try { docker builder prune -f | Out-Null } catch { Write-Log "WARN" "Failed to prune build cache" }
    
    Write-Log "INFO" "Docker cleanup completed"
}

# Main execution
function Main {
    Write-Log "INFO" "========== Docker Prune Script Started =========="
    
    if (-not (Test-Docker)) {
        exit 1
    }
    
    $currentUsage = Get-DiskUsage
    Write-Log "INFO" "Current disk usage: $currentUsage%"
    Write-Log "INFO" "Threshold: $Threshold%"
    
    Show-DockerStats
    
    if ($currentUsage -ge $Threshold) {
        Write-Log "WARN" "Disk usage ($currentUsage%) exceeds threshold ($Threshold%)"
        
        if (-not $Force -and -not $DryRun) {
            $response = Read-Host "Do you want to proceed with cleanup? (y/N)"
            if ($response -notmatch '^[Yy]$') {
                Write-Log "INFO" "Cleanup cancelled by user"
                exit 0
            }
        }
        
        Invoke-DockerPrune -DiskUsage $currentUsage
        
        # Check disk usage after cleanup
        $newUsage = Get-DiskUsage
        $freed = [math]::Round($currentUsage - $newUsage, 2)
        Write-Log "INFO" "Cleanup complete. Freed $freed% disk space"
        Write-Log "INFO" "New disk usage: $newUsage%"
        
        Show-DockerStats
    }
    else {
        Write-Log "INFO" "Disk usage is below threshold. No cleanup needed."
    }
    
    Write-Log "INFO" "========== Docker Prune Script Finished =========="
}

# Run main function
Main
