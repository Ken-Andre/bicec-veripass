# Generate trusted TLS certificates using mkcert
# Run this on your host machine (Windows)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CertsDir = Join-Path $ScriptDir "certs"

if (!(Test-Path $CertsDir)) {
    New-Item -ItemType Directory -Path $CertsDir -Force | Out-Null
}

Write-Host "Checking for mkcert..." -ForegroundColor Cyan

if (!(Get-Command mkcert -ErrorAction SilentlyContinue)) {
    Write-Host "Error: mkcert NOT FOUND." -ForegroundColor Red
    Write-Host "To install mkcert on Windows:" -ForegroundColor Yellow
    Write-Host "1. Open PowerShell as ADMIN" -ForegroundColor Gray
    Write-Host "2. Run: choco install mkcert" -ForegroundColor Gray
    Write-Host "3. Run: mkcert -install" -ForegroundColor Gray
    Write-Host "Then restart this script." -ForegroundColor White
    exit 1
}

Write-Host "Enabling CA trust (may ask for admin permission)..." -ForegroundColor Cyan
mkcert -install

Write-Host "Generating trusted certificates for localhost..." -ForegroundColor Cyan
# Generate into the certs folder using the names Nginx expects
mkcert -key-file "$CertsDir/nginx-selfsigned.key" -cert-file "$CertsDir/nginx-selfsigned.crt" localhost 127.0.0.1 ::1

Write-Host "TRUSTED Certificates generated successfully!" -ForegroundColor Green
Write-Host "Restart Nginx to apply: docker-compose restart nginx" -ForegroundColor White
