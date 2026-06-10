# ============================================================
# BICEC VeriPass - non-destructive Docker volume bootstrap
# ============================================================
# Creates missing persistent volumes with retention labels.
# Existing volumes are never recreated, migrated, or relabeled.

param(
    [string]$DocumentsVolumeName = $env:VP_DOCUMENTS_VOLUME_NAME,
    [string]$DbVolumeName = $env:VP_DB_VOLUME_NAME,
    [string]$DbBackupsVolumeName = $env:VP_DB_BACKUPS_VOLUME_NAME
)

if ([string]::IsNullOrWhiteSpace($DocumentsVolumeName)) {
    $DocumentsVolumeName = "code_documents_storage"
}
if ([string]::IsNullOrWhiteSpace($DbVolumeName)) {
    $DbVolumeName = "code_db_storage"
}
if ([string]::IsNullOrWhiteSpace($DbBackupsVolumeName)) {
    $DbBackupsVolumeName = "code_db_backups"
}

function Test-Docker {
    docker version --format "{{.Server.Version}}" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker is not running or is not accessible."
    }
}

function Ensure-Volume {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Type
    )

    docker volume inspect $Name *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Volume exists, leaving untouched: $Name"
        return
    }

    Write-Host "Creating missing persistent volume: $Name"
    docker volume create `
        --label "com.bicec.retention=10y" `
        --label "com.bicec.type=$Type" `
        $Name | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create Docker volume: $Name"
    }
}

Test-Docker
Ensure-Volume -Name $DocumentsVolumeName -Type "pii-documents"
Ensure-Volume -Name $DbVolumeName -Type "pii-database"
Ensure-Volume -Name $DbBackupsVolumeName -Type "backup"
Write-Host "Critical Docker volumes are present."
