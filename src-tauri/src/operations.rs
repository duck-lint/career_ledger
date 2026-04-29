use crate::resume_assembler::GapReport;
use crate::resume_pipeline::RequirementReviewOverride;
use rusqlite::{params, types::Type, Connection, OptionalExtension};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::io;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct GenerationManifestArtifactMap {
    pub assembled_json: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bundle_json: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rendered_docx: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
struct PersistedRequirementReview {
    pub source_job_posting_sha256: String,
    pub reviewed_cluster_ids: Vec<String>,
    pub excluded_cluster_ids: Vec<String>,
    pub excluded_atom_ids: Vec<String>,
    pub useful_terms: Vec<String>,
    pub noise_terms: Vec<String>,
}

impl From<PersistedRequirementReview> for RequirementReviewOverride {
    fn from(value: PersistedRequirementReview) -> Self {
        Self {
            source_job_posting_sha256: value.source_job_posting_sha256,
            reviewed_cluster_ids: value.reviewed_cluster_ids,
            excluded_cluster_ids: value.excluded_cluster_ids,
            excluded_atom_ids: value.excluded_atom_ids,
            useful_terms: value.useful_terms,
            noise_terms: value.noise_terms,
        }
    }
}

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
    pub selected_record_ids: Option<Vec<String>>,
    pub selected_evidence_ids: Option<Vec<String>>,
    pub gap_report: Option<GapReport>,
    pub artifact_paths: Option<GenerationManifestArtifactMap>,
    pub artifact_hashes: Option<GenerationManifestArtifactMap>,
    pub requirement_review: Option<RequirementReviewOverride>,
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
    pub selected_record_ids: Option<Vec<String>>,
    pub selected_evidence_ids: Option<Vec<String>>,
    pub gap_report: Option<GapReport>,
    pub artifact_paths: Option<GenerationManifestArtifactMap>,
    pub artifact_hashes: Option<GenerationManifestArtifactMap>,
    pub requirement_review: Option<RequirementReviewOverride>,
    pub notes: Option<String>,
}

fn parse_json_column<T: DeserializeOwned>(
    raw: Option<String>,
    column_index: usize,
    column_name: &str,
) -> rusqlite::Result<Option<T>> {
    match raw {
        None => Ok(None),
        Some(value) => serde_json::from_str(&value).map(Some).map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                column_index,
                Type::Text,
                Box::new(io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("Failed to decode {column_name}: {error}"),
                )),
            )
        }),
    }
}

