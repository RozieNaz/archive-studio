use std::{env, fs, path::PathBuf};

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
        .invoke_handler(tauri::generate_handler![save_csv])
        .run(tauri::generate_context!())
        .expect("error while running Archive Studio");
}
