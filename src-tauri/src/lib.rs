mod build_policy;
mod bundle_prep;
mod candidate_profile;
mod docx_renderer;
mod embedded_assets;
mod inference;
mod intake;
mod library_export;
mod operations;
mod preflight_filter;
mod project_paths;
mod requirement_analysis;
mod resume_assembler;
mod resume_pipeline;
mod taxonomy;
mod validation;

use crate::build_policy::BuildPolicy;
use crate::bundle_prep::{BundleSemantics, ResumeBundleInput};
use crate::candidate_profile::CandidateProfile;
use crate::embedded_assets::CAREER_SCHEMA_SQL;
use crate::inference::{
    EvidenceInferenceComparison, EvidenceRecordContext, EvidenceSaveDecision, EvidenceValueSource,
};
use crate::intake::{RawIntakeImportResult, RawIntakePreviewResult};
use crate::library_export::CareerLibraryExport;
use crate::operations::{Anomaly, GenerationManifest};
use crate::preflight_filter::PreflightFilterResult;
use crate::requirement_analysis::RequirementAnalysis;
use crate::resume_assembler::ResumeAssemblyResult;
use crate::resume_pipeline::{ResumePipelineRequest, ResumePipelineResult};
use crate::taxonomy::{
    CanonicalTag, DeliveryToolkitCategory, LibraryTagRefreshResult, LibraryTagSyncStatus,
    TagInferenceMarker, TagInferenceMarkerInput, TagNormalizationResult, TaxonomyImportResult,
};
use crate::validation::{
    normalize_optional_owned, normalize_required_record_type, normalize_required_text,
    slugify_record_slug,
};
use rusqlite::{params, params_from_iter, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;
use uuid::Uuid;

pub struct ActiveDbState(pub Mutex<Option<String>>);

const OPEN_ENDED_DATE_MARKERS: [&str; 4] = ["present", "current", "ongoing", "now"];
const LATEST_RUNTIME_DB_VERSION: i32 = 2;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExperienceRecord {
    pub id: String,
    pub slug: String,
    pub record_type: String,
    pub organization: String,
    pub title: String,
    pub start_date: String,
    pub end_date: String,
    pub location: Option<String>,
    pub employment_type: Option<String>,
    pub context_tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExperienceRecordFormData {
    pub slug: String,
    pub record_type: String,
    pub organization: String,
    pub title: String,
    pub start_date: String,
    pub end_date: String,
    pub location: Option<String>,
    pub employment_type: Option<String>,
    pub context_tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Evidence {
    pub id: String,
    pub experience_record_id: String,
    pub claim: String,
    pub date_range: Option<String>,
    pub tags: Vec<String>,
    pub evidence_note: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EvidenceFormData {
    pub claim: String,
    pub date_range: Option<String>,
    pub tags: Vec<String>,
    pub evidence_note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EvidenceSaveResponse {
    pub status: String,
    pub evidence: Option<Evidence>,
    pub comparison: EvidenceInferenceComparison,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeleteBatchOptions {
    pub strict: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRecordPreviewItem {
    pub id: String,
    pub slug: String,
    pub organization: String,
    pub title: String,
    pub linked_evidence_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRecordsPreview {
    pub requested_count: i64,
    pub found_count: i64,
    pub missing_ids: Vec<String>,
    pub records: Vec<DeleteRecordPreviewItem>,
    pub cascade_evidence_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRecordsResult {
    pub requested_count: i64,
    pub found_count: i64,
    pub missing_ids: Vec<String>,
    pub records: Vec<DeleteRecordPreviewItem>,
    pub cascade_evidence_count: i64,
    pub deleted_record_count: i64,
    pub deleted_evidence_count: i64,
    pub strict: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeleteEvidencePreviewItem {
    pub id: String,
    pub experience_record_id: String,
    pub record_slug: Option<String>,
    pub claim: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeleteEvidenceItemsPreview {
    pub requested_count: i64,
    pub found_count: i64,
    pub missing_ids: Vec<String>,
    pub evidence_items: Vec<DeleteEvidencePreviewItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeleteEvidenceItemsResult {
    pub requested_count: i64,
    pub found_count: i64,
    pub missing_ids: Vec<String>,
    pub evidence_items: Vec<DeleteEvidencePreviewItem>,
    pub deleted_evidence_count: i64,
    pub strict: bool,
}

#[derive(Debug, Clone)]
struct EvidenceDraftNormalized {
    claim: String,
    date_range: Option<String>,
    manual_tags: Vec<String>,
    unknown_manual_tags: Vec<String>,
    evidence_note: Option<String>,
}

fn parse_tags(raw: Option<String>) -> Vec<String> {
    raw.and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok())
        .unwrap_or_default()
}

fn tags_to_json(tags: &[String]) -> String {
    serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string())
}

fn new_id() -> String {
    Uuid::new_v4().to_string()
}

fn default_runtime_db_path_from_app_local_data(app_local_data_dir: &Path) -> PathBuf {
    app_local_data_dir.join("career.db")
}

fn default_runtime_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_local_data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))?;

    fs::create_dir_all(&app_local_data_dir).map_err(|error| {
        format!(
            "Failed to create app local data directory {}: {error}",
            app_local_data_dir.display()
        )
    })?;

    Ok(default_runtime_db_path_from_app_local_data(
        &app_local_data_dir,
    ))
}

fn normalize_runtime_db_path(path: PathBuf) -> Result<PathBuf, String> {
    if path.exists() {
        if path.is_dir() {
            return Err(format!(
                "Database path must point to a file, not a directory: {}",
                path.display()
            ));
        }

        return path.canonicalize().map_err(|error| {
            format!(
                "Failed to resolve database path {}: {error}",
                path.display()
            )
        });
    }

    let Some(file_name) = path.file_name() else {
        return Err("Database path must include a file name.".to_string());
    };

    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let parent = if parent.as_os_str().is_empty() {
        env::current_dir()
            .map_err(|error| format!("Failed to resolve current directory: {error}"))?
    } else if parent.exists() {
        parent.canonicalize().map_err(|error| {
            format!(
                "Failed to resolve database directory {}: {error}",
                parent.display()
            )
        })?
    } else {
        return Err(format!(
            "Database directory does not exist: {}",
            parent.display()
        ));
    };

    Ok(parent.join(file_name))
}

fn resolve_runtime_db_path_with_default(
    default_db_path: &Path,
    db_path: Option<&str>,
) -> Result<PathBuf, String> {
    let requested_path =
        db_path.and_then(|value| normalize_optional_owned(Some(value.to_string())));
    let path = match requested_path {
        Some(value) => {
            let candidate = PathBuf::from(value);
            if candidate.is_absolute() {
                candidate
            } else {
                env::current_dir()
                    .map_err(|error| format!("Failed to resolve current directory: {error}"))?
                    .join(candidate)
            }
        }
        None => default_db_path.to_path_buf(),
    };

    normalize_runtime_db_path(path)
}

fn resolve_runtime_db_path(
    app: &tauri::AppHandle,
    db_path: Option<&str>,
) -> Result<PathBuf, String> {
    let default_db_path = default_runtime_db_path(app)?;
    resolve_runtime_db_path_with_default(&default_db_path, db_path)
}

fn runtime_db_user_version(conn: &Connection) -> Result<i32, String> {
    conn.query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|error| error.to_string())
}

fn set_runtime_db_user_version(conn: &Connection, version: i32) -> Result<(), String> {
    conn.pragma_update(None, "user_version", version)
        .map_err(|error| error.to_string())
}

fn migrate_runtime_db_to_v1(conn: &Connection) -> Result<(), String> {
    build_policy::ensure_build_policy_seeded(conn)?;
    set_runtime_db_user_version(conn, 1)
}

fn generation_manifests_has_requirement_review(conn: &Connection) -> Result<bool, String> {
    let mut stmt = conn
        .prepare("PRAGMA table_info(generation_manifests)")
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?;
    for row in rows {
        if row.map_err(|error| error.to_string())? == "requirement_review_json" {
            return Ok(true);
        }
    }
    Ok(false)
}

fn migrate_runtime_db_to_v2(conn: &Connection) -> Result<(), String> {
    if !generation_manifests_has_requirement_review(conn)? {
        conn.execute(
            "ALTER TABLE generation_manifests ADD COLUMN requirement_review_json TEXT",
            [],
        )
        .map_err(|error| error.to_string())?;
    }
    set_runtime_db_user_version(conn, 2)
}

fn run_runtime_db_migrations(conn: &Connection) -> Result<(), String> {
    let current_version = runtime_db_user_version(conn)?;
    if current_version > LATEST_RUNTIME_DB_VERSION {
        return Err(format!(
            "Database schema version {current_version} is newer than this app supports ({LATEST_RUNTIME_DB_VERSION})."
        ));
    }

    match current_version {
        0 => {
            migrate_runtime_db_to_v1(conn)?;
            migrate_runtime_db_to_v2(conn)?;
        }
        1 => {
            build_policy::ensure_build_policy_seeded(conn)?;
            migrate_runtime_db_to_v2(conn)?;
        }
        2 => build_policy::ensure_build_policy_seeded(conn)?,
        _ => unreachable!("runtime db version validated above"),
    }

    Ok(())
}

fn open_runtime_connection(
    app: &tauri::AppHandle,
    db_path: Option<&str>,
) -> Result<(Connection, String), String> {
    let db_path = resolve_runtime_db_path(app, db_path)?;
    let db_preexisting = db_path.exists();
    let resolved_path = db_path.display().to_string();
    let conn = open_configured_runtime_connection(&db_path)?;
    conn.execute_batch(CAREER_SCHEMA_SQL)
        .map_err(|e| e.to_string())?;
    run_runtime_db_migrations(&conn)?;
    if db_preexisting {
        taxonomy::ensure_runtime_taxonomy_seeded(&conn)?;
    } else {
        taxonomy::clear_runtime_taxonomy(&conn)?;
    }
    Ok((conn, resolved_path))
}

fn open_configured_runtime_connection(db_path: &Path) -> Result<Connection, String> {
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    conn.execute("PRAGMA foreign_keys = ON;", [])
        .map_err(|error| error.to_string())?;
    conn.busy_timeout(Duration::from_secs(5))
        .map_err(|error| error.to_string())?;
    Ok(conn)
}

fn get_active_runtime_db_path(state: &ActiveDbState) -> Result<String, String> {
    state
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| "Database not initialized".to_string())
}

fn open_active_runtime_connection(state: &ActiveDbState) -> Result<Connection, String> {
    let active_path = get_active_runtime_db_path(state)?;
    open_configured_runtime_connection(Path::new(&active_path))
}

pub(crate) fn experience_record_order_by_clause() -> String {
    let normalized_end_date = "LOWER(TRIM(COALESCE(end_date, '')))";
    let open_ended_markers = OPEN_ENDED_DATE_MARKERS
        .iter()
        .map(|marker| format!("'{marker}'"))
        .collect::<Vec<_>>()
        .join(", ");
    let open_ended_predicate =
        format!("{normalized_end_date} = '' OR {normalized_end_date} IN ({open_ended_markers})");

    format!(
        "CASE WHEN {open_ended_predicate} THEN 1 ELSE 0 END DESC, \
         CASE WHEN {open_ended_predicate} THEN '' ELSE end_date END DESC, \
         start_date DESC, organization COLLATE NOCASE ASC, title COLLATE NOCASE ASC, id ASC"
    )
}

fn get_records_impl(conn: &Connection) -> Result<Vec<ExperienceRecord>, String> {
    let query = format!(
        "SELECT id, slug, record_type, organization, title, start_date, end_date, \
                location, employment_type, context_tags_json, created_at, updated_at \
         FROM experience_records ORDER BY {}",
        experience_record_order_by_clause()
    );
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], row_to_record)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn row_to_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<ExperienceRecord> {
    Ok(ExperienceRecord {
        id: row.get(0)?,
        slug: row.get(1)?,
        record_type: row.get(2)?,
        organization: row.get(3)?,
        title: row.get(4)?,
        start_date: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
        end_date: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
        location: row.get(7)?,
        employment_type: row.get(8)?,
        context_tags: parse_tags(row.get(9)?),
        created_at: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
        updated_at: row.get::<_, Option<String>>(11)?.unwrap_or_default(),
    })
}

fn row_to_evidence(row: &rusqlite::Row<'_>) -> rusqlite::Result<Evidence> {
    Ok(Evidence {
        id: row.get(0)?,
        experience_record_id: row.get(1)?,
        claim: row.get(2)?,
        date_range: row.get(3)?,
        tags: parse_tags(row.get(4)?),
        evidence_note: row.get(5)?,
        created_at: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
        updated_at: row.get::<_, Option<String>>(7)?.unwrap_or_default(),
    })
}

fn get_record_by_id(conn: &Connection, id: &str) -> Result<ExperienceRecord, String> {
    conn.query_row(
        "SELECT id, slug, record_type, organization, title, start_date, end_date,
                location, employment_type, context_tags_json, created_at, updated_at
         FROM experience_records WHERE id = ?1",
        params![id],
        row_to_record,
    )
    .map_err(|e| e.to_string())
}

fn get_evidence_by_id(conn: &Connection, id: &str) -> Result<Evidence, String> {
    conn.query_row(
        "SELECT id, experience_record_id, claim, date_range, tags_json,
        evidence_note, created_at, updated_at
         FROM evidence_items WHERE id = ?1",
        params![id],
        row_to_evidence,
    )
    .map_err(|e| e.to_string())
}

fn normalize_delete_ids(ids: Vec<String>) -> Vec<String> {
    let mut normalized_ids = Vec::new();

    for id in ids
        .into_iter()
        .filter_map(|value| normalize_optional_owned(Some(value)))
    {
        if !normalized_ids.iter().any(|existing| existing == &id) {
            normalized_ids.push(id);
        }
    }

    normalized_ids
}

fn sql_placeholders(count: usize) -> String {
    std::iter::repeat_n("?", count)
        .collect::<Vec<_>>()
        .join(", ")
}

fn assert_strict_batch_delete_ready(
    entity_label: &str,
    missing_ids: &[String],
    strict: bool,
) -> Result<(), String> {
    if !strict || missing_ids.is_empty() {
        return Ok(());
    }

    Err(format!(
        "Strict batch delete aborted because these {entity_label} were missing: {}",
        missing_ids.join(", ")
    ))
}

fn preview_delete_records_impl(
    conn: &Connection,
    ids: Vec<String>,
) -> Result<DeleteRecordsPreview, String> {
    let normalized_ids = normalize_delete_ids(ids);
    if normalized_ids.is_empty() {
        return Ok(DeleteRecordsPreview {
            requested_count: 0,
            found_count: 0,
            missing_ids: Vec::new(),
            records: Vec::new(),
            cascade_evidence_count: 0,
        });
    }

    let placeholders = sql_placeholders(normalized_ids.len());
    let records_query = format!(
        "SELECT id, slug, organization, title FROM experience_records WHERE id IN ({placeholders})"
    );
    let mut records_stmt = conn
        .prepare(&records_query)
        .map_err(|error| error.to_string())?;
    let record_rows = records_stmt
        .query_map(params_from_iter(normalized_ids.iter()), |row| {
            let id: String = row.get(0)?;
            Ok((
                id.clone(),
                DeleteRecordPreviewItem {
                    id,
                    slug: row.get(1)?,
                    organization: row.get(2)?,
                    title: row.get(3)?,
                    linked_evidence_count: 0,
                },
            ))
        })
        .map_err(|error| error.to_string())?;

    let mut record_map = HashMap::<String, DeleteRecordPreviewItem>::new();
    for row in record_rows {
        let (id, preview_item) = row.map_err(|error| error.to_string())?;
        record_map.insert(id, preview_item);
    }

    let evidence_counts_query = format!(
        "SELECT experience_record_id, COUNT(*) FROM evidence_items WHERE experience_record_id IN ({placeholders}) GROUP BY experience_record_id"
    );
    let mut evidence_counts_stmt = conn
        .prepare(&evidence_counts_query)
        .map_err(|error| error.to_string())?;
    let evidence_count_rows = evidence_counts_stmt
        .query_map(params_from_iter(normalized_ids.iter()), |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(|error| error.to_string())?;

    let mut evidence_count_map = HashMap::<String, i64>::new();
    for row in evidence_count_rows {
        let (record_id, evidence_count) = row.map_err(|error| error.to_string())?;
        evidence_count_map.insert(record_id, evidence_count);
    }

    let missing_ids = normalized_ids
        .iter()
        .filter(|id| !record_map.contains_key(*id))
        .cloned()
        .collect::<Vec<_>>();
    let records = normalized_ids
        .iter()
        .filter_map(|id| {
            record_map.remove(id).map(|mut preview_item| {
                preview_item.linked_evidence_count = *evidence_count_map.get(id).unwrap_or(&0);
                preview_item
            })
        })
        .collect::<Vec<_>>();
    let cascade_evidence_count = records
        .iter()
        .map(|record| record.linked_evidence_count)
        .sum();

    Ok(DeleteRecordsPreview {
        requested_count: normalized_ids.len() as i64,
        found_count: records.len() as i64,
        missing_ids,
        records,
        cascade_evidence_count,
    })
}

fn delete_records_impl(
    conn: &mut Connection,
    ids: Vec<String>,
    options: Option<DeleteBatchOptions>,
) -> Result<DeleteRecordsResult, String> {
    let strict = options.and_then(|value| value.strict).unwrap_or(true);
    let transaction = conn.transaction().map_err(|error| error.to_string())?;
    let preview = preview_delete_records_impl(&transaction, ids)?;
    assert_strict_batch_delete_ready("record ids", &preview.missing_ids, strict)?;

    if !preview.records.is_empty() {
        let record_ids = preview
            .records
            .iter()
            .map(|record| record.id.as_str())
            .collect::<Vec<_>>();
        let delete_query = format!(
            "DELETE FROM experience_records WHERE id IN ({})",
            sql_placeholders(record_ids.len())
        );
        transaction
            .execute(&delete_query, params_from_iter(record_ids.iter()))
            .map_err(|error| error.to_string())?;
    }

    transaction.commit().map_err(|error| error.to_string())?;

    Ok(DeleteRecordsResult {
        requested_count: preview.requested_count,
        found_count: preview.found_count,
        missing_ids: preview.missing_ids,
        records: preview.records,
        cascade_evidence_count: preview.cascade_evidence_count,
        deleted_record_count: preview.found_count,
        deleted_evidence_count: preview.cascade_evidence_count,
        strict,
    })
}

fn preview_delete_evidence_items_impl(
    conn: &Connection,
    ids: Vec<String>,
) -> Result<DeleteEvidenceItemsPreview, String> {
    let normalized_ids = normalize_delete_ids(ids);
    if normalized_ids.is_empty() {
        return Ok(DeleteEvidenceItemsPreview {
            requested_count: 0,
            found_count: 0,
            missing_ids: Vec::new(),
            evidence_items: Vec::new(),
        });
    }

    let placeholders = sql_placeholders(normalized_ids.len());
    let preview_query = format!(
        "SELECT e.id, e.experience_record_id, e.claim, r.slug
         FROM evidence_items e
         LEFT JOIN experience_records r ON r.id = e.experience_record_id
         WHERE e.id IN ({placeholders})"
    );
    let mut preview_stmt = conn
        .prepare(&preview_query)
        .map_err(|error| error.to_string())?;
    let preview_rows = preview_stmt
        .query_map(params_from_iter(normalized_ids.iter()), |row| {
            let id: String = row.get(0)?;
            Ok((
                id.clone(),
                DeleteEvidencePreviewItem {
                    id,
                    experience_record_id: row.get(1)?,
                    claim: row.get(2)?,
                    record_slug: row.get(3)?,
                },
            ))
        })
        .map_err(|error| error.to_string())?;

    let mut preview_map = HashMap::<String, DeleteEvidencePreviewItem>::new();
    for row in preview_rows {
        let (id, preview_item) = row.map_err(|error| error.to_string())?;
        preview_map.insert(id, preview_item);
    }

    let missing_ids = normalized_ids
        .iter()
        .filter(|id| !preview_map.contains_key(*id))
        .cloned()
        .collect::<Vec<_>>();
    let evidence_items = normalized_ids
        .iter()
        .filter_map(|id| preview_map.remove(id))
        .collect::<Vec<_>>();

    Ok(DeleteEvidenceItemsPreview {
        requested_count: normalized_ids.len() as i64,
        found_count: evidence_items.len() as i64,
        missing_ids,
        evidence_items,
    })
}

fn delete_evidence_items_impl(
    conn: &mut Connection,
    ids: Vec<String>,
    options: Option<DeleteBatchOptions>,
) -> Result<DeleteEvidenceItemsResult, String> {
    let strict = options.and_then(|value| value.strict).unwrap_or(true);
    let transaction = conn.transaction().map_err(|error| error.to_string())?;
    let preview = preview_delete_evidence_items_impl(&transaction, ids)?;
    assert_strict_batch_delete_ready("evidence item ids", &preview.missing_ids, strict)?;

    if !preview.evidence_items.is_empty() {
        let evidence_ids = preview
            .evidence_items
            .iter()
            .map(|item| item.id.as_str())
            .collect::<Vec<_>>();
        let delete_query = format!(
            "DELETE FROM evidence_items WHERE id IN ({})",
            sql_placeholders(evidence_ids.len())
        );
        transaction
            .execute(&delete_query, params_from_iter(evidence_ids.iter()))
            .map_err(|error| error.to_string())?;
    }

    transaction.commit().map_err(|error| error.to_string())?;

    Ok(DeleteEvidenceItemsResult {
        requested_count: preview.requested_count,
        found_count: preview.found_count,
        missing_ids: preview.missing_ids,
        evidence_items: preview.evidence_items,
        deleted_evidence_count: preview.found_count,
        strict,
    })
}

fn slug_exists(conn: &Connection, slug: &str, exclude_id: Option<&str>) -> Result<bool, String> {
    let query = if exclude_id.is_some() {
        "SELECT 1 FROM experience_records WHERE slug = ?1 AND id != ?2 LIMIT 1"
    } else {
        "SELECT 1 FROM experience_records WHERE slug = ?1 LIMIT 1"
    };

    let exists = if let Some(exclude_id) = exclude_id {
        conn.query_row(query, params![slug, exclude_id], |_| Ok(()))
    } else {
        conn.query_row(query, params![slug], |_| Ok(()))
    }
    .map(|_| true)
    .or_else(|err| {
        if matches!(err, rusqlite::Error::QueryReturnedNoRows) {
            Ok(false)
        } else {
            Err(err)
        }
    })
    .map_err(|e: rusqlite::Error| e.to_string())?;

    Ok(exists)
}

fn normalize_record_form_data(
    conn: &Connection,
    data: ExperienceRecordFormData,
    exclude_id: Option<&str>,
) -> Result<ExperienceRecordFormData, String> {
    let record_type =
        normalize_required_record_type(Some(data.record_type.as_str()), "record_type")?;
    let organization = normalize_required_text(Some(data.organization.as_str()), "organization")?;
    let title = normalize_required_text(Some(data.title.as_str()), "title")?;
    let start_date = normalize_optional_owned(Some(data.start_date)).unwrap_or_default();
    let end_date = normalize_optional_owned(Some(data.end_date)).unwrap_or_default();
    let mut slug = normalize_optional_owned(Some(data.slug))
        .unwrap_or_else(|| slugify_record_slug(&format!("{organization}-{title}")));
    slug = slugify_record_slug(&slug);
    if slug.is_empty() {
        return Err(
            "Slug is required and could not be generated. Please enter a slug.".to_string(),
        );
    }
    if slug_exists(conn, &slug, exclude_id)? {
        return Err(format!(
            "Slug '{slug}' already exists. Please choose a unique slug."
        ));
    }

    let location = if record_type == "employment" {
        normalize_optional_owned(data.location)
    } else {
        None
    };
    let employment_type = if record_type == "employment" {
        normalize_optional_owned(data.employment_type)
    } else {
        None
    };
    let context_tags = taxonomy::canonicalize_tags(conn, &data.context_tags)?;

    Ok(ExperienceRecordFormData {
        slug,
        record_type,
        organization,
        title,
        start_date,
        end_date,
        location,
        employment_type,
        context_tags,
    })
}

fn normalize_evidence_form_data(
    conn: &Connection,
    data: EvidenceFormData,
    require_claim: bool,
) -> Result<EvidenceDraftNormalized, String> {
    let EvidenceFormData {
        claim: raw_claim,
        date_range,
        tags,
        evidence_note,
    } = data;

    let claim = if require_claim {
        normalize_required_text(Some(raw_claim.as_str()), "claim")?
    } else {
        normalize_optional_owned(Some(raw_claim)).unwrap_or_default()
    };
    let date_range = normalize_optional_owned(date_range);
    let tag_result = taxonomy::normalize_tags(conn, &tags)?;
    let evidence_note = normalize_optional_owned(evidence_note);

    Ok(EvidenceDraftNormalized {
        claim,
        date_range,
        manual_tags: tag_result.normalized,
        unknown_manual_tags: tag_result.unknown,
        evidence_note,
    })
}

fn get_record_inference_context(
    conn: &Connection,
    record_id: &str,
) -> Result<EvidenceRecordContext, String> {
    let record = get_record_by_id(conn, record_id)?;
    Ok(EvidenceRecordContext {
        record_type: record.record_type,
        organization: record.organization,
        title: record.title,
    })
}

fn build_evidence_inference_comparison(
    conn: &Connection,
    record_context: &EvidenceRecordContext,
    draft: &EvidenceDraftNormalized,
) -> Result<EvidenceInferenceComparison, String> {
    inference::compare_evidence_inference(
        conn,
        record_context,
        &draft.claim,
        draft.evidence_note.as_deref(),
        draft.manual_tags.clone(),
        draft.unknown_manual_tags.clone(),
    )
}

fn choose_tags_for_save(
    draft: &EvidenceDraftNormalized,
    comparison: &EvidenceInferenceComparison,
    decision: Option<&EvidenceSaveDecision>,
) -> Result<Option<Vec<String>>, String> {
    if !comparison.tags_match {
        let choice = decision.and_then(|item| item.tags_source.as_ref());
        let Some(choice) = choice else {
            return Ok(None);
        };
        return match choice {
            EvidenceValueSource::Manual => {
                if !comparison.unknown_manual_tags.is_empty() {
                    Err(format!(
                        "Unknown tags: {}",
                        comparison.unknown_manual_tags.join(", ")
                    ))
                } else {
                    Ok(Some(draft.manual_tags.clone()))
                }
            }
            EvidenceValueSource::Inferred => Ok(Some(comparison.inferred_tags.clone())),
        };
    }

    if !comparison.unknown_manual_tags.is_empty() {
        return Err(format!(
            "Unknown tags: {}",
            comparison.unknown_manual_tags.join(", ")
        ));
    }

    Ok(Some(draft.manual_tags.clone()))
}

fn resolve_evidence_values_for_save(
    draft: &EvidenceDraftNormalized,
    comparison: &EvidenceInferenceComparison,
    decision: Option<&EvidenceSaveDecision>,
) -> Result<Option<Vec<String>>, String> {
    let Some(tags) = choose_tags_for_save(draft, comparison, decision)? else {
        return Ok(None);
    };

    if tags.is_empty() {
        return Err(
            "Evidence must resolve to at least one canonical tag before saving.".to_string(),
        );
    }

    Ok(Some(tags))
}

#[tauri::command]
fn initialize_db(
    app: tauri::AppHandle,
    active_db_state: tauri::State<ActiveDbState>,
    db_path: Option<String>,
) -> Result<(), String> {
    let (_conn, resolved_path) = open_runtime_connection(&app, db_path.as_deref())?;

    let mut path_guard = active_db_state
        .inner()
        .0
        .lock()
        .map_err(|e| e.to_string())?;
    *path_guard = Some(resolved_path);
    Ok(())
}

#[tauri::command]
fn get_active_db_path(
    app: tauri::AppHandle,
    active_db_state: tauri::State<ActiveDbState>,
) -> Result<String, String> {
    let guard = active_db_state
        .inner()
        .0
        .lock()
        .map_err(|e| e.to_string())?;
    if let Some(path) = guard.as_ref() {
        return Ok(path.clone());
    }

    resolve_runtime_db_path(&app, None).map(|path| path.display().to_string())
}

#[tauri::command]
fn build_career_library_export(
    state: tauri::State<ActiveDbState>,
) -> Result<CareerLibraryExport, String> {
    let conn = open_active_runtime_connection(state.inner())?;

    let source_db_name = Path::new(get_active_runtime_db_path(state.inner())?.as_str())
        .file_name()
        .and_then(|value| value.to_str())
        .map(str::to_string)
        .unwrap_or_else(|| "career.db".to_string());

    library_export::build_career_library_export(&conn, &source_db_name)
}

#[tauri::command]
fn build_requirement_analysis(
    state: tauri::State<ActiveDbState>,
    job_posting_text: String,
) -> Result<RequirementAnalysis, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    requirement_analysis::build_requirement_analysis(&conn, &job_posting_text)
}

#[tauri::command]
fn get_build_policy(state: tauri::State<ActiveDbState>) -> Result<BuildPolicy, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    build_policy::get_build_policy(&conn)
}

#[tauri::command]
fn save_build_policy(
    state: tauri::State<ActiveDbState>,
    build_policy: BuildPolicy,
) -> Result<BuildPolicy, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    build_policy::save_build_policy(&conn, build_policy)
}

#[tauri::command]
fn build_bundle_semantics(
    state: tauri::State<ActiveDbState>,
    career_library_export: CareerLibraryExport,
    requirement_analysis: RequirementAnalysis,
) -> Result<BundleSemantics, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    let candidate_profile = crate::candidate_profile::get_candidate_profile(&conn)?
        .ok_or("Active candidate profile not found")?;
    bundle_prep::build_bundle_semantics(
        &conn,
        &candidate_profile,
        &career_library_export,
        &requirement_analysis,
    )
}

#[tauri::command]
fn run_preflight_filter(
    career_library_export: CareerLibraryExport,
    requirement_analysis: RequirementAnalysis,
    threshold: f64,
    fallback_min_records: u32,
) -> Result<PreflightFilterResult, String> {
    preflight_filter::run_preflight_filter(
        &career_library_export,
        &requirement_analysis,
        threshold,
        fallback_min_records,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn prepare_resume_bundle(
    state: tauri::State<ActiveDbState>,
    job_posting_text: String,
    requirement_analysis: RequirementAnalysis,
    preflight_result: PreflightFilterResult,
) -> Result<ResumeBundleInput, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    let candidate_profile = crate::candidate_profile::get_candidate_profile(&conn)?
        .ok_or("Active candidate profile not found")?;
    let build_policy = build_policy::get_build_policy(&conn)?;

    bundle_prep::prepare_resume_bundle(
        &conn,
        &candidate_profile,
        &preflight_result.career_library_export,
        &build_policy,
        &job_posting_text,
        &requirement_analysis,
        &preflight_result.preflight_report,
    )
}

#[tauri::command]
fn assemble_resume(bundle: ResumeBundleInput) -> Result<ResumeAssemblyResult, String> {
    resume_assembler::assemble_resume(&bundle)
}

#[tauri::command]
fn run_resume_pipeline(
    state: tauri::State<ActiveDbState>,
    request: ResumePipelineRequest,
) -> Result<ResumePipelineResult, String> {
    let active_db_path = get_active_runtime_db_path(state.inner())?;
    let conn = open_active_runtime_connection(state.inner())?;

    resume_pipeline::run_resume_pipeline(&conn, Some(active_db_path.as_str()), &request)
}

#[tauri::command]
fn reset_db(state: tauri::State<ActiveDbState>) -> Result<(), String> {
    let conn = open_active_runtime_connection(state.inner())?;
    conn.execute_batch(
        "DELETE FROM evidence_items;
         DELETE FROM experience_records;
         DELETE FROM raw_intake_import_items;
         DELETE FROM raw_intake_import_runs;
         DELETE FROM anomalies;
         DELETE FROM generation_manifests;
         DELETE FROM candidate_profile_summary_lines;
         DELETE FROM candidate_profile_certifications;
         DELETE FROM candidate_profile_education;
            DELETE FROM candidate_profiles;
            DELETE FROM resume_build_policy_settings;",
    )
    .map_err(|e| e.to_string())?;
    build_policy::ensure_build_policy_seeded(&conn)?;
    taxonomy::clear_runtime_taxonomy(&conn).map(|_| ())
}

#[tauri::command]
fn get_records(state: tauri::State<ActiveDbState>) -> Result<Vec<ExperienceRecord>, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    get_records_impl(&conn)
}

#[tauri::command]
fn get_record(
    state: tauri::State<ActiveDbState>,
    id: String,
) -> Result<Option<ExperienceRecord>, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    conn.query_row(
        "SELECT id, slug, record_type, organization, title, start_date, end_date,
                location, employment_type, context_tags_json, created_at, updated_at
         FROM experience_records WHERE id = ?1",
        params![id],
        row_to_record,
    )
    .map(Some)
    .or_else(|err| {
        if matches!(err, rusqlite::Error::QueryReturnedNoRows) {
            Ok(None)
        } else {
            Err(err)
        }
    })
    .map_err(|e: rusqlite::Error| e.to_string())
}

