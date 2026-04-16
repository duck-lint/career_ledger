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
use crate::intake::RawIntakeImportResult;
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
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::Manager;
use uuid::Uuid;

pub struct DbState(pub Mutex<Option<Connection>>);
pub struct ActiveDbPath(pub Mutex<Option<String>>);

const OPEN_ENDED_DATE_MARKERS: [&str; 4] = ["present", "current", "ongoing", "now"];
const LATEST_RUNTIME_DB_VERSION: i32 = 1;

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

    Ok(default_runtime_db_path_from_app_local_data(&app_local_data_dir))
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
        env::current_dir().map_err(|error| format!("Failed to resolve current directory: {error}"))?
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

fn run_runtime_db_migrations(conn: &Connection) -> Result<(), String> {
    let current_version = runtime_db_user_version(conn)?;
    if current_version > LATEST_RUNTIME_DB_VERSION {
        return Err(format!(
            "Database schema version {current_version} is newer than this app supports ({LATEST_RUNTIME_DB_VERSION})."
        ));
    }

    match current_version {
        0 => migrate_runtime_db_to_v1(conn)?,
        1 => build_policy::ensure_build_policy_seeded(conn)?,
        _ => unreachable!("runtime db version validated above"),
    }

    Ok(())
}

fn open_runtime_connection(
    app: &tauri::AppHandle,
    db_path: Option<&str>,
) -> Result<(Connection, String), String> {
    let db_path = resolve_runtime_db_path(app, db_path)?;
    let resolved_path = db_path.display().to_string();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    conn.execute("PRAGMA foreign_keys = ON;", [])
        .map_err(|e| e.to_string())?;
    conn.execute_batch(CAREER_SCHEMA_SQL)
        .map_err(|e| e.to_string())?;
    run_runtime_db_migrations(&conn)?;
    taxonomy::ensure_runtime_taxonomy_seeded(&conn)?;
    Ok((conn, resolved_path))
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
    state: tauri::State<DbState>,
    active_db_path: tauri::State<ActiveDbPath>,
    db_path: Option<String>,
) -> Result<(), String> {
    let (conn, resolved_path) = open_runtime_connection(&app, db_path.as_deref())?;

    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    *guard = Some(conn);
    drop(guard);

    let mut path_guard = active_db_path.0.lock().map_err(|e| e.to_string())?;
    *path_guard = Some(resolved_path);
    Ok(())
}

#[tauri::command]
fn get_active_db_path(
    app: tauri::AppHandle,
    active_db_path: tauri::State<ActiveDbPath>,
) -> Result<String, String> {
    let guard = active_db_path.0.lock().map_err(|e| e.to_string())?;
    if let Some(path) = guard.as_ref() {
        return Ok(path.clone());
    }

    resolve_runtime_db_path(&app, None).map(|path| path.display().to_string())
}

#[tauri::command]
fn build_career_library_export(
    state: tauri::State<DbState>,
    active_db_path: tauri::State<ActiveDbPath>,
) -> Result<CareerLibraryExport, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;

    let source_db_name = active_db_path
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .as_deref()
        .and_then(|value| Path::new(value).file_name())
        .and_then(|value| value.to_str())
        .map(str::to_string)
        .unwrap_or_else(|| "career.db".to_string());

    library_export::build_career_library_export(conn, &source_db_name)
}

#[tauri::command]
fn build_requirement_analysis(
    state: tauri::State<DbState>,
    job_posting_text: String,
) -> Result<RequirementAnalysis, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    requirement_analysis::build_requirement_analysis(conn, &job_posting_text)
}

#[tauri::command]
fn get_build_policy(state: tauri::State<DbState>) -> Result<BuildPolicy, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    build_policy::get_build_policy(conn)
}

#[tauri::command]
fn save_build_policy(
    state: tauri::State<DbState>,
    build_policy: BuildPolicy,
) -> Result<BuildPolicy, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    build_policy::save_build_policy(conn, build_policy)
}

