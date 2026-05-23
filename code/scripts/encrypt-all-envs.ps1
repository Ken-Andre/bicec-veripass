# PowerShell script to encrypt all .env files in the repo to .env.enc
# Usage: .\code\scripts\encrypt-all-envs.ps1

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$PassFile = Join-Path $RepoRoot ".env.pass"

if (-not (Test-Path $PassFile)) {
    Write-Error "Error: .env.pass not found at $PassFile"
    Write-Host "Create it with: openssl rand -base64 32 | Out-File -FilePath $PassFile -NoNewline"
    exit 1
}

$Pass = Get-Content -Raw $PassFile
$EncryptedCount = 0
$ErrorCount = 0

# Find all .env files, excluding node_modules and .venv
$EnvFiles = Get-ChildItem -Path $RepoRoot -Filter ".env" -Recurse -File | Where-Object { 
    $_.FullName -notmatch "node_modules" -and $_.FullName -notmatch "\\.venv" 
}

foreach ($File in $EnvFiles) {
    $EnvFilePath = $File.FullName
    $EncFilePath = "$EnvFilePath.enc"
    $RelPath = $EnvFilePath.Replace($RepoRoot + "\", "")

    try {
        & senv encrypt $EnvFilePath -o $EncFilePath -p $Pass
        Write-Host "  [OK] $RelPath -> $($RelPath).enc" -ForegroundColor Green
        $EncryptedCount++
    } catch {
        Write-Host "  [ERROR] Failed: $RelPath" -ForegroundColor Red
        $ErrorCount++
    }
}

Write-Host "`nDone: $EncryptedCount encrypted, $ErrorCount errors"
if ($ErrorCount -gt 0) { exit 1 }
exit 0
