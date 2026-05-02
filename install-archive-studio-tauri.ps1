param(
    [string]$Url = "https://github.com/RozieNaz/archive-studio/releases/latest/download/ArchiveStudio-Tauri-Setup.exe",
    [string]$DownloadDir = "$env:TEMP\ArchiveStudioTauri"
)

$ErrorActionPreference = "Stop"

Write-Host "Installing Archive Studio Tauri..."

if (-not (Test-Path -LiteralPath $DownloadDir)) {
    New-Item -ItemType Directory -Path $DownloadDir | Out-Null
}

$InstallerPath = Join-Path $DownloadDir "ArchiveStudio-Tauri-Setup.exe"

Write-Host "Downloading from:"
Write-Host $Url

Invoke-WebRequest -Uri $Url -OutFile $InstallerPath

Write-Host "Starting installer..."
Start-Process -FilePath $InstallerPath -Wait

Write-Host "Archive Studio Tauri installer finished."