#[tauri::command]
fn create_record(
    state: tauri::State<ActiveDbState>,
    data: ExperienceRecordFormData,
) -> Result<ExperienceRecord, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    let normalized = normalize_record_form_data(&conn, data, None)?;
    let id = new_id();
    conn.execute(
        "INSERT INTO experience_records
            (id, slug, record_type, organization, title, start_date, end_date,
             location, employment_type, context_tags_json, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,
                 strftime('%Y-%m-%dT%H:%M:%SZ','now'),
                 strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
        params![
            id,
            normalized.slug,
            normalized.record_type,
            normalized.organization,
            normalized.title,
            normalized.start_date,
            normalized.end_date,
            normalized.location,
            normalized.employment_type,
            tags_to_json(&normalized.context_tags),
        ],
    )
    .map_err(|e| e.to_string())?;
    get_record_by_id(&conn, &id)
}

#[tauri::command]
fn update_record(
    state: tauri::State<ActiveDbState>,
    id: String,
    data: ExperienceRecordFormData,
) -> Result<ExperienceRecord, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    let normalized = normalize_record_form_data(&conn, data, Some(id.as_str()))?;
    let affected = conn
        .execute(
            "UPDATE experience_records SET
                slug=?1, record_type=?2, organization=?3, title=?4, start_date=?5,
                end_date=?6, location=?7, employment_type=?8, context_tags_json=?9,
                updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')
             WHERE id=?10",
            params![
                normalized.slug,
                normalized.record_type,
                normalized.organization,
                normalized.title,
                normalized.start_date,
                normalized.end_date,
                normalized.location,
                normalized.employment_type,
                tags_to_json(&normalized.context_tags),
                id,
            ],
        )
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err(format!("Record {id} not found"));
    }
    get_record_by_id(&conn, &id)
}

