param(
    [string]$Url = "https://github.com/RozieNaz/archive-studio/releases/latest/download/ArchiveStudio.exe",
    [string]$InstallDir = "$env:LOCALAPPDATA\ArchiveStudio"
)

$ErrorActionPreference = "Stop"

Write-Host "Installing Archive Studio..."

if (-not (Test-Path -LiteralPath $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir | Out-Null
}

$ExePath = Join-Path $InstallDir "ArchiveStudio.exe"

Write-Host "Downloading from:"
Write-Host $Url

Invoke-WebRequest -Uri $Url -OutFile $ExePath

$ShortcutPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "Archive Studio.lnk"
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $ExePath
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.Save()

Write-Host "Installed:"
Write-Host $ExePath
Write-Host "Desktop shortcut created."
Write-Host "Run Archive Studio from your Desktop shortcut, or with:"
Write-Host $ExePath
