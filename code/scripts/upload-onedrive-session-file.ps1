#Requires -Version 5.1
<#
Uploads a large file to OneDrive for Business using the SharePoint-hosted
OneDrive v2.0 upload session endpoint.

The OAuth token is read from a file so it is not exposed in process arguments.
The uploadUrl returned by OneDrive is intentionally never logged.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$SiteUrl,
    [Parameter(Mandatory = $true)][string]$OneDrivePath,
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string]$TokenPath,
    [string]$LogPath = "C:\tmp\onedrive-session-upload.log",
    [int]$ChunkMiB = 60
)

$ErrorActionPreference = "Stop"

function Write-Log {
    param([Parameter(Mandatory = $true)][string]$Message)
    $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -Path $LogPath -Value $line
}

function Send-Chunk {
    param(
        [Parameter(Mandatory = $true)][string]$UploadUrl,
        [Parameter(Mandatory = $true)][byte[]]$Bytes,
        [Parameter(Mandatory = $true)][int64]$Start,
        [Parameter(Mandatory = $true)][int64]$End,
        [Parameter(Mandatory = $true)][int64]$Total
    )

    try {
        $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Put, $UploadUrl)
        $content = [System.Net.Http.ByteArrayContent]::new($Bytes)
        $content.Headers.ContentRange = [System.Net.Http.Headers.ContentRangeHeaderValue]::new($Start, $End, $Total)
        $content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/octet-stream")
        $request.Content = $content

        $response = $script:UploadClient.SendAsync($request).GetAwaiter().GetResult()
        $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if (-not $response.IsSuccessStatusCode) {
            throw "Chunk upload failed: HTTP $([int]$response.StatusCode) $body"
        }
        return $body
    }
    finally {
            if ($null -ne $request) {
                $request.Dispose()
            }
    }
}

New-Item -ItemType Directory -Path (Split-Path -Parent $LogPath) -Force | Out-Null
Set-Content -Path $LogPath -Value ""

if (-not (Test-Path $FilePath)) {
    throw "File not found: $FilePath"
}
if (-not (Test-Path $TokenPath)) {
    throw "Token file not found: $TokenPath"
}

$file = Get-Item -Path $FilePath
$token = Get-Content -Path $TokenPath -Raw
$safePath = $OneDrivePath.TrimStart("/")
$chunkSize = $ChunkMiB * 1MB

Add-Type -AssemblyName System.Net.Http
$script:UploadClient = [System.Net.Http.HttpClient]::new()
$script:UploadClient.Timeout = [TimeSpan]::FromSeconds(900)

Write-Log "Starting OneDrive upload session"
Write-Log "Source: $FilePath"
Write-Log "Target: /$safePath"
Write-Log "SizeBytes: $($file.Length)"
Write-Log "ChunkBytes: $chunkSize"

$headers = @{
    Authorization = "Bearer $token"
    Accept = "application/json"
    "Content-Type" = "application/json"
}
$body = @{ item = @{ "@microsoft.graph.conflictBehavior" = "replace" } } | ConvertTo-Json -Depth 4
$session = Invoke-RestMethod `
    -Uri "$SiteUrl/_api/v2.0/drive/root:/$safePath`:/createUploadSession" `
    -Headers $headers `
    -Method Post `
    -Body $body `
    -TimeoutSec 120

if ([string]::IsNullOrWhiteSpace($session.uploadUrl)) {
    throw "OneDrive did not return an uploadUrl."
}
Write-Log "Upload session created; expires $($session.expirationDateTime)"

$stream = [System.IO.File]::OpenRead($FilePath)
$buffer = New-Object byte[] $chunkSize
$offset = [int64]0
$chunkIndex = 0

try {
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

        $start = $offset
        $end = $offset + $read - 1
        Send-Chunk -UploadUrl $session.uploadUrl -Bytes $chunk -Start $start -End $end -Total $stream.Length | Out-Null

        $offset += $read
        $chunkIndex += 1
        $percent = [math]::Round(($offset / $stream.Length) * 100, 2)
        Write-Log "Progress: $percent% ($offset / $($stream.Length) bytes, chunks=$chunkIndex)"
    }
}
finally {
    $stream.Close()
    $script:UploadClient.Dispose()
}

Write-Log "Upload complete"
