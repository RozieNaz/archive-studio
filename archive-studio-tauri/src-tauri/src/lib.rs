use serde::Serialize;
use std::{env, fs, path::{Path, PathBuf}};

#[derive(Serialize)]
struct FileEntry {
    name: String,
    path: String,
    extension: String,
}

#[tauri::command]
fn extract_pdf_text(path: String, max_pages: usize) -> Result<String, String> {
    let document = lopdf::Document::load(&path).map_err(|error| error.to_string())?;
    let pages: Vec<u32> = document
        .get_pages()
        .keys()
        .take(max_pages.max(1))
        .copied()
        .collect();
    if pages.is_empty() {
        return Ok(String::new());
    }
    document.extract_text(&pages).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_csv(filename: String, contents: String) -> Result<String, String> {
    let home = env::var("USERPROFILE")
        .or_else(|_| env::var("HOME"))
        .map_err(|_| "Could not find your home folder.".to_string())?;
    let downloads = PathBuf::from(home).join("Downloads");
    fs::create_dir_all(&downloads).map_err(|error| error.to_string())?;

    let path = downloads.join(&filename);

    fs::write(&path, contents).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|error| error.to_string())
}

fn collect_supported_files(folder: &Path, entries: &mut Vec<FileEntry>) -> Result<(), String> {
    let supported = ["pdf", "epub", "mobi", "azw3", "djvu", "doc", "docx", "rtf", "txt", "csv"];
    for item in fs::read_dir(folder).map_err(|error| error.to_string())? {
        let item = item.map_err(|error| error.to_string())?;
        let path = item.path();
        if path.is_dir() {
            collect_supported_files(&path, entries)?;
            continue;
        }
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !supported.contains(&extension.as_str()) {
            continue;
        }
        entries.push(FileEntry {
            name: path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("")
                .to_string(),
            path: path.to_string_lossy().to_string(),
            extension,
        });
    }
    Ok(())
}

#[tauri::command]
fn scan_folder() -> Result<Vec<FileEntry>, String> {
    let Some(folder) = rfd::FileDialog::new().pick_folder() else {
        return Ok(Vec::new());
    };
    let mut entries = Vec::new();
    collect_supported_files(&folder, &mut entries)?;
    Ok(entries)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![extract_pdf_text, read_text_file, save_csv, scan_folder])
        .run(tauri::generate_context!())
        .expect("error while running Archive Studio");
}
