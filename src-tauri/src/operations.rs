use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Anomaly {
    pub id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub anomaly_code: String,
    pub severity: String,
    pub message: String,
    pub detected_at: String,
    pub resolved_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GenerationManifest {
    pub id: String,
    pub created_at: String,
    pub artifact_kind: String,
    pub target_role_family: Option<String>,
    pub job_posting_path: Option<String>,
    pub job_posting_sha256: Option<String>,
    pub build_policy_path: Option<String>,
    pub build_policy_sha256: Option<String>,
    pub candidate_profile_path: Option<String>,
    pub candidate_profile_sha256: Option<String>,
    pub library_export_path: Option<String>,
    pub library_export_sha256: Option<String>,
    pub selected_record_ids: Option<Value>,
    pub selected_evidence_ids: Option<Value>,
    pub gap_report: Option<Value>,
    pub artifact_paths: Option<Value>,
    pub artifact_hashes: Option<Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone)]
pub struct NewGenerationManifest {
    pub artifact_kind: String,
    pub target_role_family: Option<String>,
    pub job_posting_path: Option<String>,
    pub job_posting_sha256: Option<String>,
    pub build_policy_path: Option<String>,
    pub build_policy_sha256: Option<String>,
    pub candidate_profile_path: Option<String>,
    pub candidate_profile_sha256: Option<String>,
    pub library_export_path: Option<String>,
    pub library_export_sha256: Option<String>,
    pub selected_record_ids: Option<Value>,
    pub selected_evidence_ids: Option<Value>,
    pub gap_report: Option<Value>,
    pub artifact_paths: Option<Value>,
    pub artifact_hashes: Option<Value>,
    pub notes: Option<String>,
}

fn parse_json_opt(raw: Option<String>) -> Option<Value> {
    raw.and_then(|value| serde_json::from_str(&value).ok())
}

fn json_text_opt(value: &Option<Value>) -> Result<Option<String>, String> {
    value
        .as_ref()
        .map(|value| serde_json::to_string(value).map_err(|error| error.to_string()))
        .transpose()
}

fn row_to_anomaly(row: &rusqlite::Row<'_>) -> rusqlite::Result<Anomaly> {
    Ok(Anomaly {
        id: row.get(0)?,
        entity_type: row.get(1)?,
        entity_id: row.get(2)?,
        anomaly_code: row.get(3)?,
        severity: row.get(4)?,
        message: row.get(5)?,
        detected_at: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
        resolved_at: row.get(7)?,
    })
}

fn row_to_generation_manifest(row: &rusqlite::Row<'_>) -> rusqlite::Result<GenerationManifest> {
    Ok(GenerationManifest {
        id: row.get(0)?,
        created_at: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
        artifact_kind: row.get(2)?,
        target_role_family: row.get(3)?,
        job_posting_path: row.get(4)?,
        job_posting_sha256: row.get(5)?,
        build_policy_path: row.get(6)?,
        build_policy_sha256: row.get(7)?,
        candidate_profile_path: row.get(8)?,
        candidate_profile_sha256: row.get(9)?,
        library_export_path: row.get(10)?,
        library_export_sha256: row.get(11)?,
        selected_record_ids: parse_json_opt(row.get(12)?),
        selected_evidence_ids: parse_json_opt(row.get(13)?),
        gap_report: parse_json_opt(row.get(14)?),
        artifact_paths: parse_json_opt(row.get(15)?),
        artifact_hashes: parse_json_opt(row.get(16)?),
        notes: row.get(17)?,
    })
}

pub fn get_anomalies(conn: &Connection) -> Result<Vec<Anomaly>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, entity_type, entity_id, anomaly_code, severity, message, detected_at, resolved_at
             FROM anomalies
             ORDER BY resolved_at IS NULL DESC, detected_at DESC, id ASC",
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map([], row_to_anomaly)
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

pub fn get_anomaly(conn: &Connection, id: &str) -> Result<Option<Anomaly>, String> {
    conn.query_row(
        "SELECT id, entity_type, entity_id, anomaly_code, severity, message, detected_at, resolved_at
         FROM anomalies
         WHERE id = ?1",
        params![id],
        row_to_anomaly,
    )
    .optional()
    .map_err(|error| error.to_string())
}

pub fn resolve_anomaly(conn: &Connection, id: String) -> Result<Anomaly, String> {
    let affected = conn
        .execute(
            "UPDATE anomalies SET resolved_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?1",
            params![id],
        )
        .map_err(|error| error.to_string())?;
    if affected == 0 {
        return Err(format!("Anomaly {id} not found."));
    }
    get_anomaly(conn, &id)?.ok_or_else(|| format!("Anomaly {id} was not found after resolve."))
}

pub fn reopen_anomaly(conn: &Connection, id: String) -> Result<Anomaly, String> {
    let affected = conn
        .execute(
            "UPDATE anomalies SET resolved_at = NULL WHERE id = ?1",
            params![id],
        )
        .map_err(|error| error.to_string())?;
    if affected == 0 {
        return Err(format!("Anomaly {id} not found."));
    }
    get_anomaly(conn, &id)?.ok_or_else(|| format!("Anomaly {id} was not found after reopen."))
}