#[tauri::command]
fn delete_record(state: tauri::State<ActiveDbState>, id: String) -> Result<(), String> {
    let conn = open_active_runtime_connection(state.inner())?;
    conn.execute("DELETE FROM experience_records WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn preview_delete_records(
    state: tauri::State<ActiveDbState>,
    ids: Vec<String>,
) -> Result<DeleteRecordsPreview, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    preview_delete_records_impl(&conn, ids)
}

#[tauri::command]
fn delete_records(
    state: tauri::State<ActiveDbState>,
    ids: Vec<String>,
    options: Option<DeleteBatchOptions>,
) -> Result<DeleteRecordsResult, String> {
    let mut conn = open_active_runtime_connection(state.inner())?;
    delete_records_impl(&mut conn, ids, options)
}

#[tauri::command]
fn get_evidence_for_record(
    state: tauri::State<ActiveDbState>,
    record_id: String,
) -> Result<Vec<Evidence>, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, experience_record_id, claim, date_range, tags_json,
                evidence_note, created_at, updated_at
             FROM evidence_items WHERE experience_record_id=?1 ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![record_id], row_to_evidence)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_all_evidence(state: tauri::State<ActiveDbState>) -> Result<Vec<Evidence>, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, experience_record_id, claim, date_range, tags_json,
                evidence_note, created_at, updated_at
             FROM evidence_items ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], row_to_evidence)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_evidence(
    state: tauri::State<ActiveDbState>,
    id: String,
) -> Result<Option<Evidence>, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    conn.query_row(
        "SELECT id, experience_record_id, claim, date_range, tags_json,
            evidence_note, created_at, updated_at
         FROM evidence_items WHERE id=?1",
        params![id],
        row_to_evidence,
    )
    .map(Some)
    .or_else(|err| {
        if matches!(err, rusqlite::Error::QueryReturnedNoRows) {
            Ok(None)
        } else {
            Err(err)
        }
    })
    .map_err(|e: rusqlite::Error| e.to_string())
}

