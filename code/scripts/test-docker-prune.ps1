# ============================================================
# Test script for docker_prune.ps1
# ============================================================

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$dockerPrune = Join-Path $scriptPath "docker_prune.ps1"

Write-Host "Testing docker_prune.ps1..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Dry run with default threshold
Write-Host "Test 1: Dry run with default threshold" -ForegroundColor Yellow
& $dockerPrune -DryRun
if ($LASTEXITCODE -eq 0) {
    Write-Host "Pass: Dry run test" -ForegroundColor Green
} else {
    Write-Host "Fail: Dry run test" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: Dry run with low threshold
Write-Host "Test 2: Dry run with low threshold" -ForegroundColor Yellow
& $dockerPrune -DryRun -Threshold 10
if ($LASTEXITCODE -eq 0) {
    Write-Host "Pass: Low threshold test" -ForegroundColor Green
} else {
    Write-Host "Fail: Low threshold test" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 3: Check if script exists
if (Test-Path $dockerPrune) {
    Write-Host "Pass: Script exists" -ForegroundColor Green
} else {
    Write-Host "Fail: Script not found" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "All tests passed!" -ForegroundColor Green