pub fn delete_anomaly(conn: &Connection, id: String) -> Result<(), String> {
    conn.execute("DELETE FROM anomalies WHERE id = ?1", params![id])
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn get_generation_manifests(conn: &Connection) -> Result<Vec<GenerationManifest>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, created_at, artifact_kind, target_role_family, job_posting_path, job_posting_sha256,
                    build_policy_path, build_policy_sha256, candidate_profile_path, candidate_profile_sha256,
                        library_export_path, library_export_sha256, selected_record_ids_json,
                        selected_evidence_ids_json, gap_report_json, artifact_paths_json,
                        artifact_hashes_json, notes
             FROM generation_manifests
             ORDER BY created_at DESC, id DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map([], row_to_generation_manifest)
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

pub fn get_generation_manifest(
    conn: &Connection,
    id: &str,
) -> Result<Option<GenerationManifest>, String> {
    conn.query_row(
        "SELECT id, created_at, artifact_kind, target_role_family, job_posting_path, job_posting_sha256,
                build_policy_path, build_policy_sha256, candidate_profile_path, candidate_profile_sha256,
            library_export_path, library_export_sha256, selected_record_ids_json,
            selected_evidence_ids_json, gap_report_json, artifact_paths_json,
            artifact_hashes_json, notes
         FROM generation_manifests
         WHERE id = ?1",
        params![id],
        row_to_generation_manifest,
    )
    .optional()
    .map_err(|error| error.to_string())
}

pub fn delete_generation_manifest(conn: &Connection, id: String) -> Result<(), String> {
    conn.execute(
        "DELETE FROM generation_manifests WHERE id = ?1",
        params![id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn create_generation_manifest(
    conn: &Connection,
    manifest: NewGenerationManifest,
) -> Result<GenerationManifest, String> {
    let id = Uuid::new_v4().to_string();
    let artifact_kind = manifest.artifact_kind.trim();
    if artifact_kind.is_empty() {
        return Err("Generation manifest artifact_kind must be a non-empty string.".to_string());
    }

    conn.execute(
        "INSERT INTO generation_manifests (
            id,
            artifact_kind,
            target_role_family,
            job_posting_path,
            job_posting_sha256,
            build_policy_path,
            build_policy_sha256,
            candidate_profile_path,
            candidate_profile_sha256,
            library_export_path,
            library_export_sha256,
            selected_record_ids_json,
            selected_evidence_ids_json,
            gap_report_json,
            artifact_paths_json,
            artifact_hashes_json,
            notes
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17
        )",
        params![
            id,
            artifact_kind,
            manifest.target_role_family,
            manifest.job_posting_path,
            manifest.job_posting_sha256,
            manifest.build_policy_path,
            manifest.build_policy_sha256,
            manifest.candidate_profile_path,
            manifest.candidate_profile_sha256,
            manifest.library_export_path,
            manifest.library_export_sha256,
            json_text_opt(&manifest.selected_record_ids)?,
            json_text_opt(&manifest.selected_evidence_ids)?,
            json_text_opt(&manifest.gap_report)?,
            json_text_opt(&manifest.artifact_paths)?,
            json_text_opt(&manifest.artifact_hashes)?,
            manifest.notes,
        ],
    )
    .map_err(|error| error.to_string())?;

    get_generation_manifest(conn, &id)?
        .ok_or_else(|| format!("Generation manifest {id} was not found immediately after insert."))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(crate::embedded_assets::CAREER_SCHEMA_SQL)
            .unwrap();
        conn
    }

    #[test]
    fn anomaly_lifecycle_round_trips() {
        let conn = setup_conn();
        let anomaly_id = "anomaly-1".to_string();

        conn.execute(
            "INSERT INTO anomalies (
                id, entity_type, entity_id, anomaly_code, severity, message, detected_at
             ) VALUES (?1, 'evidence_item', 'evidence-1', 'duplicate_claim', 'warning', ?2, ?3)",
            params![
                anomaly_id,
                "Duplicate claim detected",
                "2026-04-10T00:00:00Z"
            ],
        )
        .unwrap();

        let created = get_anomaly(&conn, &anomaly_id).unwrap().unwrap();
        assert!(created.resolved_at.is_none());

        let resolved = resolve_anomaly(&conn, created.id.clone()).unwrap();
        assert!(resolved.resolved_at.is_some());

        let reopened = reopen_anomaly(&conn, created.id.clone()).unwrap();
        assert!(reopened.resolved_at.is_none());
    }

    #[test]
    fn generation_manifest_insert_round_trips_json_fields() {
        let conn = setup_conn();

        let manifest = create_generation_manifest(
            &conn,
            NewGenerationManifest {
                artifact_kind: "assembled_resume".to_string(),
                target_role_family: Some("business_analyst".to_string()),
                job_posting_path: None,
                job_posting_sha256: Some("job-sha".to_string()),
                build_policy_path: Some(crate::build_policy::BUILD_POLICY_SOURCE_URI.to_string()),
                build_policy_sha256: Some("policy-sha".to_string()),
                candidate_profile_path: None,
                candidate_profile_sha256: Some("candidate-sha".to_string()),
                library_export_path: None,
                library_export_sha256: Some("library-sha".to_string()),
                selected_record_ids: Some(json!(["rec-1"])),
                selected_evidence_ids: Some(json!(["ev-1", "ev-2"])),
                gap_report: Some(json!({"supported_requirements": []})),
                artifact_paths: None,
                artifact_hashes: None,
                notes: Some("preview pipeline".to_string()),
            },
        )
        .unwrap();

        assert_eq!(manifest.artifact_kind, "assembled_resume");
        assert_eq!(
            manifest.target_role_family.as_deref(),
            Some("business_analyst")
        );
        assert_eq!(manifest.selected_record_ids, Some(json!(["rec-1"])));
        assert_eq!(
            manifest.selected_evidence_ids,
            Some(json!(["ev-1", "ev-2"]))
        );
        assert_eq!(manifest.notes.as_deref(), Some("preview pipeline"));
    }
}