#[tauri::command]
fn create_evidence(
    state: tauri::State<ActiveDbState>,
    record_id: String,
    data: EvidenceFormData,
    decision: Option<EvidenceSaveDecision>,
) -> Result<EvidenceSaveResponse, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    let record_context = get_record_inference_context(&conn, &record_id)?;
    let normalized = normalize_evidence_form_data(&conn, data, true)?;
    let comparison = build_evidence_inference_comparison(&conn, &record_context, &normalized)?;
    let Some(tags) = resolve_evidence_values_for_save(&normalized, &comparison, decision.as_ref())?
    else {
        return Ok(EvidenceSaveResponse {
            status: "confirmation_required".to_string(),
            evidence: None,
            comparison,
        });
    };

    let id = new_id();
    conn.execute(
        "INSERT INTO evidence_items
            (id, experience_record_id, claim, date_range, tags_json,
             evidence_note, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,
                 strftime('%Y-%m-%dT%H:%M:%SZ','now'),
                 strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
        params![
            id,
            record_id,
            normalized.claim,
            normalized.date_range,
            tags_to_json(&tags),
            normalized.evidence_note,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(EvidenceSaveResponse {
        status: "saved".to_string(),
        evidence: Some(get_evidence_by_id(&conn, &id)?),
        comparison,
    })
}

#[tauri::command]
fn update_evidence(
    state: tauri::State<ActiveDbState>,
    id: String,
    data: EvidenceFormData,
    decision: Option<EvidenceSaveDecision>,
) -> Result<EvidenceSaveResponse, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    let existing = get_evidence_by_id(&conn, &id)?;
    let record_context = get_record_inference_context(&conn, &existing.experience_record_id)?;
    let normalized = normalize_evidence_form_data(&conn, data, true)?;
    let comparison = build_evidence_inference_comparison(&conn, &record_context, &normalized)?;
    let Some(tags) = resolve_evidence_values_for_save(&normalized, &comparison, decision.as_ref())?
    else {
        return Ok(EvidenceSaveResponse {
            status: "confirmation_required".to_string(),
            evidence: None,
            comparison,
        });
    };

    let affected = conn
        .execute(
            "UPDATE evidence_items SET
                claim=?1, date_range=?2, tags_json=?3,
                evidence_note=?4,
                updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')
             WHERE id=?5",
            params![
                normalized.claim,
                normalized.date_range,
                tags_to_json(&tags),
                normalized.evidence_note,
                id,
            ],
        )
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err(format!("Evidence {id} not found"));
    }
    Ok(EvidenceSaveResponse {
        status: "saved".to_string(),
        evidence: Some(get_evidence_by_id(&conn, &id)?),
        comparison,
    })
}