fn json_text_opt<T: Serialize>(value: &Option<T>) -> Result<Option<String>, String> {
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
        selected_record_ids: parse_json_column(row.get(12)?, 12, "selected_record_ids_json")?,
        selected_evidence_ids: parse_json_column(
            row.get(13)?,
            13,
            "selected_evidence_ids_json",
        )?,
        gap_report: parse_json_column(row.get(14)?, 14, "gap_report_json")?,
        artifact_paths: parse_json_column(row.get(15)?, 15, "artifact_paths_json")?,
        artifact_hashes: parse_json_column(row.get(16)?, 16, "artifact_hashes_json")?,
        requirement_review: parse_json_column::<PersistedRequirementReview>(
            row.get(17)?,
            17,
            "requirement_review_json",
        )?
        .map(Into::into),
        notes: row.get(18)?,
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
                        artifact_hashes_json, requirement_review_json, notes
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
            artifact_hashes_json, requirement_review_json, notes
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

pub fn update_generation_manifest_notes(
    conn: &Connection,
    id: &str,
    notes: Option<String>,
) -> Result<GenerationManifest, String> {
    let affected = conn
        .execute(
            "UPDATE generation_manifests SET notes = ?1 WHERE id = ?2",
            params![notes, id],
        )
        .map_err(|error| error.to_string())?;
    if affected == 0 {
        return Err(format!("Generation manifest {id} not found."));
    }
    get_generation_manifest(conn, id)?
        .ok_or_else(|| format!("Generation manifest {id} was not found after update."))
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
            requirement_review_json,
            notes
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18
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
            json_text_opt(&manifest.requirement_review)?,
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

    fn empty_gap_report() -> GapReport {
        GapReport {
            supported_requirements: Vec::new(),
            partially_supported_requirements: Vec::new(),
            unsupported_requirements: Vec::new(),
            compensation_strategy: Vec::new(),
            risk_flags: Vec::new(),
        }
    }

    fn sample_requirement_review() -> RequirementReviewOverride {
        RequirementReviewOverride {
            source_job_posting_sha256: "job-sha".to_string(),
            reviewed_cluster_ids: vec!["cluster-1".to_string()],
            excluded_cluster_ids: vec!["cluster-2".to_string()],
            excluded_atom_ids: vec!["atom-3".to_string()],
            useful_terms: vec!["python".to_string()],
            noise_terms: vec!["you".to_string()],
        }
    }

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
    fn generation_manifest_insert_round_trips_typed_fields() {
        let conn = setup_conn();
        let gap_report = empty_gap_report();
        let requirement_review = sample_requirement_review();
        let artifact_paths = GenerationManifestArtifactMap {
            assembled_json: "C:/tmp/resume_assembled.json".to_string(),
            bundle_json: Some("C:/tmp/resume_bundle.json".to_string()),
            rendered_docx: None,
        };
        let artifact_hashes = GenerationManifestArtifactMap {
            assembled_json: "assembled-sha".to_string(),
            bundle_json: Some("bundle-sha".to_string()),
            rendered_docx: None,
        };

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
                selected_record_ids: Some(vec!["rec-1".to_string()]),
                selected_evidence_ids: Some(vec!["ev-1".to_string(), "ev-2".to_string()]),
                gap_report: Some(gap_report.clone()),
                artifact_paths: Some(artifact_paths.clone()),
                artifact_hashes: Some(artifact_hashes.clone()),
                requirement_review: Some(requirement_review.clone()),
                notes: Some("preview pipeline".to_string()),
            },
        )
        .unwrap();

        assert_eq!(manifest.artifact_kind, "assembled_resume");
        assert_eq!(
            manifest.target_role_family.as_deref(),
            Some("business_analyst")
        );
        assert_eq!(manifest.selected_record_ids, Some(vec!["rec-1".to_string()]));
        assert_eq!(
            manifest.selected_evidence_ids,
            Some(vec!["ev-1".to_string(), "ev-2".to_string()])
        );
        assert_eq!(manifest.gap_report, Some(gap_report));
        assert_eq!(manifest.artifact_paths, Some(artifact_paths));
        assert_eq!(manifest.artifact_hashes, Some(artifact_hashes));
        assert_eq!(manifest.notes.as_deref(), Some("preview pipeline"));
        assert_eq!(manifest.requirement_review, Some(requirement_review));
    }

    #[test]
    fn generation_manifest_decode_fails_loud_on_invalid_json_shape() {
        let conn = setup_conn();

        conn.execute(
            "INSERT INTO generation_manifests (id, artifact_kind, selected_record_ids_json) VALUES (?1, ?2, ?3)",
            params!["manifest-bad-shape", "assembled_resume", r#"{"unexpected":"shape"}"#],
        )
        .unwrap();

        let error = get_generation_manifests(&conn).unwrap_err();
        assert!(error.contains("selected_record_ids_json"));
    }

    #[test]
    fn generation_manifest_decode_fails_loud_on_incomplete_requirement_review() {
        let conn = setup_conn();

        conn.execute(
            "INSERT INTO generation_manifests (id, artifact_kind, requirement_review_json) VALUES (?1, ?2, ?3)",
            params![
                "manifest-bad-review",
                "assembled_resume",
                r#"{"source_job_posting_sha256":"job-sha","reviewed_cluster_ids":[],"excluded_cluster_ids":[],"excluded_atom_ids":[],"useful_terms":[]}"#,
            ],
        )
        .unwrap();

        let error = get_generation_manifests(&conn).unwrap_err();
        assert!(error.contains("requirement_review_json"));
    }

    #[test]
    fn generation_manifest_decode_fails_loud_on_unknown_artifact_map_key() {
        let conn = setup_conn();

        conn.execute(
            "INSERT INTO generation_manifests (id, artifact_kind, artifact_paths_json) VALUES (?1, ?2, ?3)",
            params![
                "manifest-bad-artifacts",
                "assembled_resume",
                r#"{"assembled_json":"C:/tmp/resume_assembled.json","bundle":"C:/tmp/resume_bundle.json"}"#,
            ],
        )
        .unwrap();

        let error = get_generation_manifests(&conn).unwrap_err();
        assert!(error.contains("artifact_paths_json"));
    }

    #[test]
    fn update_generation_manifest_notes_round_trips() {
        let conn = setup_conn();

        let manifest = create_generation_manifest(
            &conn,
            NewGenerationManifest {
                artifact_kind: "assembled_resume".to_string(),
                target_role_family: Some("business_analyst".to_string()),
                job_posting_path: None,
                job_posting_sha256: None,
                build_policy_path: None,
                build_policy_sha256: None,
                candidate_profile_path: None,
                candidate_profile_sha256: None,
                library_export_path: None,
                library_export_sha256: None,
                selected_record_ids: None,
                selected_evidence_ids: None,
                gap_report: None,
                artifact_paths: None,
                artifact_hashes: None,
                requirement_review: None,
                notes: None,
            },
        )
        .unwrap();

        assert!(manifest.notes.is_none());

        let updated = update_generation_manifest_notes(
            &conn,
            &manifest.id,
            Some("post-hoc annotation".to_string()),
        )
        .unwrap();
        assert_eq!(updated.notes.as_deref(), Some("post-hoc annotation"));

        let cleared = update_generation_manifest_notes(&conn, &manifest.id, None).unwrap();
        assert!(cleared.notes.is_none());
    }

    #[test]
    fn update_generation_manifest_notes_rejects_missing_id() {
        let conn = setup_conn();
        let result =
            update_generation_manifest_notes(&conn, "nonexistent-id", Some("note".to_string()));
        assert!(result.is_err());
    }
}