#[tauri::command]
fn build_bundle_semantics(
    state: tauri::State<DbState>,
    career_library_export: CareerLibraryExport,
    requirement_analysis: RequirementAnalysis,
) -> Result<BundleSemantics, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    let candidate_profile = crate::candidate_profile::get_candidate_profile(conn)?
        .ok_or("Active candidate profile not found")?;
    bundle_prep::build_bundle_semantics(
        conn,
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
    state: tauri::State<DbState>,
    job_posting_text: String,
    requirement_analysis: RequirementAnalysis,
    preflight_result: PreflightFilterResult,
) -> Result<ResumeBundleInput, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    let candidate_profile = crate::candidate_profile::get_candidate_profile(conn)?
        .ok_or("Active candidate profile not found")?;
    let build_policy = build_policy::get_build_policy(conn)?;

    bundle_prep::prepare_resume_bundle(
        conn,
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
    state: tauri::State<DbState>,
    active_db_path: tauri::State<ActiveDbPath>,
    request: ResumePipelineRequest,
) -> Result<ResumePipelineResult, String> {
    let active_db_path = active_db_path
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .clone();
    let guard = state.0.lock().map_err(|error| error.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;

    resume_pipeline::run_resume_pipeline(conn, active_db_path.as_deref(), &request)
}

#[tauri::command]
fn reset_db(state: tauri::State<DbState>) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
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
        build_policy::ensure_build_policy_seeded(conn)?;
    taxonomy::reset_runtime_taxonomy(conn)
}

#[tauri::command]
fn get_records(state: tauri::State<DbState>) -> Result<Vec<ExperienceRecord>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    get_records_impl(conn)
}

#[tauri::command]
fn get_record(
    state: tauri::State<DbState>,
    id: String,
) -> Result<Option<ExperienceRecord>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
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
    state: tauri::State<DbState>,
    data: ExperienceRecordFormData,
) -> Result<ExperienceRecord, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    let normalized = normalize_record_form_data(conn, data, None)?;
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
    get_record_by_id(conn, &id)
}

#[tauri::command]
fn update_record(
    state: tauri::State<DbState>,
    id: String,
    data: ExperienceRecordFormData,
) -> Result<ExperienceRecord, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    let normalized = normalize_record_form_data(conn, data, Some(id.as_str()))?;
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
    get_record_by_id(conn, &id)
}

#[tauri::command]
fn delete_record(state: tauri::State<DbState>, id: String) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    conn.execute("DELETE FROM experience_records WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_evidence_for_record(
    state: tauri::State<DbState>,
    record_id: String,
) -> Result<Vec<Evidence>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
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
fn get_all_evidence(state: tauri::State<DbState>) -> Result<Vec<Evidence>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
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
fn get_evidence(state: tauri::State<DbState>, id: String) -> Result<Option<Evidence>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
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
    state: tauri::State<DbState>,
    record_id: String,
    data: EvidenceFormData,
    decision: Option<EvidenceSaveDecision>,
) -> Result<EvidenceSaveResponse, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    let record_context = get_record_inference_context(conn, &record_id)?;
    let normalized = normalize_evidence_form_data(conn, data, true)?;
    let comparison = build_evidence_inference_comparison(conn, &record_context, &normalized)?;
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
        evidence: Some(get_evidence_by_id(conn, &id)?),
        comparison,
    })
}

#[tauri::command]
fn update_evidence(
    state: tauri::State<DbState>,
    id: String,
    data: EvidenceFormData,
    decision: Option<EvidenceSaveDecision>,
) -> Result<EvidenceSaveResponse, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    let existing = get_evidence_by_id(conn, &id)?;
    let record_context = get_record_inference_context(conn, &existing.experience_record_id)?;
    let normalized = normalize_evidence_form_data(conn, data, true)?;
    let comparison = build_evidence_inference_comparison(conn, &record_context, &normalized)?;
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
        evidence: Some(get_evidence_by_id(conn, &id)?),
        comparison,
    })
}

