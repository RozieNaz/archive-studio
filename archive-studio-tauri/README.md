# Archive Studio

Archive Studio is a Windows desktop app for organising academic document collections. It scans folders, cleans messy filenames, looks up public metadata, and helps create cleaner bibliography entries and suggested filenames.

This is the Tauri version of the app. It uses Tauri, React, and Vite.

## Features

- Scan whole folders of academic files.
- Clean filenames by removing archive junk, symbols, extensions, and messy spacing.
- Fetch metadata from public sources such as Google Books, Open Library, and Crossref.
- Edit title, author, DOI, ISBN, bibliography, suggested filename, accuracy, and notes.
- Copy bibliography, filename, or full entry.
- Export entries to CSV.
- Save work locally so entries remain available when the app is reopened.
- Sort by title, author, and accuracy.
- Search entries.
- Resize and collapse columns.
- Wrap table text.
- Lock entries to protect them from editing, deleting, or clearing.
- Delete selected entries or clear all unlocked entries.
- Use light and dark themes: cream/olive in light mode, brown/olive in dark mode.

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

<img width="1449" height="785" alt="Light-ArchiveStudio-Screenshot-Tauri" src="https://github.com/user-attachments/assets/4982eee7-969f-45d8-a34e-724ade994116" />
<img width="1449" height="785" alt="Dark-ArchiveStudio-Screenshot-Tauri" src="https://github.com/user-attachments/assets/78d5af81-c247-4fa5-9bab-a20b6d76bf0f" />

