use crate::experience_record_order_by_clause;
use crate::taxonomy::get_runtime_taxonomy_version;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

const SCHEMA_VERSION: &str = "2.0";

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct CareerLibraryExport {
    pub export_type: String,
    pub experience_records: Vec<CareerLibraryExportRecord>,
    pub export_meta: CareerLibraryExportMeta,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct CareerLibraryExportMeta {
    pub schema_version: String,
    pub exported_at: String,
    pub taxonomy_version: String,
    pub source_db_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct CareerLibraryExportRecord {
    pub id: String,
    pub slug: String,
    pub record_type: String,
    pub organization: String,
    pub title: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub location: Option<String>,
    pub employment_type: Option<String>,
    pub context_tags: Vec<String>,
    pub canonical_scope_summary: Option<String>,
    pub common_context: Option<Value>,
    pub created_at: String,
    pub updated_at: String,
    pub evidence: Vec<CareerLibraryExportEvidenceItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct CareerLibraryExportEvidenceItem {
    pub id: String,
    pub experience_record_id: String,
    pub claim: String,
    pub date_range: Option<String>,
    pub tags: Vec<String>,
    pub scope_context: Option<Value>,
    pub evidence_note: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

pub fn build_career_library_export(
    conn: &Connection,
    source_db_name: &str,
) -> Result<CareerLibraryExport, String> {
    let taxonomy_version = get_runtime_taxonomy_version(conn)?;
    let exported_at = current_export_timestamp(conn)?;
    let mut experience_records = fetch_experience_records(conn)?;
    let mut evidence_by_record = fetch_evidence_by_record(conn)?;

    for record in &mut experience_records {
        record.evidence = evidence_by_record.remove(&record.id).unwrap_or_default();
    }

    Ok(CareerLibraryExport {
        export_type: "career_library_extract".to_string(),
        experience_records,
        export_meta: CareerLibraryExportMeta {
            schema_version: SCHEMA_VERSION.to_string(),
            exported_at,
            taxonomy_version,
            source_db_name: source_db_name.to_string(),
        },
    })
}

fn current_export_timestamp(conn: &Connection) -> Result<String, String> {
    conn.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now')", [], |row| {
        row.get(0)
    })
    .map_err(|e| format!("Failed to generate export timestamp: {e}"))
}

fn fetch_experience_records(conn: &Connection) -> Result<Vec<CareerLibraryExportRecord>, String> {
    let query = format!(
        "SELECT id, slug, record_type, organization, title, start_date, end_date, \
                location, employment_type, context_tags_json, canonical_scope_summary, \
                common_context_json, created_at, updated_at \
         FROM experience_records ORDER BY {}",
        experience_record_order_by_clause()
    );
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    let mut records = Vec::new();

    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        records.push(CareerLibraryExportRecord {
            id: row.get(0).map_err(|e| e.to_string())?,
            slug: row.get(1).map_err(|e| e.to_string())?,
            record_type: row.get(2).map_err(|e| e.to_string())?,
            organization: row.get(3).map_err(|e| e.to_string())?,
            title: row.get(4).map_err(|e| e.to_string())?,
            start_date: row.get(5).map_err(|e| e.to_string())?,
            end_date: row.get(6).map_err(|e| e.to_string())?,
            location: row.get(7).map_err(|e| e.to_string())?,
            employment_type: row.get(8).map_err(|e| e.to_string())?,
            context_tags: parse_tags_json(
                row.get(9).map_err(|e| e.to_string())?,
                "experience_records.context_tags_json",
            )?,
            canonical_scope_summary: row.get(10).map_err(|e| e.to_string())?,
            common_context: parse_json_text(
                row.get(11).map_err(|e| e.to_string())?,
                "experience_records.common_context_json",
            )?,
            created_at: row.get(12).map_err(|e| e.to_string())?,
            updated_at: row.get(13).map_err(|e| e.to_string())?,
            evidence: Vec::new(),
        });
    }

    Ok(records)
}

fn fetch_evidence_by_record(
    conn: &Connection,
) -> Result<HashMap<String, Vec<CareerLibraryExportEvidenceItem>>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, experience_record_id, claim, date_range, \
                    tags_json, scope_context_json, evidence_note, created_at, updated_at \
             FROM evidence_items ORDER BY created_at ASC, id ASC",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    let mut grouped = HashMap::new();

    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let evidence = CareerLibraryExportEvidenceItem {
            id: row.get(0).map_err(|e| e.to_string())?,
            experience_record_id: row.get(1).map_err(|e| e.to_string())?,
            claim: row.get(2).map_err(|e| e.to_string())?,
            date_range: row.get(3).map_err(|e| e.to_string())?,
            tags: parse_tags_json(
                row.get(4).map_err(|e| e.to_string())?,
                "evidence_items.tags_json",
            )?,
            scope_context: parse_json_text(
                row.get(5).map_err(|e| e.to_string())?,
                "evidence_items.scope_context_json",
            )?,
            evidence_note: row.get(6).map_err(|e| e.to_string())?,
            created_at: row.get(7).map_err(|e| e.to_string())?,
            updated_at: row.get(8).map_err(|e| e.to_string())?,
        };

        grouped
            .entry(evidence.experience_record_id.clone())
            .or_insert_with(Vec::new)
            .push(evidence);
    }

    Ok(grouped)
}

