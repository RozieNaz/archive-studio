# Archive Studio

Archive Studio is a Windows desktop app for cleaning academic ebook/document filenames and building a metadata spreadsheet.

It is designed for folder-sized archive work: dozens, hundreds, or thousands of files.

## Download Options

Archive Studio currently has two Windows options:

| Option | Best For | Release File |
| --- | --- | --- |
| Tkinter version | Simple, classic Windows app | `ArchiveStudio.exe` |
| Tauri version | Newer interface, smaller modern installer | `ArchiveStudio-Tauri-Setup.exe` |

Download them from the [latest GitHub release](https://github.com/RozieNaz/archive-studio/releases/latest).

## PowerShell Install

Tkinter version:

```powershell
irm https://raw.githubusercontent.com/RozieNaz/archive-studio/main/install-archive-studio.ps1 | iex
```

Tauri version:

```powershell
irm https://raw.githubusercontent.com/RozieNaz/archive-studio/main/install-archive-studio-tauri.ps1 | iex
```

## Features

- Scan a local folder of PDF, EPUB, MOBI, AZW3, DJVU, DOC/DOCX, RTF, and TXT files.
- Clean messy archive filenames.
- Fetch metadata from public sources.
- Generate suggested filenames.
- Generate bibliography entries.
- Mark accuracy as High, Medium, Low, or Zero.
- Manually edit title, author, DOI, ISBN, bibliography, suggested filename, and accuracy.
- Copy bibliography, suggested filename, or entire entries.
- Export to CSV. The Tkinter version also supports XLSX export.

## Columns

```text
Title
Author
DOI
ISBN
Suggested Filename
Bibliography
Accuracy
```

## Run Tkinter From Source

```powershell
pip install -r requirements.txt
python archive_studio.py
```

## Build Tauri From Source

The Tauri source is currently developed locally and will be added to the repository after the interface settles. To build it locally you need Node.js, Rust, and the Windows C++ build tools.

```powershell
cd archive-studio-tauri
npm install
npm run tauri build
```

## Notes

Files stay local. Metadata lookup uses public online sources.