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
