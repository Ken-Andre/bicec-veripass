# PostToolUse Hook: run-tests (PowerShell)
# Lance automatiquement les tests après modification de code

$input = [Console]::In.ReadToEnd() | ConvertFrom-Json
$tool = $input.postToolUse.tool
$success = $input.postToolUse.success
$filePath = $input.postToolUse.parameters.path

# Vérifier si un fichier de test ou de code a été modifié
if ($tool -eq "write_to_file" -and $success -eq $true) {
    # Si c'est un fichier Python de test ou de code
    if ($filePath -like "*.py") {
        # Vérifier si c'est un fichier de test
        if ($filePath -like "*test*") {
            Write-Host "🧪 Exécution des tests Python..." -ForegroundColor Cyan
            $testDir = Split-Path -Parent $filePath
            Set-Location $testDir
            $output = python -m pytest -v --tb=short 2>&1 | Select-Object -First 50
            Write-Host $output
        }
    }
    
    # Si c'est un fichier TypeScript/JavaScript
    if ($filePath -like "*.ts" -or $filePath -like "*.tsx" -or $filePath -like "*.jsx") {
        Write-Host "🧪 Exécution des tests JavaScript/TypeScript..." -ForegroundColor Cyan
        $output = npm test -- --watchAll=false 2>&1 | Select-Object -First 50
        Write-Host $output
    }
}

Write-Output '{"cancel":false}'