use std::{env, fs, path::PathBuf};

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

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![extract_pdf_text, save_csv])
        .run(tauri::generate_context!())
        .expect("error while running Archive Studio");
}