#[tauri::command]
fn preview_evidence_inference(
    state: tauri::State<DbState>,
    record_id: String,
    data: EvidenceFormData,
) -> Result<EvidenceInferenceComparison, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    let record_context = get_record_inference_context(conn, &record_id)?;
    let normalized = normalize_evidence_form_data(conn, data, false)?;
    build_evidence_inference_comparison(conn, &record_context, &normalized)
}

#[tauri::command]
fn delete_evidence(state: tauri::State<DbState>, id: String) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    conn.execute("DELETE FROM evidence_items WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_candidate_profile(state: tauri::State<DbState>) -> Result<Option<CandidateProfile>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    candidate_profile::get_candidate_profile(conn)
}

#[tauri::command]
fn replace_candidate_profile(
    state: tauri::State<DbState>,
    profile: CandidateProfile,
) -> Result<CandidateProfile, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    candidate_profile::replace_candidate_profile(conn, profile)
}

#[tauri::command]
fn delete_candidate_profile(state: tauri::State<DbState>) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    candidate_profile::delete_candidate_profile(conn)
}

#[tauri::command]
fn get_candidate_profile_certification_tags(
    state: tauri::State<DbState>,
) -> Result<Vec<String>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    candidate_profile::get_candidate_profile_certification_tags(conn)
}

#[tauri::command]
fn get_anomalies(state: tauri::State<DbState>) -> Result<Vec<Anomaly>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    operations::get_anomalies(conn)
}

#[tauri::command]
fn get_anomaly(state: tauri::State<DbState>, id: String) -> Result<Option<Anomaly>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    operations::get_anomaly(conn, &id)
}

#[tauri::command]
fn resolve_anomaly(state: tauri::State<DbState>, id: String) -> Result<Anomaly, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    operations::resolve_anomaly(conn, id)
}

#[tauri::command]
fn reopen_anomaly(state: tauri::State<DbState>, id: String) -> Result<Anomaly, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    operations::reopen_anomaly(conn, id)
}

#[tauri::command]
fn delete_anomaly(state: tauri::State<DbState>, id: String) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    operations::delete_anomaly(conn, id)
}

#[tauri::command]
fn get_generation_manifests(
    state: tauri::State<DbState>,
) -> Result<Vec<GenerationManifest>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    operations::get_generation_manifests(conn)
}

#[tauri::command]
fn get_generation_manifest(
    state: tauri::State<DbState>,
    id: String,
) -> Result<Option<GenerationManifest>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    operations::get_generation_manifest(conn, &id)
}

#[tauri::command]
fn delete_generation_manifest(state: tauri::State<DbState>, id: String) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    operations::delete_generation_manifest(conn, id)
}

#[tauri::command]
fn update_manifest_notes(
    state: tauri::State<DbState>,
    id: String,
    notes: Option<String>,
) -> Result<GenerationManifest, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    operations::update_generation_manifest_notes(conn, &id, notes)
}

#[tauri::command]
fn get_canonical_tags(state: tauri::State<DbState>) -> Result<Vec<CanonicalTag>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    taxonomy::get_canonical_tags(conn)
}

#[tauri::command]
fn get_canonical_tag(
    state: tauri::State<DbState>,
    tag: String,
) -> Result<Option<CanonicalTag>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    taxonomy::get_canonical_tag(conn, &tag)
}

#[tauri::command]
fn create_canonical_tag(
    state: tauri::State<DbState>,
    tag: String,
    description: Option<String>,
    category: String,
    display_label: String,
) -> Result<CanonicalTag, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    taxonomy::create_canonical_tag(conn, tag, description, category, display_label)
}

#[tauri::command]
fn update_canonical_tag(
    state: tauri::State<DbState>,
    old_tag: String,
    new_tag: String,
    description: Option<String>,
    category: String,
    display_label: String,
) -> Result<CanonicalTag, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    taxonomy::update_canonical_tag(conn, old_tag, new_tag, description, category, display_label)
}

#[tauri::command]
fn delete_canonical_tag(state: tauri::State<DbState>, tag: String) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    taxonomy::delete_canonical_tag(conn, tag)
}

