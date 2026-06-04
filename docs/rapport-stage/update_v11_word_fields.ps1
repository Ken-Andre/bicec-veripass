$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSCommandPath))
$docx = Join-Path $root "docs\rapport-stage\memoire-stage-andre-yoann-kenmogne-v11.docx"
$logDir = Join-Path $root "docs\rapport-stage\rendered-v11"
$log = Join-Path $logDir "word-field-update.log"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Set-Content -Path $log -Value "START"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    Add-Content -Path $log -Value "WORD_CREATED"
    $doc = $word.Documents.Open($docx, $false, $false)
    Add-Content -Path $log -Value "OPENED"

    foreach ($toc in $doc.TablesOfContents) {
        $toc.Update()
    }
    Add-Content -Path $log -Value "TOC_UPDATED"

    foreach ($tof in $doc.TablesOfFigures) {
        $tof.Update()
    }
    Add-Content -Path $log -Value "FIGURE_TABLES_UPDATED"

    $doc.Repaginate()
    $pages = $doc.ComputeStatistics(2)
    Add-Content -Path $log -Value "PAGES=$pages"

    $doc.Save()
    Add-Content -Path $log -Value "SAVED"
    Write-Output "PAGES=$pages"
}
finally {
    if ($doc) {
        $doc.Close($false)
    }
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
