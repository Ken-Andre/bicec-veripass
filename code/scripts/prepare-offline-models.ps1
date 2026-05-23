param(
    [string]$PaddleSource = "$env:USERPROFILE\.paddlex\official_models",
    [string]$GlmSource = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$offlineRoot = Join-Path $repoRoot "infra\models-offline"
$offlinePaddleRoot = Join-Path $offlineRoot "paddlex\official_models"
$offlineGlmRoot = Join-Path $offlineRoot "glm-ocr"

New-Item -ItemType Directory -Force -Path $offlinePaddleRoot | Out-Null
New-Item -ItemType Directory -Force -Path $offlineGlmRoot | Out-Null

if (-not (Test-Path $PaddleSource)) {
    throw "Paddle source not found: $PaddleSource"
}

Write-Host "Copying Paddle models from: $PaddleSource"
Copy-Item -Path (Join-Path $PaddleSource "*") -Destination $offlinePaddleRoot -Recurse -Force

if ($GlmSource -and (Test-Path $GlmSource)) {
    Write-Host "Copying GLM models from: $GlmSource"
    Copy-Item -Path (Join-Path $GlmSource "*") -Destination $offlineGlmRoot -Recurse -Force
}
else {
    Write-Host "GLM source not provided or not found. Skipping GLM copy."
}

Write-Host "Offline model pack prepared at: $offlineRoot"
