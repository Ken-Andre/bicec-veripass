#Requires -Version 5.1
<#
Uploads a large file to SharePoint/OneDrive using the SharePoint REST chunk API.

The access token is read from a file so it does not appear in process arguments.
This script is intended for one-off handoff uploads after an authenticated browser
session has provided a SharePoint token.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$SiteUrl,
    [Parameter(Mandatory = $true)][string]$TargetFolderServerRelativeUrl,
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string]$TokenPath,
    [string]$LogPath = "C:\tmp\sharepoint-upload.log",
    [int]$ChunkMiB = 10
)

$ErrorActionPreference = "Stop"

function Write-Log {
    param([Parameter(Mandatory = $true)][string]$Message)
    $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -Path $LogPath -Value $line
}

function Invoke-Spo {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][string]$Method,
        [hashtable]$Headers,
        [byte[]]$BodyBytes,
        [string]$BodyText
    )

    if ($null -ne $BodyBytes) {
        Add-Type -AssemblyName System.Net.Http

        $client = [System.Net.Http.HttpClient]::new()
        $client.Timeout = [TimeSpan]::FromSeconds(600)

        try {
            $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::$Method, $Uri)
            foreach ($key in $Headers.Keys) {
                if ($key -eq "Content-Type") {
                    continue
                }
                $request.Headers.TryAddWithoutValidation($key, [string]$Headers[$key]) | Out-Null
            }

            $content = [System.Net.Http.ByteArrayContent]::new($BodyBytes)
            if ($Headers.ContainsKey("Content-Type")) {
                $content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse([string]$Headers["Content-Type"])
            }
            $request.Content = $content

            $response = $client.SendAsync($request).GetAwaiter().GetResult()
            $response.EnsureSuccessStatusCode() | Out-Null
            return $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        }
        finally {
            if ($null -ne $request) {
                $request.Dispose()
            }
            $client.Dispose()
        }
    }
    if ($null -ne $BodyText) {
        return Invoke-RestMethod -Uri $Uri -Method $Method -Headers $Headers -Body $BodyText -TimeoutSec 120
    }
    return Invoke-RestMethod -Uri $Uri -Method $Method -Headers $Headers -TimeoutSec 120
}

function Escape-SpoPath {
    param([Parameter(Mandatory = $true)][string]$Value)
    return $Value.Replace("'", "''")
}

New-Item -ItemType Directory -Path (Split-Path -Parent $LogPath) -Force | Out-Null
Set-Content -Path $LogPath -Value ""

if (-not (Test-Path $FilePath)) {
    throw "File not found: $FilePath"
}
if (-not (Test-Path $TokenPath)) {
    throw "Token file not found: $TokenPath"
}

$token = Get-Content -Path $TokenPath -Raw
$file = Get-Item -Path $FilePath
$fileName = $file.Name
$fileServerRelativeUrl = "$TargetFolderServerRelativeUrl/$fileName"
$chunkSize = $ChunkMiB * 1MB
$uploadId = [guid]::NewGuid()

$baseHeaders = @{
    Authorization = "Bearer $token"
    Accept = "application/json;odata=nometadata"
}

Write-Log "Starting upload"
Write-Log "Source: $FilePath"
Write-Log "Target: $fileServerRelativeUrl"
Write-Log "SizeBytes: $($file.Length)"

$context = Invoke-Spo -Uri "$SiteUrl/_api/contextinfo" -Method "Post" -Headers $baseHeaders
$digest = $context.FormDigestValue

$postHeaders = @{
    Authorization = "Bearer $token"
    Accept = "application/json;odata=nometadata"
    "Content-Type" = "application/octet-stream"
    "X-RequestDigest" = $digest
}

$jsonHeaders = @{
    Authorization = "Bearer $token"
    Accept = "application/json;odata=nometadata"
    "Content-Type" = "application/json;odata=nometadata"
    "X-RequestDigest" = $digest
}

try {
    Invoke-Spo `
        -Uri "$SiteUrl/_api/web/GetFolderByServerRelativeUrl('$(Escape-SpoPath $TargetFolderServerRelativeUrl)')?`$select=ServerRelativeUrl" `
        -Method "Get" `
        -Headers $baseHeaders | Out-Null
}
catch {
    $folderBody = @{ ServerRelativeUrl = $TargetFolderServerRelativeUrl } | ConvertTo-Json
    Invoke-Spo -Uri "$SiteUrl/_api/web/folders" -Method "Post" -Headers $jsonHeaders -BodyText $folderBody | Out-Null
}

Write-Log "Creating placeholder file"
$placeholder = [System.Text.Encoding]::UTF8.GetBytes("placeholder")
Invoke-Spo `
    -Uri "$SiteUrl/_api/web/GetFolderByServerRelativeUrl('$(Escape-SpoPath $TargetFolderServerRelativeUrl)')/Files/add(url='$(Escape-SpoPath $fileName)',overwrite=true)" `
    -Method "Post" `
    -Headers $postHeaders `
    -BodyBytes $placeholder | Out-Null
Write-Log "Placeholder created"

$stream = [System.IO.File]::OpenRead($FilePath)
$buffer = New-Object byte[] $chunkSize
$offset = [int64]0
$chunkIndex = 0
$lastLogAt = [int64]0

try {
    Write-Log "Starting chunk transfer"
    while ($offset -lt $stream.Length) {
        $read = $stream.Read($buffer, 0, $buffer.Length)
        if ($read -le 0) {
            break
        }

        $chunk = if ($read -eq $buffer.Length) {
            $buffer
        }
        else {
            $last = New-Object byte[] $read
            [Array]::Copy($buffer, 0, $last, 0, $read)
            $last
        }

        if ($offset -eq 0) {
            $uri = "$SiteUrl/_api/web/GetFileByServerRelativeUrl('$(Escape-SpoPath $fileServerRelativeUrl)')/StartUpload(uploadId=guid'$uploadId')"
        }
        elseif (($offset + $read) -ge $stream.Length) {
            $uri = "$SiteUrl/_api/web/GetFileByServerRelativeUrl('$(Escape-SpoPath $fileServerRelativeUrl)')/FinishUpload(uploadId=guid'$uploadId',fileOffset=$offset)"
        }
        else {
            $uri = "$SiteUrl/_api/web/GetFileByServerRelativeUrl('$(Escape-SpoPath $fileServerRelativeUrl)')/ContinueUpload(uploadId=guid'$uploadId',fileOffset=$offset)"
        }

        Invoke-Spo -Uri $uri -Method "Post" -Headers $postHeaders -BodyBytes $chunk | Out-Null

        $offset += $read
        $chunkIndex += 1

        if (($offset - $lastLogAt) -ge (20MB) -or $offset -eq $stream.Length) {
            $percent = [math]::Round(($offset / $stream.Length) * 100, 2)
            Write-Log "Progress: $percent% ($offset / $($stream.Length) bytes, chunks=$chunkIndex)"
            $lastLogAt = $offset
        }
    }
}
finally {
    $stream.Close()
}

Write-Log "Upload complete"
Write-Log "FileUrl: $SiteUrl$($fileServerRelativeUrl -replace ' ', '%20')"
