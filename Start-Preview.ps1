$ErrorActionPreference = 'Stop'
$previewURL = 'http://127.0.0.1:4173/bible-study-tool/'
$previewRunning = $false
try { $previewRunning = (Invoke-WebRequest -Uri $previewURL -TimeoutSec 2).StatusCode -eq 200 } catch { }
if (-not $previewRunning) {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCommand) { throw 'The local preview needs Node.js. The hosted app does not need any software installed.' }
    $serverScript = Join-Path $PSScriptRoot 'tools/serve.cjs'
    Start-Process -FilePath $nodeCommand.Source -ArgumentList @(('"' + $serverScript + '"')) -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 250
        try { if ((Invoke-WebRequest -Uri $previewURL -TimeoutSec 1).StatusCode -eq 200) { $previewRunning = $true; break } } catch { }
    }
    if (-not $previewRunning) { throw 'The preview could not start. Try running node tools/serve.cjs from the project folder.' }
}
Start-Process $previewURL
Write-Output "Preview: $previewURL"
