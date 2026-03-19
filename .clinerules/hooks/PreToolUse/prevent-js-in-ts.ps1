# PreToolUse Hook: prevent-js-in-ts (PowerShell)
# Empêche la création de fichiers .js dans un projet TypeScript

$input = [Console]::In.ReadToEnd() | ConvertFrom-Json
$tool = $input.preToolUse.tool
$filePath = $input.preToolUse.parameters.path

if ($tool -eq "write_to_file" -and $filePath -like "*.js") {
    # Vérifier si c'est un projet TypeScript
    if (Test-Path "tsconfig.json") {
        Write-Output '{"cancel":true,"errorMessage":"Utilisez des fichiers .ts au lieu de .js dans ce projet TypeScript"}'
        exit 0
    }
}

Write-Output '{"cancel":false}'