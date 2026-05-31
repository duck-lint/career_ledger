#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

const I04_FIXTURE_JSON: &str = include_str!("../../desktop/fixtures/i04-approved-source-facts.json");

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProbeSummary {
    runtime_error: Option<String>,
    rendered_result_ids: Vec<String>,
    supported_requirement_label: String,
    supported_status: String,
    unsupported_requirement_label: String,
    unsupported_status: String,
    unsupported_note_visible: bool,
    supporting_experience_record_ids: Vec<String>,
    supporting_evidence_item_ids: Vec<String>,
    semantic_positions: Vec<String>,
    ordered_sequence: Vec<String>,
}

#[tauri::command]
fn load_i04_fixture() -> Result<Value, String> {
    serde_json::from_str(I04_FIXTURE_JSON)
        .map_err(|error| format!("Failed to parse the I04 fixture: {error}"))
}

#[tauri::command]
fn report_i04_probe(summary: ProbeSummary, app: AppHandle) -> Result<(), String> {
    let encoded = serde_json::to_string(&summary)
        .map_err(|error| format!("Failed to serialize probe summary: {error}"))?;

    println!("I04_PROBE:{encoded}");
    app.exit(0);
    Ok(())
}

fn main() {
    let probe_mode = std::env::args().any(|arg| arg == "--i04-probe");
    let window_url = if probe_mode {
        WebviewUrl::App("index.html?probe=1".into())
    } else {
        WebviewUrl::App("index.html".into())
    };

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_i04_fixture, report_i04_probe])
        .setup(move |app| {
            WebviewWindowBuilder::new(app, "main", window_url.clone())
                .title("Career Ledger")
                .inner_size(1080.0, 820.0)
                .min_inner_size(820.0, 620.0)
                .build()
                .map(|_| ())
                .map_err(Into::into)
        })
        .run(tauri::generate_context!())
        .expect("error while running the Career Ledger desktop seam");
}