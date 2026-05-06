# Archive Studio

Archive Studio is a Windows desktop app for organising academic document collections.

It scans folders, keeps the original filename visible, fetches public metadata, generates clean author-title and bibliography entries, and exports the results to CSV.

## Download

Download the Windows installer from the [latest GitHub release](https://github.com/RozieNaz/archive-studio/releases/latest):

```text
ArchiveStudio-Tauri-Setup.exe
```

## PowerShell Install

```powershell
irm https://raw.githubusercontent.com/RozieNaz/archive-studio/main/install-archive-studio.ps1 | iex
```

## Features

- Scan a local folder of PDF, EPUB, MOBI, AZW3, DJVU, DOC/DOCX, RTF, and TXT files.
- Keep the real scanned filename visible while cleaning the separate author-title metadata.
- Extract text from the first five PDF pages locally, then use DOI, ISBN, title, and author clues before filename fallback.
- Search an embedded topic-focused metadata index before falling back to public online sources.
- Fetch metadata from public online sources including Crossref, OpenAlex, Google Books, Open Library, and Internet Archive when the local index is not reliable enough.
- Use dedicated ISBN lookup through Google Books and Open Library when an ISBN is available.
- Show a clean `Author - Title` work identity beside the untouched original filename.
- Generate bibliography entries and mark accuracy as High, Medium, Low, or Zero.
- Manually edit title, author, DOI, ISBN, bibliography, accuracy, and notes. The scanned filename is read-only.
- Use right-click formatting for bold and italic text in editable fields.
- Search entries, sort by author-title/filename/accuracy, resize columns, collapse columns, and wrap table text.
- Select multiple entries with Ctrl for copy, lock, and delete workflows.
- Copy bibliography, clean author-title, or entire entries.
- Lock entries to protect them from editing, deleting, or clearing.
- Save entries locally so they are still there when the app is reopened.
- Save/export a CSV file to Downloads as `metadata-log.csv`.
- Use cream/olive light mode and brown/olive dark mode.

## Columns

```text
Author - Title
DOI
ISBN
Bibliography
Accuracy
Filename
Notes
```

## Build From Source

Requirements:

- Node.js with npm
- Rust
- Windows C++ build tools

```powershell
cd archive-studio-tauri
npm install
npm run build:index
.\build-tauri-windows.cmd
```

The Windows installer is created at:

```text
archive-studio-tauri\src-tauri\target\release\bundle\nsis\Archive Studio_0.2.0_x64-setup.exe
```

## Notes

Files stay local. Archive Studio includes a compact metadata index built from distribution-safe CSV title lists, then falls back to public online sources when needed. The raw CSV title lists are not included in the repository.
