param(
    [string]$ComposeFile = "code/docker-compose.yml",
    [string]$ApiUrl = "http://localhost:8001",
    [string]$MobileUrl = "http://localhost:3000/mobile/",
    [string]$BackofficeUrl = "http://localhost:3001/"
)

$ErrorActionPreference = "Stop"

function Assert-Ok($Name, [scriptblock]$Check) {
    Write-Host "[MVP smoke] $Name ..." -NoNewline
    try {
        & $Check | Out-Null
        Write-Host " OK" -ForegroundColor Green
    } catch {
        Write-Host " FAIL" -ForegroundColor Red
        throw
    }
}

Assert-Ok "Docker services" {
    docker compose -f $ComposeFile ps --status running
}

Assert-Ok "API health" {
    $health = Invoke-RestMethod -Uri "$ApiUrl/api/health" -TimeoutSec 10
    if ($health.status -ne "ok" -or $health.db -ne "ok" -or $health.redis -ne "ok") {
        throw "Unexpected health response: $($health | ConvertTo-Json -Compress)"
    }
}

Assert-Ok "Alembic current=head" {
    $current = docker compose -f $ComposeFile exec -T api alembic current
    if ($current -notmatch "head") {
        throw "Alembic is not at head: $current"
    }
}

Assert-Ok "Mobile PWA HTTP 200" {
    $status = (Invoke-WebRequest -UseBasicParsing -Uri $MobileUrl -TimeoutSec 10).StatusCode
    if ($status -ne 200) { throw "Mobile returned HTTP $status" }
}

Assert-Ok "Backoffice HTTP 200" {
    $status = (Invoke-WebRequest -UseBasicParsing -Uri $BackofficeUrl -TimeoutSec 10).StatusCode
    if ($status -ne 200) { throw "Backoffice returned HTTP $status" }
}

Write-Host "[MVP smoke] Base Docker/offline checks passed." -ForegroundColor Green
