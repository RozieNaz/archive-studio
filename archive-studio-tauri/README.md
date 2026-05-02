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
<img width="1249" height="639" alt="Dark-ArchiveStudio-Screenshot-Tauri" src="https://github.com/user-attachments/assets/f194be6d-840e-4c46-a723-d8bfe116d9d9" />
<img width="1249" height="639" alt="Light-ArchiveStudio-Screenshot-Tauri" src="https://github.com/user-attachments/assets/c2ec6735-0c09-449a-8083-764dc12dc95b" />
