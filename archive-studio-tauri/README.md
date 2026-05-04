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
<img width="1244" height="772" alt="Light-ArchiveStudio-Screenshot-Tauri" src="https://github.com/user-attachments/assets/576f3143-e5da-452f-936c-09fc109a3e58" />
<img width="1244" height="772" alt="Dark-ArchiveStudio-Screenshot-Tauri" src="https://github.com/user-attachments/assets/58e5ff7e-e3d1-42cd-89e0-1dc909e71a25" />


