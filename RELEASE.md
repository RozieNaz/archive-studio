# Release Notes

## Release Assets

Upload both Windows options to the same GitHub release.

| Option | Asset Name |
| --- | --- |
| Tkinter app | `ArchiveStudio.exe` |
| Tauri app | `ArchiveStudio-Tauri-Setup.exe` |

## Tkinter Build

Build command:

```powershell
python -m PyInstaller --onefile --windowed --name ArchiveStudio archive_studio.py
```

Release asset:

```text
dist/ArchiveStudio.exe
```

PowerShell installer:

```powershell
irm https://raw.githubusercontent.com/RozieNaz/archive-studio/main/install-archive-studio.ps1 | iex
```

## Tauri Build

Build command from the local Tauri project:

```powershell
cd archive-studio-tauri
.\build-tauri-windows.cmd
```

Release asset to upload:

```text
ArchiveStudio-Tauri-Setup.exe
```

PowerShell installer:

```powershell
irm https://raw.githubusercontent.com/RozieNaz/archive-studio/main/install-archive-studio-tauri.ps1 | iex
```

## Current Tauri Installer Path

```text
C:\Users\gakay\Documents\Codex\2026-05-01\co-i-ve-added-some-new\archive-studio-tauri\ArchiveStudio-Tauri-Setup.exe
```