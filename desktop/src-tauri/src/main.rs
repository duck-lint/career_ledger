#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::Value;
use std::{env, path::PathBuf, process::Command};

const PAGE_SIZE: usize = 20;

// Development pilot: the GUI and Python interpreter run inside the same WSL distro.
// No shell, HTTP server, second SQLite writer, or implicit database creation.
fn call_cli(arguments: Vec<String>) -> Result<Value, String> {
    let db = env::var_os("CAREER_LEDGER_DB")
        .ok_or("Set CAREER_LEDGER_DB to the absolute path of the existing career.db")?;
    let db_path = PathBuf::from(db);
    if !db_path.is_absolute() || !db_path.is_file() {
        return Err(format!("CAREER_LEDGER_DB must name an existing absolute database path: {}", db_path.display()));
    }
    let script = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../career_ledger.py");
    let output = Command::new("python3")
        .arg(script)
        .arg("--db")
        .arg(&db_path)
        .args(arguments)
        .output()
        .map_err(|error| format!("Could not launch Python CLI: {error}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_owned());
    }
    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Invalid JSON from Career Ledger CLI: {error}"))
}

async fn dispatch(arguments: Vec<String>) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || call_cli(arguments))
        .await
        .map_err(|error| format!("CLI operation failed to complete: {error}"))?
}

#[tauri::command]
async fn list_experiences(offset: usize) -> Result<Value, String> {
    dispatch(vec![
        "list-experiences".into(), "--json".into(), "--limit".into(),
        PAGE_SIZE.to_string(), "--offset".into(), offset.to_string(),
    ]).await
}

#[tauri::command]
async fn get_experience(experience_id: String) -> Result<Value, String> {
    dispatch(vec![
        "get-experience".into(), "--id".into(), experience_id,
    ]).await
}

#[tauri::command]
async fn add_evidence(experience_id: String, description: String) -> Result<Value, String> {
    dispatch(vec![
        "add-evidence".into(), "--experience-id".into(), experience_id,
        format!("--description={description}"),
    ]).await
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_experiences, get_experience, add_evidence,
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start Career Ledger desktop app");
}
