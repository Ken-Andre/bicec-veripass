# Generate self-signed certificates for TLS development
# PowerShell script for Windows

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CertsDir = Join-Path $ScriptDir "certs"

Write-Host "Generating self-signed TLS certificates..." -ForegroundColor Cyan

# Create certs folder if it doesn't exist
if (!(Test-Path $CertsDir)) {
    New-Item -ItemType Directory -Path $CertsDir -Force | Out-Null
}

# Use OpenSSL via Docker to generate certificates (most compatible with Nginx)
docker run --rm -v "${CertsDir}:/certs" alpine/openssl req `
    -x509 -nodes -days 365 `
    -newkey rsa:2048 `
    -keyout /certs/nginx-selfsigned.key `
    -out /certs/nginx-selfsigned.crt `
    -subj "/C=CM/ST=Centre/L=Yaounde/O=BICEC/OU=VeriPass/CN=localhost"

# Verify files were created
$certPath = Join-Path $CertsDir "nginx-selfsigned.crt"
$keyPath = Join-Path $CertsDir "nginx-selfsigned.key"

if ((Test-Path $certPath) -and (Test-Path $keyPath)) {
    Write-Host "Certificates generated in $CertsDir" -ForegroundColor Green
    Write-Host "   - nginx-selfsigned.crt (public certificate)" -ForegroundColor Gray
    Write-Host "   - nginx-selfsigned.key (private key)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Browser warning: normal for self-signed certificate" -ForegroundColor Yellow
} else {
    Write-Host "Error generating certificates" -ForegroundColor Red
    exit 1
}