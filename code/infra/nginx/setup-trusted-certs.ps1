param(
    [string[]]$Hosts = @()
)

# Generate trusted TLS certificates using mkcert.
# Run this on the Windows host. Install the mkcert root CA on phones that must
# trust https://<LAN-or-Tailscale-IP>/mobile/.

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CertsDir = Join-Path $ScriptDir "ssl"

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

$detectedHosts = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
        $_.AddressState -eq "Preferred" -and
        $_.IPAddress -notmatch "^(127\.|169\.254\.)"
    } |
    Select-Object -ExpandProperty IPAddress

$certificateHosts = @("localhost", "127.0.0.1", "::1") + $detectedHosts + $Hosts |
    Where-Object { $_ } |
    Select-Object -Unique

Write-Host "Generating trusted certificates for: $($certificateHosts -join ', ')" -ForegroundColor Cyan
# Generate into the ssl folder using the names Nginx expects.
mkcert -key-file "$CertsDir/key.pem" -cert-file "$CertsDir/cert.pem" $certificateHosts

Write-Host "TRUSTED Certificates generated successfully!" -ForegroundColor Green
Write-Host "Nginx files:" -ForegroundColor Gray
Write-Host "   - $CertsDir/cert.pem" -ForegroundColor Gray
Write-Host "   - $CertsDir/key.pem" -ForegroundColor Gray
Write-Host "Install this mkcert CA on test phones, then restart Nginx:" -ForegroundColor Yellow
Write-Host "   mkcert -CAROOT" -ForegroundColor Gray
Write-Host "   docker compose -f code/docker-compose.yml up -d --force-recreate nginx" -ForegroundColor White