#[tauri::command]
fn get_delivery_toolkit_categories(
    state: tauri::State<DbState>,
) -> Result<Vec<DeliveryToolkitCategory>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    taxonomy::get_delivery_toolkit_categories(conn)
}

#[tauri::command]
fn create_delivery_toolkit_category(
    state: tauri::State<DbState>,
    name: String,
) -> Result<DeliveryToolkitCategory, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    taxonomy::create_delivery_toolkit_category(conn, name)
}

#[tauri::command]
fn rename_delivery_toolkit_category(
    state: tauri::State<DbState>,
    current_name: String,
    next_name: String,
) -> Result<DeliveryToolkitCategory, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    taxonomy::rename_delivery_toolkit_category(conn, current_name, next_name)
}

#[tauri::command]
fn delete_delivery_toolkit_category(
    state: tauri::State<DbState>,
    name: String,
) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    taxonomy::delete_delivery_toolkit_category(conn, name)
}

#[tauri::command]
fn import_taxonomy(
    state: tauri::State<DbState>,
    taxonomy_path: String,
) -> Result<TaxonomyImportResult, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    taxonomy::import_taxonomy_from_file(conn, taxonomy_path)
}

#[tauri::command]
fn export_taxonomy(
    state: tauri::State<DbState>,
    output_path: String,
) -> Result<String, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    taxonomy::export_taxonomy_to_file(conn, output_path)
}

#[tauri::command]
fn reset_taxonomy_to_starter(
    state: tauri::State<DbState>,
) -> Result<TaxonomyImportResult, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    taxonomy::reset_runtime_taxonomy_to_starter(conn)
}

#[tauri::command]
fn clear_taxonomy(
    state: tauri::State<DbState>,
) -> Result<TaxonomyImportResult, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    taxonomy::clear_runtime_taxonomy(conn)
}

#[tauri::command]
fn get_library_tag_sync_status(
    state: tauri::State<DbState>,
) -> Result<LibraryTagSyncStatus, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    taxonomy::get_library_tag_sync_status(conn)
}

#[tauri::command]
fn re_infer_library_tags(
    state: tauri::State<DbState>,
) -> Result<LibraryTagRefreshResult, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    taxonomy::re_infer_library_tags(conn)
}

#[tauri::command]
fn get_tag_inference_markers(
    state: tauri::State<DbState>,
    canonical_tag: String,
) -> Result<Vec<TagInferenceMarker>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    taxonomy::get_tag_inference_markers(conn, &canonical_tag)
}

#[tauri::command]
fn replace_tag_inference_markers(
    state: tauri::State<DbState>,
    canonical_tag: String,
    markers: Vec<TagInferenceMarkerInput>,
) -> Result<Vec<TagInferenceMarker>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    taxonomy::replace_tag_inference_markers(conn, canonical_tag, markers)
}

#[tauri::command]
fn normalize_tags(
    state: tauri::State<DbState>,
    tags: Vec<String>,
) -> Result<TagNormalizationResult, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    taxonomy::normalize_tags(conn, &tags)
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
fn import_raw_intake(
    state: tauri::State<DbState>,
    raw_file_path: String,
) -> Result<RawIntakeImportResult, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    intake::import_raw_intake_impl(conn, &raw_file_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(DbState(Mutex::new(None)));
            app.manage(ActiveDbPath(Mutex::new(None)));
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
            get_evidence_for_record,
            get_all_evidence,
            get_evidence,
            preview_evidence_inference,
            create_evidence,
            update_evidence,
            delete_evidence,
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
            import_raw_intake,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::{env, fs};
    use uuid::Uuid;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute("PRAGMA foreign_keys = ON;", []).unwrap();
        conn.execute_batch(CAREER_SCHEMA_SQL)
            .unwrap();
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
        let resolved =
            resolve_runtime_db_path_with_default(&default_db_path, Some(candidate.to_str().unwrap()))
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

        assert_eq!(runtime_db_user_version(&conn).unwrap(), 1);
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
