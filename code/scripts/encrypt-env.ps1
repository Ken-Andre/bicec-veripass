# PowerShell script to encrypt .env to .env.enc in the current directory
# Usage: .\code\scripts\encrypt-env.ps1

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$PassFile = Join-Path $RepoRoot ".env.pass"

if (-not (Test-Path ".env")) {
    Write-Error "Error: .env file not found in current directory"
    exit 1
}

if (-not (Test-Path $PassFile)) {
    Write-Error "Error: .env.pass not found at $PassFile"
    exit 1
}

$Pass = Get-Content -Raw $PassFile
try {
    & senv encrypt .env -o .env.enc -p $Pass
    Write-Host "  [OK] Encrypted .env -> .env.enc" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Encryption failed" -ForegroundColor Red
    exit 1
}
