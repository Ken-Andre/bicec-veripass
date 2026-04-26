# PowerShell script to decrypt all .env.enc files in the repo to new.env
# Usage: .\code\scripts\decrypt-all-envs.ps1

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$PassFile = Join-Path $RepoRoot ".env.pass"

if (-not (Test-Path $PassFile)) {
    Write-Error "Error: .env.pass not found at $PassFile"
    exit 1
}

$Pass = Get-Content -Raw $PassFile
$DecryptedCount = 0
$ErrorCount = 0

# Find all .env.enc files, excluding node_modules and .venv
$EncFiles = Get-ChildItem -Path $RepoRoot -Filter ".env.enc" -Recurse -File | Where-Object { 
    $_.FullName -notmatch "node_modules" -and $_.FullName -notmatch "\\.venv" 
}

foreach ($File in $EncFiles) {
    $EncFilePath = $File.FullName
    $NewEnvPath = Join-Path (Split-Path $EncFilePath -Parent) "new.env"
    $RelPath = $EncFilePath.Replace($RepoRoot + "\", "")

    try {
        & senv decrypt $EncFilePath -o $NewEnvPath -p $Pass
        Write-Host "  [OK] $RelPath -> $($File.Directory.Name)\new.env" -ForegroundColor Green
        $DecryptedCount++
    } catch {
        Write-Host "  [ERROR] Failed: $RelPath" -ForegroundColor Red
        $ErrorCount++
    }
}

Write-Host "`nDone: $DecryptedCount decrypted, $ErrorCount errors"
if ($ErrorCount -gt 0) { exit 1 }
exit 0