#[tauri::command]
fn preview_evidence_inference(
    state: tauri::State<ActiveDbState>,
    record_id: String,
    data: EvidenceFormData,
) -> Result<EvidenceInferenceComparison, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    let record_context = get_record_inference_context(&conn, &record_id)?;
    let normalized = normalize_evidence_form_data(&conn, data, false)?;
    build_evidence_inference_comparison(&conn, &record_context, &normalized)
}

#[tauri::command]
fn delete_evidence(state: tauri::State<ActiveDbState>, id: String) -> Result<(), String> {
    let conn = open_active_runtime_connection(state.inner())?;
    conn.execute("DELETE FROM evidence_items WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn preview_delete_evidence_items(
    state: tauri::State<ActiveDbState>,
    ids: Vec<String>,
) -> Result<DeleteEvidenceItemsPreview, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    preview_delete_evidence_items_impl(&conn, ids)
}

#[tauri::command]
fn delete_evidence_items(
    state: tauri::State<ActiveDbState>,
    ids: Vec<String>,
    options: Option<DeleteBatchOptions>,
) -> Result<DeleteEvidenceItemsResult, String> {
    let mut conn = open_active_runtime_connection(state.inner())?;
    delete_evidence_items_impl(&mut conn, ids, options)
}

#[tauri::command]
fn get_candidate_profile(
    state: tauri::State<ActiveDbState>,
) -> Result<Option<CandidateProfile>, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    candidate_profile::get_candidate_profile(&conn)
}

#[tauri::command]
fn replace_candidate_profile(
    state: tauri::State<ActiveDbState>,
    profile: CandidateProfile,
) -> Result<CandidateProfile, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    candidate_profile::replace_candidate_profile(&conn, profile)
}

#[tauri::command]
fn delete_candidate_profile(state: tauri::State<ActiveDbState>) -> Result<(), String> {
    let conn = open_active_runtime_connection(state.inner())?;
    candidate_profile::delete_candidate_profile(&conn)
}

#[tauri::command]
fn get_candidate_profile_certification_tags(
    state: tauri::State<ActiveDbState>,
) -> Result<Vec<String>, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    candidate_profile::get_candidate_profile_certification_tags(&conn)
}

#[tauri::command]
fn get_anomalies(state: tauri::State<ActiveDbState>) -> Result<Vec<Anomaly>, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    operations::get_anomalies(&conn)
}

#[tauri::command]
fn get_anomaly(state: tauri::State<ActiveDbState>, id: String) -> Result<Option<Anomaly>, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    operations::get_anomaly(&conn, &id)
}

#[tauri::command]
fn resolve_anomaly(state: tauri::State<ActiveDbState>, id: String) -> Result<Anomaly, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    operations::resolve_anomaly(&conn, id)
}

#[tauri::command]
fn reopen_anomaly(state: tauri::State<ActiveDbState>, id: String) -> Result<Anomaly, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    operations::reopen_anomaly(&conn, id)
}

