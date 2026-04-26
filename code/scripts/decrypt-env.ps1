# PowerShell script to decrypt .env.enc to .env in the current directory
# Usage: .\code\scripts\decrypt-env.ps1

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$PassFile = Join-Path $RepoRoot ".env.pass"

if (-not (Test-Path ".env.enc")) {
    Write-Error "Error: .env.enc file not found in current directory"
    exit 1
}

if (-not (Test-Path $PassFile)) {
    Write-Error "Error: .env.pass not found at $PassFile"
    exit 1
}

$Pass = Get-Content -Raw $PassFile
try {
    & senv decrypt .env.enc -o .env -p $Pass
    Write-Host "  [OK] Decrypted .env.enc -> .env" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Decryption failed" -ForegroundColor Red
    exit 1
}
