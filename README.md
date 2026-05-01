# Archive Studio

Archive Studio is a small Windows desktop app for cleaning academic ebook/document filenames and building a metadata spreadsheet.

It is designed for folder-sized archive work: dozens, hundreds, or thousands of files.

## Features

- Scan a local folder of PDF, EPUB, MOBI, AZW3, DJVU, DOC/DOCX, RTF, and TXT files.
- Clean messy archive filenames.
- Fetch metadata from Google Books, Open Library, Crossref, and OpenAlex.
- Generate suggested filenames.
- Generate bibliography entries.
- Mark confidence as High, Medium, Low, or Zero.
- Manually edit fields such as title, author, DOI, ISBN, bibliography, and suggested filename.
- Copy suggested filenames and bibliographies quickly.
- Export to XLSX or CSV.

## Columns

```text
Title
Author
DOI
ISBN
Suggested Filename
Bibliography
Confidence
```

## Run From Source

```powershell
pip install -r requirements.txt
python archive_studio.py
```

## Windows App

The packaged Windows app is built as:

```text
dist/ArchiveStudio.exe
```

For public sharing, upload `ArchiveStudio.exe` to GitHub Releases.

## PowerShell Install

After uploading the Windows app to GitHub Releases, users can install it with:

```powershell
irm https://raw.githubusercontent.com/RozieNaz/archive-studio/main/install-archive-studio.ps1 | iex
```

For Google Drive files, use the local Google Drive desktop folder if your Drive is synced to your computer.

## Notes

Files stay local. Metadata lookup uses public online sources.