#[tauri::command]
fn delete_anomaly(state: tauri::State<ActiveDbState>, id: String) -> Result<(), String> {
    let conn = open_active_runtime_connection(state.inner())?;
    operations::delete_anomaly(&conn, id)
}

#[tauri::command]
fn get_generation_manifests(
    state: tauri::State<ActiveDbState>,
) -> Result<Vec<GenerationManifest>, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    operations::get_generation_manifests(&conn)
}

#[tauri::command]
fn get_generation_manifest(
    state: tauri::State<ActiveDbState>,
    id: String,
) -> Result<Option<GenerationManifest>, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    operations::get_generation_manifest(&conn, &id)
}

#[tauri::command]
fn delete_generation_manifest(
    state: tauri::State<ActiveDbState>,
    id: String,
) -> Result<(), String> {
    let conn = open_active_runtime_connection(state.inner())?;
    operations::delete_generation_manifest(&conn, id)
}

#[tauri::command]
fn update_manifest_notes(
    state: tauri::State<ActiveDbState>,
    id: String,
    notes: Option<String>,
) -> Result<GenerationManifest, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    operations::update_generation_manifest_notes(&conn, &id, notes)
}

#[tauri::command]
fn get_canonical_tags(state: tauri::State<ActiveDbState>) -> Result<Vec<CanonicalTag>, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    taxonomy::get_canonical_tags(&conn)
}

#[tauri::command]
fn get_canonical_tag(
    state: tauri::State<ActiveDbState>,
    tag: String,
) -> Result<Option<CanonicalTag>, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    taxonomy::get_canonical_tag(&conn, &tag)
}

#[tauri::command]
fn create_canonical_tag(
    state: tauri::State<ActiveDbState>,
    tag: String,
    description: Option<String>,
    category: String,
    display_label: String,
) -> Result<CanonicalTag, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    taxonomy::create_canonical_tag(&conn, tag, description, category, display_label)
}

#[tauri::command]
fn update_canonical_tag(
    state: tauri::State<ActiveDbState>,
    old_tag: String,
    new_tag: String,
    description: Option<String>,
    category: String,
    display_label: String,
) -> Result<CanonicalTag, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    taxonomy::update_canonical_tag(
        &conn,
        old_tag,
        new_tag,
        description,
        category,
        display_label,
    )
}

#[tauri::command]
fn delete_canonical_tag(state: tauri::State<ActiveDbState>, tag: String) -> Result<(), String> {
    let conn = open_active_runtime_connection(state.inner())?;
    taxonomy::delete_canonical_tag(&conn, tag)
}

#[tauri::command]
fn get_delivery_toolkit_categories(
    state: tauri::State<ActiveDbState>,
) -> Result<Vec<DeliveryToolkitCategory>, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    taxonomy::get_delivery_toolkit_categories(&conn)
}

#[tauri::command]
fn create_delivery_toolkit_category(
    state: tauri::State<ActiveDbState>,
    name: String,
) -> Result<DeliveryToolkitCategory, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    taxonomy::create_delivery_toolkit_category(&conn, name)
}

#[tauri::command]
fn rename_delivery_toolkit_category(
    state: tauri::State<ActiveDbState>,
    current_name: String,
    next_name: String,
) -> Result<DeliveryToolkitCategory, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    taxonomy::rename_delivery_toolkit_category(&conn, current_name, next_name)
}

#[tauri::command]
fn delete_delivery_toolkit_category(
    state: tauri::State<ActiveDbState>,
    name: String,
) -> Result<(), String> {
    let conn = open_active_runtime_connection(state.inner())?;
    taxonomy::delete_delivery_toolkit_category(&conn, name)
}

#[tauri::command]
fn import_taxonomy(
    state: tauri::State<ActiveDbState>,
    taxonomy_path: String,
) -> Result<TaxonomyImportResult, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    taxonomy::import_taxonomy_from_file(&conn, taxonomy_path)
}

#[tauri::command]
fn export_taxonomy(
    state: tauri::State<ActiveDbState>,
    output_path: String,
) -> Result<String, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    taxonomy::export_taxonomy_to_file(&conn, output_path)
}

#[tauri::command]
fn reset_taxonomy_to_starter(
    state: tauri::State<ActiveDbState>,
) -> Result<TaxonomyImportResult, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    taxonomy::reset_runtime_taxonomy_to_starter(&conn)
}

#[tauri::command]
fn clear_taxonomy(state: tauri::State<ActiveDbState>) -> Result<TaxonomyImportResult, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    taxonomy::clear_runtime_taxonomy(&conn)
}

#[tauri::command]
fn get_library_tag_sync_status(
    state: tauri::State<ActiveDbState>,
) -> Result<LibraryTagSyncStatus, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    taxonomy::get_library_tag_sync_status(&conn)
}

#[tauri::command]
fn re_infer_library_tags(
    state: tauri::State<ActiveDbState>,
) -> Result<LibraryTagRefreshResult, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    taxonomy::re_infer_library_tags(&conn)
}

#[tauri::command]
fn get_tag_inference_markers(
    state: tauri::State<ActiveDbState>,
    canonical_tag: String,
) -> Result<Vec<TagInferenceMarker>, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    taxonomy::get_tag_inference_markers(&conn, &canonical_tag)
}

#[tauri::command]
fn replace_tag_inference_markers(
    state: tauri::State<ActiveDbState>,
    canonical_tag: String,
    markers: Vec<TagInferenceMarkerInput>,
) -> Result<Vec<TagInferenceMarker>, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    taxonomy::replace_tag_inference_markers(&conn, canonical_tag, markers)
}

#[tauri::command]
fn normalize_tags(
    state: tauri::State<ActiveDbState>,
    tags: Vec<String>,
) -> Result<TagNormalizationResult, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    taxonomy::normalize_tags(&conn, &tags)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkerTestResult {
    pub marker_index: usize,
    pub matched: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestMarkersResult {
    pub matches: Vec<MarkerTestResult>,
    pub normalized_text: String,
}

#[tauri::command]
fn test_markers(
    text: String,
    markers: Vec<TagInferenceMarkerInput>,
) -> Result<TestMarkersResult, String> {
    let normalized_text = text.trim().to_lowercase();
    if normalized_text.is_empty() {
        return Ok(TestMarkersResult {
            matches: markers
                .iter()
                .enumerate()
                .map(|(i, _)| MarkerTestResult {
                    marker_index: i,
                    matched: false,
                })
                .collect(),
            normalized_text,
        });
    }

    let results = markers
        .iter()
        .enumerate()
        .map(|(index, input)| {
            // Build a synthetic TagInferenceMarker from the input for testing
            let mut terms = Vec::new();
            for (sort_order, term_value) in input.all_of.iter().enumerate() {
                terms.push(crate::taxonomy::TagInferenceMarkerTerm {
                    id: String::new(),
                    term_group: "all_of".to_string(),
                    term_value: term_value.clone(),
                    sort_order: sort_order as i64,
                });
            }
            for (sort_order, term_value) in input.any_of.iter().enumerate() {
                terms.push(crate::taxonomy::TagInferenceMarkerTerm {
                    id: String::new(),
                    term_group: "any_of".to_string(),
                    term_value: term_value.clone(),
                    sort_order: sort_order as i64,
                });
            }

            let synthetic_marker = TagInferenceMarker {
                id: String::new(),
                canonical_tag: String::new(),
                marker_kind: input.marker_kind.clone(),
                literal_value: input.literal_value.clone(),
                terms,
                created_at: String::new(),
            };

            MarkerTestResult {
                marker_index: index,
                matched: inference::tag_marker_matches(&synthetic_marker, &normalized_text),
            }
        })
        .collect();

    Ok(TestMarkersResult {
        matches: results,
        normalized_text,
    })
}

#[tauri::command]
fn preview_raw_intake(
    state: tauri::State<ActiveDbState>,
    raw_file_path: String,
) -> Result<RawIntakePreviewResult, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    intake::preview_raw_intake_impl(&conn, &raw_file_path)
}

