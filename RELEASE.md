# Release Notes

## Archive Studio Windows

Build command:

```powershell
python -m PyInstaller --onefile --windowed --name ArchiveStudio archive_studio.py
```

Release asset:

```text
dist/ArchiveStudio.exe
```

Upload `ArchiveStudio.exe` to GitHub Releases. Then update the URL in `install-archive-studio.ps1` so users can install it from PowerShell.