fn parse_tags_json(raw: Option<String>, field_name: &str) -> Result<Vec<String>, String> {
    match parse_json_text(raw, field_name)? {
        None => Ok(Vec::new()),
        Some(Value::Array(items)) => Ok(items
            .into_iter()
            .map(|value| match value {
                Value::String(text) => text,
                other => other.to_string(),
            })
            .collect()),
        Some(_) => Err(format!("Stored {field_name} must decode to a list.")),
    }
}

fn parse_json_text(raw: Option<String>, field_name: &str) -> Result<Option<Value>, String> {
    let Some(text) = raw else {
        return Ok(None);
    };
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    serde_json::from_str(trimmed)
        .map(Some)
        .map_err(|error| format!("Stored {field_name} contains invalid JSON: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::taxonomy::ensure_runtime_taxonomy_seeded;
    use rusqlite::params;
    use serde_json::json;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(crate::embedded_assets::CAREER_SCHEMA_SQL)
            .unwrap();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();
        conn
    }

    #[test]
    fn builds_export_with_scope_fields_and_metadata() {
        let conn = setup_conn();
        conn.execute(
            "INSERT INTO experience_records (
                id, slug, record_type, organization, title, start_date, end_date,
                location, employment_type, context_tags_json, canonical_scope_summary,
                common_context_json, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                "rec_1",
                "sample-record",
                "employment",
                "Sample Org",
                "Analyst",
                "2024-01",
                "present",
                "Remote",
                "Contract",
                "[\"workday\", \"hris\"]",
                "Canonical export contract coverage.",
                "{\"system\":\"Workday\"}",
                "2024-01-01T00:00:00Z",
                "2024-01-02T00:00:00Z"
            ],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO evidence_items (
                id, experience_record_id, claim, date_range, tags_json,
                scope_context_json, evidence_note, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                "ev_1",
                "rec_1",
                "Analyzed support requests and documented edge cases.",
                "2024",
                "[\"workday\", \"analysis\"]",
                "{\"system\":\"Workday\"}",
                "Export contract test evidence.",
                "2024-01-01T00:00:00Z",
                "2024-01-02T00:00:00Z"
            ],
        )
        .unwrap();

        let payload = build_career_library_export(&conn, "career.db").unwrap();
        let serialized = serde_json::to_value(&payload).unwrap();

        assert_eq!(payload.export_type, "career_library_extract");
        assert_eq!(payload.export_meta.schema_version, "2.0");
        assert_eq!(payload.export_meta.source_db_name, "career.db");
        assert!(!payload.export_meta.taxonomy_version.trim().is_empty());
        assert!(payload.export_meta.exported_at.ends_with('Z'));
        assert_eq!(payload.experience_records.len(), 1);
        assert_eq!(
            payload.experience_records[0]
                .canonical_scope_summary
                .as_deref(),
            Some("Canonical export contract coverage.")
        );
        assert_eq!(
            payload.experience_records[0].common_context,
            Some(json!({"system": "Workday"}))
        );
        assert_eq!(payload.experience_records[0].evidence.len(), 1);
        assert_eq!(
            payload.experience_records[0].evidence[0].scope_context,
            Some(json!({"system": "Workday"}))
        );
        assert_eq!(
            serialized["experience_records"][0]["context_tags"],
            json!(["workday", "hris"])
        );
        assert_eq!(
            serialized["experience_records"][0]["evidence"][0]["tags"],
            json!(["workday", "analysis"])
        );
    }

    #[test]
    fn orders_records_with_open_ended_roles_first() {
        let conn = setup_conn();
        conn.execute(
            "INSERT INTO experience_records (
                id, slug, record_type, organization, title, start_date, end_date,
                context_tags_json, created_at, updated_at
            ) VALUES (?1, ?2, 'employment', ?3, ?4, ?5, ?6, '[]', ?7, ?8)",
            params![
                "rec_old",
                "older-role",
                "Older Org",
                "Analyst",
                "2021-01",
                "2022-12",
                "2024-01-01T00:00:00Z",
                "2024-01-02T00:00:00Z"
            ],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO experience_records (
                id, slug, record_type, organization, title, start_date, end_date,
                context_tags_json, created_at, updated_at
            ) VALUES (?1, ?2, 'employment', ?3, ?4, ?5, ?6, '[]', ?7, ?8)",
            params![
                "rec_current",
                "current-role",
                "Current Org",
                "Lead Analyst",
                "2023-01",
                "present",
                "2024-01-01T00:00:00Z",
                "2024-01-02T00:00:00Z"
            ],
        )
        .unwrap();

        let payload = build_career_library_export(&conn, "career.db").unwrap();

        assert_eq!(
            payload
                .experience_records
                .iter()
                .map(|record| record.id.as_str())
                .collect::<Vec<_>>(),
            vec!["rec_current", "rec_old"]
        );
    }
}
