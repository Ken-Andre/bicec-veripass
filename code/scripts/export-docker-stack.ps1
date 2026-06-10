#Requires -Version 5.1
<#
Exports a runnable VeriPass Docker handoff bundle.

This is intentionally different from backup-docker-images.ps1:
- Docker images are only the executable layers.
- Docker volumes contain PostgreSQL, Redis, uploaded documents, model caches, and backups.
- Compose/runtime files are needed so Docker Desktop recreates the same multi-service stack.

Usage from the repository root:
  powershell -ExecutionPolicy Bypass -File code\scripts\export-docker-stack.ps1 -IncludeEnv

The generated .tar.gz is meant to be extracted on another machine, then restored with:
  powershell -ExecutionPolicy Bypass -File .\import-docker-stack.ps1
#>

[CmdletBinding()]
param(
    [string]$OutputRoot,
    [string]$ProjectName = "code",
    [switch]$IncludeEnv,
    [switch]$IncludePublicDemo,
    [switch]$KeepRunning,
    [switch]$NoArchive
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$RepoDir = Split-Path -Parent $ProjectDir
$ComposeFile = Join-Path $ProjectDir "docker-compose.yml"

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    $OutputRoot = Join-Path $ProjectDir "backups\docker-stack"
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$File,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$FailureMessage
    )

    & $File @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw $FailureMessage
    }
}

function Test-Docker {
    & docker version --format "{{.Server.Version}}" *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker is not running or is not accessible."
    }
}

function Copy-ProjectPath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $source = Join-Path $ProjectDir $RelativePath
    if (-not (Test-Path $source)) {
        Write-Warning "Runtime path not found, skipping: code\$RelativePath"
        return
    }

    $destination = Join-Path $BundleCodeDir $RelativePath
    $parent = Split-Path -Parent $destination
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    Copy-Item -Path $source -Destination $destination -Recurse -Force
}

function Copy-RepoPath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $source = Join-Path $RepoDir $RelativePath
    if (-not (Test-Path $source)) {
        Write-Warning "Runtime path not found, skipping: $RelativePath"
        return
    }

    $destination = Join-Path $BundleDir $RelativePath
    $parent = Split-Path -Parent $destination
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    Copy-Item -Path $source -Destination $destination -Recurse -Force
}

function Get-EnvOrDefault {
    param(
        [string]$Value,
        [Parameter(Mandatory = $true)][string]$Default
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $Default
    }
    return $Value
}

Test-Docker

