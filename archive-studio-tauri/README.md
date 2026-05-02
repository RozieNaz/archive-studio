# Archive Studio Tauri

This is the current Archive Studio desktop app.

It uses Tauri, React, and Vite.

## Features

- Folder scanning
- Metadata lookup from public sources
- Editable entries
- Accuracy dropdown
- Delete selected entries
- Local autosave
- CSV export
- Light and dark themes

## Development

Install:

```powershell
npm install
```

Run in development:

```powershell
npm run tauri dev
```

Build Windows installer:

```powershell
.\build-tauri-windows.cmd
```

The installer is created under:

```text
src-tauri\target\release\bundle\nsis\
```
<img width="1207" height="682" alt="Light-ArchiveStudio-Screenshot-Tauri" src="https://github.com/user-attachments/assets/e2e80219-435f-4c86-8ae5-8a1b5b560f97" />
<img width="1253" height="787" alt="Dark-ArchiveStudio-Screenshot-Tauri" src="https://github.com/user-attachments/assets/654e3b0a-f2e8-4ce8-a035-6f0dee422f21" />

