# Archive Studio

Archive Studio is a Windows desktop app for organising academic document collections.

It scans folders, cleans messy filenames, fetches public metadata, generates suggested filenames and bibliography entries, and exports the results to CSV.

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
- Clean messy archive filenames and title-case entries.
- Fetch metadata from public sources including Crossref, OpenAlex, Google Books, and Open Library.
- Generate suggested filenames in the form `Author - Title (Year)`.
- Generate bibliography entries and mark accuracy as High, Medium, Low, or Zero.
- Manually edit title, author, DOI, ISBN, bibliography, suggested filename, accuracy, and notes.
- Use right-click formatting for bold and italic text in editable fields.
- Search entries, sort by title/author/accuracy, resize columns, collapse columns, and wrap table text.
- Select multiple entries with Ctrl for copy, lock, and delete workflows.
- Copy bibliography, suggested filename, or entire entries.
- Lock entries to protect them from editing, deleting, or clearing.
- Save entries locally so they are still there when the app is reopened.
- Save/export a CSV file to Downloads as `metadata-log.csv`.
- Use cream/olive light mode and brown/olive dark mode.

## Columns

```text
Title
Author
DOI
ISBN
Suggested Filename
Bibliography
Accuracy
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
.\build-tauri-windows.cmd
```

The Windows installer is created at:

```text
archive-studio-tauri\src-tauri\target\release\bundle\nsis\Archive Studio_0.2.0_x64-setup.exe
```

## Notes

Files stay local. Metadata lookup uses public online sources.