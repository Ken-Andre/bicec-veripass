<#
.SYNOPSIS
    Render Mermaid diagrams from the master document to SVG (and optional PDF).

.DESCRIPTION
    Pre-requisites:
      - Node.js 18+
      - npm i -g @mermaid-js/mermaid-cli   (binary: mmdc)
      - For -Pdf: pandoc + chrome-headless-shell (from puppeteer cache)
      - Python 3 (used by rename_mermaid.py and normalize_mermaid.py)

    Inputs:
      ..\BICEC-VERIPASS-VUE-ENSEMBLE.md

    Outputs:
      diagrams\c4-*.svg                       (one SVG per Mermaid block)
      mermaid\c4-*.mmd                        (extracted Mermaid sources)
      BICEC-VERIPASS-VUE-ENSEMBLE.pdf         (only with -Pdf)

.PARAMETER Pdf
    Also render the PDF (requires pandoc + chrome-headless-shell).

.PARAMETER Clean
    Remove generated artifacts (SVG, mmd, PDF).

.EXAMPLE
    .\render.ps1
    .\render.ps1 -Pdf
    .\render.ps1 -Clean
#>

[CmdletBinding()]
param(
    [switch]$Pdf,
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $ScriptDir

$Master      = '..\BICEC-VERIPASS-VUE-ENSEMBLE.md'
$OutDir      = 'diagrams'
$SrcDir      = 'mermaid'
$PdfFile     = 'BICEC-VERIPASS-VUE-ENSEMBLE.pdf'

function Write-Log([string]$msg) { Write-Host "[render.ps1] $msg" }
function Die([string]$msg)      { Write-Error "ERROR: $msg"; exit 1 }

function Test-Bin([string]$name) {
    $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Invoke-Clean {
    Write-Log "Cleaning generated artifacts..."
    if (Test-Path -LiteralPath $OutDir)  { Remove-Item -LiteralPath $OutDir  -Recurse -Force }
    if (Test-Path -LiteralPath $SrcDir)  { Remove-Item -LiteralPath $SrcDir  -Recurse -Force }
    if (Test-Path -LiteralPath $PdfFile) { Remove-Item -LiteralPath $PdfFile -Force }
    Write-Log "Done."
}

function Invoke-ExtractMermaid {
    if (-not (Test-Path -LiteralPath $Master)) {
        Die "Master document not found at $Master"
    }
    Write-Log "Extracting Mermaid blocks from $Master..."
    if (-not (Test-Path -LiteralPath $SrcDir)) {
        New-Item -ItemType Directory -Path $SrcDir | Out-Null
    }

    # Extract fenced mermaid blocks into numbered .mmd files (PowerShell equivalent).
    $content = Get-Content -LiteralPath $Master -Raw -Encoding UTF8
    $rx = [regex]'(?ms)```mermaid\r?\n(.*?)\r?\n```'
    $matches = $rx.Matches($content)

    for ($i = 0; $i -lt $matches.Count; $i++) {
        $body = $matches[$i].Groups[1].Value
        $tmpPath = Join-Path $SrcDir ("_tmp_{0:D3}.mmd" -f ($i + 1))
        Set-Content -LiteralPath $tmpPath -Value $body -Encoding UTF8
    }

    # Try to rename with semantic names (chapter + number + slug).
    $hasPython = Test-Bin 'python' -or Test-Bin 'python3'
    if ($hasPython) {
        $py = if (Test-Bin 'python') { 'python' } else { 'python3' }
        Write-Log "Renaming extracted files with semantic names..."
        $renameScript = Join-Path $ScriptDir 'rename_mermaid.py'
        if (-not (Test-Path -LiteralPath $renameScript)) {
            Write-Log "rename_mermaid.py not found; leaving _tmp_ names."
            return
        }
        $env:VERIPASS_MASTER = (Resolve-Path -LiteralPath $Master).Path
        Push-Location -LiteralPath $SrcDir
        try {
            & $py $renameScript
            if ($LASTEXITCODE -ne 0) {
                Write-Log "python rename exited with code $LASTEXITCODE; leaving _tmp_ names."
            }
        } finally {
            Pop-Location
            Remove-Item Env:VERIPASS_MASTER -ErrorAction SilentlyContinue
        }
        # Normalize sources for mmdc (Mermaid 11 is strict about edge labels
        # containing parens, brackets, `/*`, Unicode, etc.).
        $normScript = Join-Path $ScriptDir 'normalize_mermaid.py'
        if (Test-Path -LiteralPath $normScript) {
            Write-Log "Normalizing sources for mmdc..."
            Push-Location -LiteralPath $SrcDir
            try { & $py $normScript | Out-Null } finally { Pop-Location }
        }
    } else {
        Write-Log "python not found; leaving _tmp_*.mmd names as-is."
    }
}

function Invoke-RenderSvg {
    if (-not (Test-Bin 'mmdc')) {
        Die "mmdc (mermaid-cli) is not installed. Install with: npm i -g @mermaid-js/mermaid-cli"
    }
    Write-Log "Rendering SVG files via mmdc..."
    if (-not (Test-Path -LiteralPath $OutDir)) {
        New-Item -ItemType Directory -Path $OutDir | Out-Null
    }
    $files = Get-ChildItem -LiteralPath $SrcDir -Filter '*.mmd' -File
    foreach ($f in $files) {
        $base = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
        $out  = Join-Path $OutDir ("{0}.svg" -f $base)
        Write-Log ("  - {0}" -f $base)
        & mmdc -i $f.FullName -o $out -t default -b transparent --quiet 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Log ("    (warning) mmdc failed for {0}" -f $base)
        }
    }
    Write-Log "SVG rendering complete: $OutDir\"
}

function Invoke-RenderPdf {
    if (-not (Test-Bin 'pandoc')) {
        Die "pandoc is not installed. Install pandoc to render the PDF."
    }
    if (-not (Test-Bin 'python') -and -not (Test-Bin 'python3')) {
        Die "python is required for the PDF build (print_pdf.py)."
    }
    Write-Log "Rendering PDF via pandoc + chrome-headless-shell..."
    $py = if (Test-Bin 'python') { 'python' } else { 'python3' }
    Push-Location -LiteralPath $ScriptDir
    try {
        & $py print_pdf.py
        if ($LASTEXITCODE -ne 0) {
            Die "print_pdf.py exited with code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
    Write-Log "PDF rendered: $PdfFile"
}

# --- main ---
if ($Clean) {
    Invoke-Clean
} elseif ($Pdf) {
    Invoke-ExtractMermaid
    Invoke-RenderSvg
    Invoke-RenderPdf
} else {
    Invoke-ExtractMermaid
    Invoke-RenderSvg
}

Write-Log "Done."
