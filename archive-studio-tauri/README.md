# Archive Studio

Archive Studio is a Windows desktop app for organising academic document collections. It scans folders, cleans messy filenames, looks up public metadata, and helps create cleaner bibliography entries and suggested filenames.

This is the Tauri version of the app.

## Features

- Scan whole folders of academic files.
- Clean filenames by removing archive junk, symbols, extensions, and messy spacing.
- Extract text from the first five PDF pages locally, then use DOI, ISBN, title, and author clues for metadata lookup.
- Search a compact embedded metadata index for relevant academic titles before falling back to online lookup.
- Fetch metadata from public sources such as Crossref, OpenAlex, Google Books, and Open Library.
- Edit title, author, DOI, ISBN, bibliography, suggested filename, accuracy, and notes.
- Use right-click formatting for bold and italic text in editable fields.
- Copy bibliography, filename, or full entry.
- Export entries to CSV.
- Save work locally so entries remain available when the app is reopened.
- Sort by title, author, and accuracy.
- Search entries.
- Resize and collapse columns.
- Wrap table text.
- Lock entries to protect them from editing, deleting, or clearing.
- Delete selected entries with the Delete key or Ctrl+X, and clear all unlocked entries with confirmation.
- Use light and dark themes: cream/olive in light mode, brown/olive in dark mode.

## Build From Source

Install these first:

- Node.js with npm
- Rust
- Tauri prerequisites for Windows, including Microsoft C++ build tools

Then run:

```powershell
npm install
npm run tauri dev
```

Build installer:

```powershell
npm run tauri build
```

On Windows, the included build helper uses the Visual Studio developer environment:

```powershell
.\build-tauri-windows.cmd
```

Rebuild the embedded metadata index from distribution-safe CSV title lists:

```powershell
npm run build:index
```

The index builder also writes `src\data\metadata-index-report.json`, including rows skipped from the PDF bibliography input because they look incomplete or unreliable.
