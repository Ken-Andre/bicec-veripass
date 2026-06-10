#Requires -Version 5.1
<#
Restores a VeriPass Docker handoff bundle created by export-docker-stack.ps1.

Run from the extracted bundle root:
  powershell -ExecutionPolicy Bypass -File .\import-docker-stack.ps1

This script loads Docker images, restores Docker volumes, then starts the Compose stack.
#>

[CmdletBinding()]
param(
    [string]$BundleDir = (Get-Location).Path,
    [string]$ProjectName = "code",
    [switch]$ReplaceVolumes,
    [switch]$SkipVolumes,
    [switch]$NoStart
)

$ErrorActionPreference = "Stop"

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

$BundleDir = (Resolve-Path $BundleDir).Path
$CodeDir = Join-Path $BundleDir "code"
$ComposeFile = Join-Path $CodeDir "docker-compose.yml"
$ImagesTar = Join-Path $BundleDir "images\veripass-images.tar"
$VolumesDir = Join-Path $BundleDir "volumes"
$VolumesManifest = Join-Path $VolumesDir "manifest.json"

Test-Docker

if (-not (Test-Path $CodeDir)) {
    throw "Bundle code directory not found: $CodeDir"
}
if (-not (Test-Path $ComposeFile)) {
    throw "Compose file not found in bundle: $ComposeFile"
}
if (-not (Test-Path $ImagesTar)) {
    throw "Docker image archive not found: $ImagesTar"
}

Write-Host "=== VeriPass Docker stack restore ==="
Write-Host "Bundle: $BundleDir"
Write-Host ""

Write-Host "Loading Docker images..."
Invoke-Checked -File "docker" -Arguments @("load", "-i", $ImagesTar) -FailureMessage "docker load failed."

if (-not $SkipVolumes) {
    if (-not (Test-Path $VolumesManifest)) {
        throw "Volume manifest not found: $VolumesManifest"
    }

    $manifest = Get-Content -Path $VolumesManifest -Raw | ConvertFrom-Json
    if ($null -eq $manifest.volumes -or $manifest.volumes.Count -eq 0) {
        throw "Volume manifest contains no volumes."
    }

    Write-Host ""
    Write-Host "Restoring Docker volumes..."

    foreach ($volume in $manifest.volumes) {
        $name = [string]$volume.name
        $archive = [string]$volume.archive
        $archivePath = Join-Path $VolumesDir $archive

        if (-not (Test-Path $archivePath)) {
            throw "Volume archive missing: $archivePath"
        }

        & docker volume inspect $name *> $null
        $volumeExists = ($LASTEXITCODE -eq 0)

        if ($volumeExists -and (-not $ReplaceVolumes)) {
            throw "Docker volume already exists: $name. Re-run with -ReplaceVolumes only if you deliberately want to overwrite the recipient machine's VeriPass data."
        }

        if ($volumeExists -and $ReplaceVolumes) {
            Write-Warning "Replacing existing Docker volume: $name"
            Invoke-Checked -File "docker" -Arguments @("volume", "rm", $name) -FailureMessage "Failed to remove existing volume: $name. Stop containers using it first."
        }

        Invoke-Checked -File "docker" -Arguments @("volume", "create", $name) -FailureMessage "Failed to create Docker volume: $name"

        $tarCommand = "cd /volume && tar -xzf /backup/$archive"
        Write-Host "  [volume] $name <- volumes\$archive"
        Invoke-Checked `
            -File "docker" `
            -Arguments @("run", "--rm", "-v", "${name}:/volume", "-v", "${VolumesDir}:/backup:ro", "postgres:17-bookworm", "bash", "-lc", $tarCommand) `
            -FailureMessage "Failed to restore Docker volume: $name"
    }
}

if ($NoStart) {
    Write-Host ""
    Write-Host "Restore complete. Stack start skipped because -NoStart was provided."
    exit 0
}

$envPath = Join-Path $CodeDir ".env"
if (-not (Test-Path $envPath)) {
    throw "code\.env is missing from this bundle. Create it from code\.env.example, then re-run with -SkipVolumes if volumes were already restored."
}

Write-Host ""
Write-Host "Starting Compose stack with project name '$ProjectName'..."
Push-Location $CodeDir
try {
    Invoke-Checked -File "docker" -Arguments @("compose", "-f", "docker-compose.yml", "--project-name", $ProjectName, "up", "--no-build", "-d") -FailureMessage "docker compose up failed."
    & docker compose -f "docker-compose.yml" --project-name $ProjectName ps
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Restore complete."
Write-Host "Open https://localhost after Docker reports the services healthy."