if (-not (Test-Path $ComposeFile)) {
    throw "Compose file not found: $ComposeFile"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BundleName = "veripass-stack-$timestamp"
$BundleDir = Join-Path $OutputRoot $BundleName
$BundleCodeDir = Join-Path $BundleDir "code"
$ImagesDir = Join-Path $BundleDir "images"
$VolumesDir = Join-Path $BundleDir "volumes"

New-Item -ItemType Directory -Path $BundleCodeDir -Force | Out-Null
New-Item -ItemType Directory -Path $ImagesDir -Force | Out-Null
New-Item -ItemType Directory -Path $VolumesDir -Force | Out-Null

Write-Host "=== VeriPass Docker stack export ==="
Write-Host "Bundle: $BundleDir"
Write-Host ""

$composeArgs = @("compose", "-f", $ComposeFile, "--project-name", $ProjectName)

$runningContainers = @(& docker @composeArgs "ps" "-q" "--status" "running")
$shouldRestart = $false

if (($runningContainers.Count -gt 0) -and (-not $KeepRunning)) {
    Write-Host "Stopping Compose stack before exporting volumes for a consistent snapshot..."
    Invoke-Checked -File "docker" -Arguments ($composeArgs + @("stop")) -FailureMessage "Failed to stop the Compose stack."
    $shouldRestart = $true
}
elseif (($runningContainers.Count -gt 0) -and $KeepRunning) {
    Write-Warning "Stack is still running. PostgreSQL/Redis volume snapshots may be inconsistent."
}

try {
    Write-Host "Collecting image list from docker compose config..."
    $imageCandidates = @(& docker @composeArgs "config" "--images" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to read image list from Compose."
    }

    $profileImageCandidates = @("${ProjectName}-model_init")
    if ($IncludePublicDemo) {
        $profileImageCandidates += "cloudflare/cloudflared:latest"
    }

    $imageCandidates = @($imageCandidates + $profileImageCandidates | Sort-Object -Unique)
    $availableImages = @()

    foreach ($image in $imageCandidates) {
        & docker image inspect $image *> $null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [image] $image"
            $availableImages += $image
        }
        else {
            Write-Warning "Image not found locally, skipping: $image"
        }
    }

    if ($availableImages.Count -eq 0) {
        throw "No Docker images were found to export."
    }

    $imageTar = Join-Path $ImagesDir "veripass-images.tar"
    Write-Host ""
    Write-Host "Saving Docker images..."
    Invoke-Checked -File "docker" -Arguments (@("save", "-o", $imageTar) + $availableImages) -FailureMessage "docker save failed."

    Write-Host ""
    Write-Host "Copying runtime Compose files and bind-mounted assets..."
    Copy-ProjectPath "docker-compose.yml"
    Copy-ProjectPath "docker-compose.test.yml"
    Copy-ProjectPath ".env.example"
    Copy-ProjectPath "db"
    Copy-ProjectPath "infra\nginx"
    Copy-ProjectPath "infra\models-offline"
    Copy-ProjectPath "backend\alembic\versions"
    Copy-ProjectPath "scripts\ensure_docker_volumes.ps1"
    Copy-ProjectPath "scripts\ensure_docker_volumes.sh"
    Copy-ProjectPath "scripts\import-docker-stack.ps1"
    Copy-RepoPath "paddleocr_test\images"

    $envPath = Join-Path $ProjectDir ".env"
    if ($IncludeEnv) {
        if (Test-Path $envPath) {
            Copy-Item -Path $envPath -Destination (Join-Path $BundleCodeDir ".env") -Force
            Write-Warning "code\.env was included. Treat this bundle as sensitive."
        }
        else {
            Write-Warning "IncludeEnv was requested, but code\.env was not found."
        }
    }
    else {
        Write-Warning "code\.env was not included. The recipient must create code\.env before starting the stack."
    }

    $rootImportScript = Join-Path $BundleDir "import-docker-stack.ps1"
    Copy-Item -Path (Join-Path $ScriptDir "import-docker-stack.ps1") -Destination $rootImportScript -Force

    Write-Host ""
    Write-Host "Exporting Docker volumes..."

    $documentsVolume = Get-EnvOrDefault -Value $env:VP_DOCUMENTS_VOLUME_NAME -Default "code_documents_storage"
    $dbVolume = Get-EnvOrDefault -Value $env:VP_DB_VOLUME_NAME -Default "code_db_storage"
    $dbBackupsVolume = Get-EnvOrDefault -Value $env:VP_DB_BACKUPS_VOLUME_NAME -Default "code_db_backups"

    $volumeCandidates = @(
        @{ Name = $documentsVolume; Purpose = "documents_storage" },
        @{ Name = $dbVolume; Purpose = "db_storage" },
        @{ Name = $dbBackupsVolume; Purpose = "db_backups" },
        @{ Name = "${ProjectName}_models_storage"; Purpose = "models_storage" },
        @{ Name = "${ProjectName}_models_paddlex_storage"; Purpose = "models_paddlex_storage" },
        @{ Name = "${ProjectName}_redis_data"; Purpose = "redis_data" },
        @{ Name = "${ProjectName}_nginx_certs"; Purpose = "nginx_certs" }
    )

    $exportedVolumes = @()

    foreach ($volume in $volumeCandidates) {
        $volumeName = $volume.Name
        & docker volume inspect $volumeName *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Volume not found locally, skipping: $volumeName"
            continue
        }

        $archiveName = ($volumeName -replace '[^A-Za-z0-9_.-]', '_') + ".tar.gz"
        $tarCommand = "tar -czf /backup/$archiveName -C /volume ."
        Write-Host "  [volume] $volumeName -> volumes\$archiveName"

        Invoke-Checked `
            -File "docker" `
            -Arguments @("run", "--rm", "-v", "${volumeName}:/volume:ro", "-v", "${VolumesDir}:/backup", "postgres:17-bookworm", "bash", "-lc", $tarCommand) `
            -FailureMessage "Failed to export Docker volume: $volumeName"

        $archivePath = Join-Path $VolumesDir $archiveName
        $exportedVolumes += [pscustomobject]@{
            name = $volumeName
            purpose = $volume.Purpose
            archive = $archiveName
            sha256 = (Get-FileHash -Algorithm SHA256 -Path $archivePath).Hash
            sizeBytes = (Get-Item $archivePath).Length
        }
    }

    if ($exportedVolumes.Count -eq 0) {
        throw "No Docker volumes were exported."
    }

    $manifest = [pscustomobject]@{
        exportedAt = (Get-Date).ToString("o")
        projectName = $ProjectName
        envIncluded = [bool]$IncludeEnv
        images = $availableImages
        volumes = $exportedVolumes
        restoreCommand = "powershell -ExecutionPolicy Bypass -File .\import-docker-stack.ps1"
        startCommand = "cd code; docker compose -f docker-compose.yml --project-name $ProjectName up --no-build -d"
        notes = @(
            "docker load restores images only; it does not restore volumes or Compose project state.",
            "Restore volumes before starting Compose.",
            "Use --project-name code to recreate the same Docker Desktop project grouping."
        )
    }

    $manifestPath = Join-Path $BundleDir "manifest.json"
    $volumesManifestPath = Join-Path $VolumesDir "manifest.json"
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding UTF8
    [pscustomobject]@{ volumes = $exportedVolumes } | ConvertTo-Json -Depth 6 | Set-Content -Path $volumesManifestPath -Encoding UTF8

    $readme = @"
# VeriPass Docker handoff bundle

This bundle is a complete Docker handoff package.

It contains:
- Docker images in images/veripass-images.tar
- Docker volume archives in volumes/
- Runtime Compose files and bind-mounted assets in code/
- A restore script: import-docker-stack.ps1

## Restore on the recipient machine

Prerequisites:
- Docker Desktop running
- PowerShell
- Enough free disk space for the images and restored volumes

From the extracted bundle root:

```powershell
powershell -ExecutionPolicy Bypass -File .\import-docker-stack.ps1
```

If Docker volumes with the same names already exist on the recipient machine, the script stops before replacing them.
For a clean lab machine this is normally not an issue.

To replace existing VeriPass volumes deliberately:

```powershell
powershell -ExecutionPolicy Bypass -File .\import-docker-stack.ps1 -ReplaceVolumes
```

## Important

Running `docker load -i images\veripass-images.tar` alone is not enough.
It restores images only. The database, Redis data, uploaded documents, model caches, and backup files live in Docker volumes.

The restored stack must be started with Compose:

```powershell
cd code
docker compose -f docker-compose.yml --project-name code up --no-build -d
```

Do not start each image manually from Docker Desktop. Manual `Run` creates isolated containers with different names, no shared network, no Compose dependencies, and missing volume wiring.
"@

    $readme | Set-Content -Path (Join-Path $BundleDir "README.md") -Encoding UTF8

    if (-not $NoArchive) {
        $archivePath = Join-Path $OutputRoot "$BundleName.tar.gz"
        Write-Host ""
        Write-Host "Creating final archive: $archivePath"
        Invoke-Checked -File "tar" -Arguments @("-czf", $archivePath, "-C", $OutputRoot, $BundleName) -FailureMessage "Failed to create final .tar.gz archive."

        $sha = (Get-FileHash -Algorithm SHA256 -Path $archivePath).Hash
        $sizeGb = [math]::Round((Get-Item $archivePath).Length / 1GB, 2)
        Write-Host ""
        Write-Host "Export complete."
        Write-Host "Archive: $archivePath"
        Write-Host "SHA256: $sha"
        Write-Host "Size: ${sizeGb} GB"
    }
    else {
        Write-Host ""
        Write-Host "Export complete."
        Write-Host "Bundle directory: $BundleDir"
    }
}
finally {
    if ($shouldRestart) {
        Write-Host ""
        Write-Host "Restarting local Compose stack..."
        & docker @composeArgs "up" "-d"
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "The export finished, but restarting the local stack failed. Run: docker compose -f `"$ComposeFile`" --project-name $ProjectName up -d"
        }
    }
}
