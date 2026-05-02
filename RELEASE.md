# Release Notes

## Release Asset

Upload this Windows installer to GitHub Releases:

```text
ArchiveStudio-Tauri-Setup.exe
```

## Build Tauri App

Build command from the local Tauri project:

```powershell
cd archive-studio-tauri
.\build-tauri-windows.cmd
```

The generated installer is usually here:

```text
archive-studio-tauri\src-tauri\target\release\bundle\nsis\Archive Studio_0.2.0_x64-setup.exe
```

For release upload, rename/copy it to:

```text
ArchiveStudio-Tauri-Setup.exe
```

## PowerShell Installer

After uploading `ArchiveStudio-Tauri-Setup.exe` to the latest GitHub release, users can install Archive Studio with:

```powershell
irm https://raw.githubusercontent.com/RozieNaz/archive-studio/main/install-archive-studio.ps1 | iex
```

## Current Local Installer Path

```text
C:\Users\gakay\Documents\Codex\2026-05-01\co-i-ve-added-some-new\archive-studio-tauri\ArchiveStudio-Tauri-Setup.exe
```