#[tauri::command]
fn import_raw_intake(
    state: tauri::State<ActiveDbState>,
    raw_file_path: String,
) -> Result<RawIntakeImportResult, String> {
    let conn = open_active_runtime_connection(state.inner())?;
    intake::import_raw_intake_impl(&conn, &raw_file_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(ActiveDbState(Mutex::new(None)));
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            initialize_db,
            get_active_db_path,
            build_career_library_export,
            build_requirement_analysis,
            get_build_policy,
            save_build_policy,
            build_bundle_semantics,
            run_preflight_filter,
            prepare_resume_bundle,
            assemble_resume,
            run_resume_pipeline,
            reset_db,
            get_records,
            get_record,
            create_record,
            update_record,
            delete_record,
            preview_delete_records,
            delete_records,
            get_evidence_for_record,
            get_all_evidence,
            get_evidence,
            preview_evidence_inference,
            create_evidence,
            update_evidence,
            delete_evidence,
            preview_delete_evidence_items,
            delete_evidence_items,
            get_candidate_profile,
            replace_candidate_profile,
            delete_candidate_profile,
            get_candidate_profile_certification_tags,
            get_anomalies,
            get_anomaly,
            resolve_anomaly,
            reopen_anomaly,
            delete_anomaly,
            get_generation_manifests,
            get_generation_manifest,
            delete_generation_manifest,
            update_manifest_notes,
            get_canonical_tags,
            get_canonical_tag,
            create_canonical_tag,
            update_canonical_tag,
            delete_canonical_tag,
            get_delivery_toolkit_categories,
            create_delivery_toolkit_category,
            rename_delivery_toolkit_category,
            delete_delivery_toolkit_category,
            import_taxonomy,
            export_taxonomy,
            reset_taxonomy_to_starter,
            clear_taxonomy,
            get_library_tag_sync_status,
            re_infer_library_tags,
            get_tag_inference_markers,
            replace_tag_inference_markers,
            normalize_tags,
            test_markers,
            preview_raw_intake,
            import_raw_intake,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::{env, fs, path::Path};
    use uuid::Uuid;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute("PRAGMA foreign_keys = ON;", []).unwrap();
        conn.execute_batch(CAREER_SCHEMA_SQL).unwrap();
        conn
    }

    fn insert_record(
        conn: &Connection,
        id: &str,
        organization: &str,
        title: &str,
        start_date: &str,
        end_date: &str,
    ) {
        conn.execute(
            "INSERT INTO experience_records (
                id, slug, record_type, organization, title, start_date, end_date,
                location, employment_type, context_tags_json, created_at, updated_at
             ) VALUES (?1, ?2, 'employment', ?3, ?4, ?5, ?6, NULL, NULL, '[]', ?7, ?7)",
            params![
                id,
                format!("{id}-slug"),
                organization,
                title,
                start_date,
                end_date,
                "2026-04-08T00:00:00Z",
            ],
        )
        .unwrap();
    }

    fn insert_evidence(conn: &Connection, id: &str, record_id: &str, claim: &str) {
        conn.execute(
            "INSERT INTO evidence_items (
                id, experience_record_id, claim, date_range, tags_json, evidence_note, created_at, updated_at
             ) VALUES (?1, ?2, ?3, NULL, '[]', NULL, ?4, ?4)",
            params![id, record_id, claim, "2026-04-08T00:00:00Z"],
        )
        .unwrap();
    }

    fn setup_runtime_file_db(db_path: &Path) -> Connection {
        let conn = open_configured_runtime_connection(db_path).unwrap();
        conn.execute_batch(CAREER_SCHEMA_SQL).unwrap();
        run_runtime_db_migrations(&conn).unwrap();
        conn
    }

    #[test]
    fn get_active_runtime_db_path_requires_initialization() {
        let state = ActiveDbState(Mutex::new(None));

        assert_eq!(
            get_active_runtime_db_path(&state).unwrap_err(),
            "Database not initialized"
        );
    }

    #[test]
    fn open_active_runtime_connection_reopens_initialized_database() {
        let temp_dir = env::temp_dir().join(format!(
            "career-ledger-active-connection-{}",
            Uuid::new_v4()
        ));
        fs::create_dir_all(&temp_dir).unwrap();

        let db_path = temp_dir.join("career.db");
        let conn = setup_runtime_file_db(&db_path);
        insert_record(
            &conn,
            "record-a",
            "Example Org",
            "Engineer",
            "2024-01",
            "2024-12",
        );
        drop(conn);

        let state = ActiveDbState(Mutex::new(Some(db_path.display().to_string())));
        let reopened = open_active_runtime_connection(&state).unwrap();
        let records = get_records_impl(&reopened).unwrap();

        assert_eq!(records.len(), 1);
        assert_eq!(records[0].id, "record-a");

        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn open_active_runtime_connection_uses_latest_active_path() {
        let temp_dir =
            env::temp_dir().join(format!("career-ledger-path-switch-{}", Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();

        let first_db_path = temp_dir.join("first.db");
        let first_conn = setup_runtime_file_db(&first_db_path);
        insert_record(
            &first_conn,
            "record-first",
            "First Org",
            "Engineer",
            "2024-01",
            "2024-12",
        );
        drop(first_conn);

        let second_db_path = temp_dir.join("second.db");
        let second_conn = setup_runtime_file_db(&second_db_path);
        insert_record(
            &second_conn,
            "record-second",
            "Second Org",
            "Lead",
            "2025-01",
            "",
        );
        drop(second_conn);

        let state = ActiveDbState(Mutex::new(Some(first_db_path.display().to_string())));

        let first_open = open_active_runtime_connection(&state).unwrap();
        let first_records = get_records_impl(&first_open).unwrap();
        assert_eq!(first_records.len(), 1);
        assert_eq!(first_records[0].id, "record-first");
        drop(first_open);

        *state.0.lock().unwrap() = Some(second_db_path.display().to_string());

        let second_open = open_active_runtime_connection(&state).unwrap();
        let second_records = get_records_impl(&second_open).unwrap();
        assert_eq!(second_records.len(), 1);
        assert_eq!(second_records[0].id, "record-second");

        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn resolve_runtime_db_path_defaults_to_supplied_app_local_data_path() {
        let temp_dir = env::temp_dir().join(format!("career-ledger-default-db-{}", Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();

        let default_db_path = default_runtime_db_path_from_app_local_data(&temp_dir);
        let resolved = resolve_runtime_db_path_with_default(&default_db_path, None).unwrap();

        assert_eq!(resolved, temp_dir.canonicalize().unwrap().join("career.db"));

        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn resolve_runtime_db_path_allows_new_file_in_existing_directory() {
        let temp_dir = env::temp_dir().join(format!("career-ledger-db-path-{}", Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();

        let default_db_path = default_runtime_db_path_from_app_local_data(&temp_dir);
        let candidate = temp_dir.join("alternate.db");
        let resolved = resolve_runtime_db_path_with_default(
            &default_db_path,
            Some(candidate.to_str().unwrap()),
        )
        .unwrap();
        let canonical_parent = temp_dir.canonicalize().unwrap();

        assert_eq!(resolved, canonical_parent.join("alternate.db"));

        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn run_runtime_db_migrations_seeds_build_policy_row() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(CAREER_SCHEMA_SQL).unwrap();

        assert_eq!(runtime_db_user_version(&conn).unwrap(), 0);

        run_runtime_db_migrations(&conn).unwrap();

        assert_eq!(
            runtime_db_user_version(&conn).unwrap(),
            LATEST_RUNTIME_DB_VERSION
        );
        let row_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM resume_build_policy_settings WHERE id = 'active'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(row_count, 1);
    }

    #[test]
    fn preview_delete_records_reports_cascade_counts_and_missing_ids() {
        let conn = setup_conn();
        insert_record(&conn, "record-1", "Alpha", "Engineer", "2024-01", "2024-12");
        insert_record(&conn, "record-2", "Beta", "Lead", "2025-01", "");
        insert_evidence(
            &conn,
            "evidence-1",
            "record-1",
            "Built the ingestion pipeline.",
        );
        insert_evidence(
            &conn,
            "evidence-2",
            "record-1",
            "Hardened validation checks.",
        );

        let preview = preview_delete_records_impl(
            &conn,
            vec![
                "record-2".to_string(),
                "missing-record".to_string(),
                "record-1".to_string(),
            ],
        )
        .unwrap();

        assert_eq!(preview.requested_count, 3);
        assert_eq!(preview.found_count, 2);
        assert_eq!(preview.missing_ids, vec!["missing-record"]);
        assert_eq!(preview.cascade_evidence_count, 2);
        assert_eq!(preview.records[0].id, "record-2");
        assert_eq!(preview.records[0].linked_evidence_count, 0);
        assert_eq!(preview.records[1].id, "record-1");
        assert_eq!(preview.records[1].linked_evidence_count, 2);
    }

    #[test]
    fn delete_records_enforces_strict_missing_id_conflicts_without_mutation() {
        let mut conn = setup_conn();
        insert_record(&conn, "record-1", "Alpha", "Engineer", "2024-01", "2024-12");
        insert_evidence(
            &conn,
            "evidence-1",
            "record-1",
            "Built the ingestion pipeline.",
        );

        let error = delete_records_impl(
            &mut conn,
            vec!["record-1".to_string(), "missing-record".to_string()],
            Some(DeleteBatchOptions { strict: Some(true) }),
        )
        .unwrap_err();

        assert!(error.contains("missing-record"));
        assert_eq!(get_records_impl(&conn).unwrap().len(), 1);
        assert_eq!(
            conn.query_row("SELECT COUNT(*) FROM evidence_items", [], |row| row
                .get::<_, i64>(0))
                .unwrap(),
            1
        );
    }

    #[test]
    fn delete_records_cascades_linked_evidence_transactionally() {
        let mut conn = setup_conn();
        insert_record(&conn, "record-1", "Alpha", "Engineer", "2024-01", "2024-12");
        insert_record(&conn, "record-2", "Beta", "Lead", "2025-01", "");
        insert_evidence(
            &conn,
            "evidence-1",
            "record-1",
            "Built the ingestion pipeline.",
        );
        insert_evidence(
            &conn,
            "evidence-2",
            "record-2",
            "Defined the release process.",
        );

        let result = delete_records_impl(
            &mut conn,
            vec!["record-1".to_string(), "record-2".to_string()],
            Some(DeleteBatchOptions { strict: Some(true) }),
        )
        .unwrap();

        assert_eq!(result.deleted_record_count, 2);
        assert_eq!(result.deleted_evidence_count, 2);
        assert!(get_records_impl(&conn).unwrap().is_empty());
        assert_eq!(
            conn.query_row("SELECT COUNT(*) FROM evidence_items", [], |row| row
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }

    #[test]
    fn delete_evidence_items_supports_preview_and_strict_conflicts() {
        let mut conn = setup_conn();
        insert_record(&conn, "record-1", "Alpha", "Engineer", "2024-01", "2024-12");
        insert_evidence(
            &conn,
            "evidence-1",
            "record-1",
            "Built the ingestion pipeline.",
        );

        let preview = preview_delete_evidence_items_impl(
            &conn,
            vec!["evidence-1".to_string(), "missing-evidence".to_string()],
        )
        .unwrap();
        assert_eq!(preview.requested_count, 2);
        assert_eq!(preview.found_count, 1);
        assert_eq!(preview.missing_ids, vec!["missing-evidence"]);
        assert_eq!(
            preview.evidence_items[0].record_slug.as_deref(),
            Some("record-1-slug")
        );

        let error = delete_evidence_items_impl(
            &mut conn,
            vec!["evidence-1".to_string(), "missing-evidence".to_string()],
            Some(DeleteBatchOptions { strict: Some(true) }),
        )
        .unwrap_err();
        assert!(error.contains("missing-evidence"));

        let result = delete_evidence_items_impl(
            &mut conn,
            vec!["evidence-1".to_string()],
            Some(DeleteBatchOptions { strict: Some(true) }),
        )
        .unwrap();
        assert_eq!(result.deleted_evidence_count, 1);
        assert_eq!(
            conn.query_row("SELECT COUNT(*) FROM evidence_items", [], |row| row
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }

    #[test]
    fn experience_record_contract_uses_snake_case_keys() {
        let form: ExperienceRecordFormData = serde_json::from_value(json!({
            "slug": "",
            "record_type": "employment",
            "organization": "Example Org",
            "title": "Senior Analyst",
            "start_date": "",
            "end_date": "",
            "location": null,
            "employment_type": "Full-time",
            "context_tags": ["python", "reporting"]
        }))
        .unwrap();

        assert_eq!(form.record_type, "employment");
        assert_eq!(form.start_date, "");
        assert_eq!(form.end_date, "");
        assert_eq!(
            form.context_tags,
            vec!["python".to_string(), "reporting".to_string()]
        );

        let serialized = serde_json::to_value(ExperienceRecord {
            id: "record-1".to_string(),
            slug: "example-org-senior-analyst".to_string(),
            record_type: "employment".to_string(),
            organization: "Example Org".to_string(),
            title: "Senior Analyst".to_string(),
            start_date: "".to_string(),
            end_date: "".to_string(),
            location: Some("Remote".to_string()),
            employment_type: Some("Full-time".to_string()),
            context_tags: vec!["python".to_string()],
            created_at: "2026-04-08T00:00:00Z".to_string(),
            updated_at: "2026-04-08T00:00:00Z".to_string(),
        })
        .unwrap();

        let object = serialized.as_object().unwrap();
        assert!(object.contains_key("record_type"));
        assert!(object.contains_key("start_date"));
        assert!(object.contains_key("end_date"));
        assert!(object.contains_key("context_tags"));
        assert!(!object.contains_key("recordType"));
        assert!(!object.contains_key("startDate"));
    }

    #[test]
    fn evidence_contract_keeps_snake_case_evidence_and_camel_case_comparison() {
        let form: EvidenceFormData = serde_json::from_value(json!({
            "claim": "Implemented reporting automation.",
            "date_range": "2024",
            "tags": ["python"],
            "evidence_note": "Reduced manual handoffs."
        }))
        .unwrap();

        assert_eq!(form.date_range.as_deref(), Some("2024"));
        assert_eq!(form.tags, vec!["python".to_string()]);

        let serialized = serde_json::to_value(EvidenceSaveResponse {
            status: "saved".to_string(),
            evidence: Some(Evidence {
                id: "evidence-1".to_string(),
                experience_record_id: "record-1".to_string(),
                claim: "Implemented reporting automation.".to_string(),
                date_range: Some("2024".to_string()),
                tags: vec!["python".to_string()],
                evidence_note: Some("Reduced manual handoffs.".to_string()),
                created_at: "2026-04-08T00:00:00Z".to_string(),
                updated_at: "2026-04-08T00:00:00Z".to_string(),
            }),
            comparison: EvidenceInferenceComparison {
                manual_tags: vec!["python".to_string()],
                inferred_tags: vec!["python".to_string()],
                unknown_manual_tags: Vec::new(),
                tags_match: true,
            },
        })
        .unwrap();

        let evidence = serialized
            .get("evidence")
            .and_then(|value| value.as_object())
            .unwrap();
        assert!(evidence.contains_key("experience_record_id"));
        assert!(evidence.contains_key("date_range"));
        assert!(evidence.contains_key("evidence_note"));
        assert!(!evidence.contains_key("experienceRecordId"));

        let comparison = serialized
            .get("comparison")
            .and_then(|value| value.as_object())
            .unwrap();
        assert!(comparison.contains_key("manualTags"));
        assert!(comparison.contains_key("unknownManualTags"));
        assert!(comparison.contains_key("tagsMatch"));
    }

    #[test]
    fn get_records_uses_canonical_chronology() {
        let conn = setup_conn();

        insert_record(
            &conn,
            "closed-older-end",
            "Delta",
            "Analyst",
            "2024-09",
            "2024-12",
        );
        insert_record(
            &conn,
            "closed-newer-start",
            "Charlie",
            "Engineer",
            "2024-06",
            "2025-12",
        );
        insert_record(
            &conn,
            "closed-older-start",
            "Bravo",
            "Engineer",
            "2024-01",
            "2025-12",
        );
        insert_record(&conn, "open-blank", "Beta", "Lead", "2024-01", "");
        insert_record(&conn, "open-present", "Alpha", "Lead", "2025-01", "Present");

        let ordered_ids = get_records_impl(&conn)
            .unwrap()
            .into_iter()
            .map(|record| record.id)
            .collect::<Vec<_>>();

        assert_eq!(
            ordered_ids,
            vec![
                "open-present",
                "open-blank",
                "closed-newer-start",
                "closed-older-start",
                "closed-older-end",
            ]
        );
    }

    #[test]
    fn get_records_uses_stable_alphabetical_tie_breaks() {
        let conn = setup_conn();

        insert_record(
            &conn,
            "z-engineer",
            "Alpha",
            "Engineer",
            "2024-01",
            "2025-12",
        );
        insert_record(
            &conn,
            "a-engineer",
            "Alpha",
            "Engineer",
            "2024-01",
            "2025-12",
        );
        insert_record(
            &conn,
            "architect",
            "Alpha",
            "Architect",
            "2024-01",
            "2025-12",
        );
        insert_record(&conn, "beta-role", "Beta", "Analyst", "2024-01", "2025-12");

        let ordered_ids = get_records_impl(&conn)
            .unwrap()
            .into_iter()
            .map(|record| record.id)
            .collect::<Vec<_>>();

        assert_eq!(
            ordered_ids,
            vec!["architect", "a-engineer", "z-engineer", "beta-role"]
        );
    }
}
