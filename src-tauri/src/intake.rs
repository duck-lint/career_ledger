use crate::inference::{infer_tags_for_input, TagInferenceInput};
use crate::taxonomy;
use crate::validation::{
    normalize_optional_owned, normalize_optional_text, normalize_required_text, slugify_record_slug,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeSet, HashMap, HashSet};
use std::fs;
use std::path::Path;
use uuid::Uuid;

const VAGUE_MARKERS: [&str; 5] = [
    "need to unpack",
    "something like",
    "stuff",
    "thing",
    "things",
];

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct RawIntakeImportSkipSummary {
    pub reason: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RawIntakeImportResult {
    pub run_id: Option<String>,
    pub success: bool,
    pub source_path: String,
    pub imported_record_count: i64,
    pub imported_evidence_count: i64,
    pub skipped_count: i64,
    pub skip_reasons: Vec<RawIntakeImportSkipSummary>,
    pub duplicate_intake_ids: Vec<String>,
    pub messages: Vec<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RawIntakePreviewItem {
    pub item_ref: String,
    pub intake_id: Option<String>,
    pub source_area: String,
    pub action: String,
    pub outcome: String,
    pub target_record_id: Option<String>,
    pub target_record_slug: Option<String>,
    pub would_create_record: bool,
    pub would_create_evidence: bool,
    pub skip_reason: Option<String>,
    pub repair_hint: Option<String>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RawIntakePreviewResult {
    pub success: bool,
    pub source_path: String,
    pub total_item_count: i64,
    pub would_import_record_count: i64,
    pub would_import_evidence_count: i64,
    pub skipped_count: i64,
    pub skip_reasons: Vec<RawIntakeImportSkipSummary>,
    pub duplicate_intake_ids: Vec<String>,
    pub items: Vec<RawIntakePreviewItem>,
    pub messages: Vec<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
struct RawIntakeItem {
    intake_id: String,
    source_area: String,
    target_record_ref: Option<String>,
    item_type_hint: String,
    raw_text: String,
    proposed_title: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    location: Option<String>,
    employment_type: Option<String>,
}

#[derive(Debug, Clone)]
struct PreparedEvidence {
    id: String,
    claim: String,
    date_range: Option<String>,
    tags: Vec<String>,
    evidence_note: Option<String>,
}

#[derive(Debug, Clone)]
struct ExistingEvidenceRow {
    id: String,
    claim: String,
    date_range: Option<String>,
    tags_json: String,
    evidence_note: Option<String>,
}

#[derive(Debug, Clone)]
struct ImportedRecordState {
    id: String,
    slug: String,
    context_tags: BTreeSet<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    location: Option<String>,
    employment_type: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum ImportSkipReason {
    AmbiguousItem,
    DuplicateClaim,
    DuplicateIntakeId,
    EmptyRawText,
    InvalidItem,
    MissingTargetRecord,
    UnknownTargetRecord,
    UnsupportedAction,
    ZeroInferredTags,
}

impl ImportSkipReason {
    fn as_str(self) -> &'static str {
        match self {
            Self::AmbiguousItem => "ambiguous_item",
            Self::DuplicateClaim => "duplicate_claim",
            Self::DuplicateIntakeId => "duplicate_intake_id",
            Self::EmptyRawText => "empty_raw_text",
            Self::InvalidItem => "invalid_item",
            Self::MissingTargetRecord => "missing_target_record",
            Self::UnknownTargetRecord => "unknown_target_record",
            Self::UnsupportedAction => "unsupported_action",
            Self::ZeroInferredTags => "zero_inferred_tags",
        }
    }

    fn repair_hint(self) -> &'static str {
        match self {
            Self::AmbiguousItem => {
                "Add clearer raw_text or provide a target_record_ref before retrying."
            }
            Self::DuplicateClaim => {
                "Review the existing evidence under that record; change the claim only if this is distinct evidence."
            }
            Self::DuplicateIntakeId => {
                "Keep the id stable for retries; use a new id only for genuinely new source material."
            }
            Self::EmptyRawText => "Add raw_text before retrying this intake item.",
            Self::InvalidItem => "Fix the item shape, required id, or field types before retrying.",
            Self::MissingTargetRecord => {
                "Add target_record_ref for evidence items or change the item into an experience import."
            }
            Self::UnknownTargetRecord => {
                "Create the target record or correct target_record_ref, then retry the same intake file."
            }
            Self::UnsupportedAction => {
                "Use item_type_hint evidence with target_record_ref, or experience without target_record_ref."
            }
            Self::ZeroInferredTags => {
                "Add or tune taxonomy inference markers so this text resolves to at least one tag."
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ImportAction {
    GroupedExperienceRecord,
    TargetedEvidence,
    Skip(ImportSkipReason),
}

enum EvidencePreparationError {
    Fatal(String),
    Skip(ImportSkipReason),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RawIntakeRunMode {
    Preview,
    Commit,
}

impl RawIntakeRunMode {
    fn is_preview(self) -> bool {
        self == Self::Preview
    }

    fn is_commit(self) -> bool {
        self == Self::Commit
    }
}

struct RawIntakeRunReport {
    run_id: Option<String>,
    source_path: String,
    total_item_count: i64,
    imported_record_count: i64,
    imported_evidence_count: i64,
    skipped_count: i64,
    skip_reasons: Vec<RawIntakeImportSkipSummary>,
    duplicate_intake_ids: Vec<String>,
    messages: Vec<String>,
    preview_items: Vec<RawIntakePreviewItem>,
}

fn new_id() -> String {
    Uuid::new_v4().to_string()
}

fn action_label(action: &ImportAction) -> &'static str {
    match action {
        ImportAction::GroupedExperienceRecord => "grouped_experience_record",
        ImportAction::TargetedEvidence => "targeted_evidence",
        ImportAction::Skip(_) => "skip",
    }
}

fn preview_skip_item(
    item_ref: String,
    intake_id: Option<String>,
    source_area: String,
    action: &str,
    reason: ImportSkipReason,
    message: String,
) -> RawIntakePreviewItem {
    RawIntakePreviewItem {
        item_ref,
        intake_id,
        source_area,
        action: action.to_string(),
        outcome: "skipped".to_string(),
        target_record_id: None,
        target_record_slug: None,
        would_create_record: false,
        would_create_evidence: false,
        skip_reason: Some(reason.as_str().to_string()),
        repair_hint: Some(reason.repair_hint().to_string()),
        message,
    }
}

fn preview_import_item(
    item: &RawIntakeItem,
    action: &str,
    target_record_id: Option<String>,
    target_record_slug: Option<String>,
    would_create_record: bool,
    would_create_evidence: bool,
    message: String,
) -> RawIntakePreviewItem {
    RawIntakePreviewItem {
        item_ref: item.intake_id.clone(),
        intake_id: Some(item.intake_id.clone()),
        source_area: item.source_area.clone(),
        action: action.to_string(),
        outcome: "would_import".to_string(),
        target_record_id,
        target_record_slug,
        would_create_record,
        would_create_evidence,
        skip_reason: None,
        repair_hint: None,
        message,
    }
}

fn normalize_text(value: &str) -> String {
    normalize_optional_text(Some(value)).unwrap_or_default()
}

fn normalize_compare_text(value: &str) -> String {
    normalize_text(value).to_lowercase()
}

fn normalize_optional_value(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .and_then(|item| normalize_optional_text(Some(item)))
}

fn load_raw_intake_values(raw_file_path: &str) -> Result<Vec<Value>, String> {
    let path = Path::new(raw_file_path);
    if !path.exists() {
        return Err(format!("Raw intake file not found: {}", path.display()));
    }

    let raw = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read raw intake file {}: {error}", path.display()))?;
    let raw = raw.trim_start_matches('\u{feff}');

    let parsed = match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("json") => serde_json::from_str::<Value>(raw).map_err(|error| {
            format!(
                "Failed to parse raw intake JSON {}: {error}",
                path.display()
            )
        })?,
        Some("yaml") | Some("yml") => serde_yaml::from_str::<Value>(raw).map_err(|error| {
            format!(
                "Failed to parse raw intake YAML {}: {error}",
                path.display()
            )
        })?,
        _ => {
            return Err(format!(
                "Raw intake path must be a .json, .yaml, or .yml file: {}",
                path.display()
            ))
        }
    };

    parsed
        .get("intake_items")
        .and_then(Value::as_array)
        .cloned()
        .ok_or_else(|| "Raw intake file must contain an 'intake_items' list.".to_string())
}

fn parse_raw_intake_item(value: &Value, index: usize) -> Result<RawIntakeItem, String> {
    let object = value
        .as_object()
        .ok_or_else(|| format!("intake_items[{}] must be an object.", index + 1))?;

    let intake_id = normalize_optional_value(object.get("id"))
        .ok_or_else(|| format!("intake_items[{}].id must be a non-empty string.", index + 1))?;

    Ok(RawIntakeItem {
        intake_id,
        source_area: normalize_optional_value(object.get("source_area")).unwrap_or_default(),
        target_record_ref: normalize_optional_value(object.get("target_record_ref")),
        item_type_hint: normalize_optional_value(object.get("item_type_hint"))
            .unwrap_or_default()
            .to_lowercase(),
        raw_text: normalize_optional_value(object.get("raw_text")).unwrap_or_default(),
        proposed_title: normalize_optional_value(object.get("proposed_title")),
        start_date: normalize_optional_value(object.get("start_date")),
        end_date: normalize_optional_value(object.get("end_date")),
        location: normalize_optional_value(object.get("location")),
        employment_type: normalize_optional_value(object.get("employment_type")),
    })
}

fn seems_vague(text: &str) -> bool {
    let lowered = text.to_lowercase();
    text.split_whitespace().count() < 9
        || VAGUE_MARKERS.iter().any(|marker| lowered.contains(marker))
}

fn derive_record_type(source_area: &str) -> String {
    let lowered = source_area.to_lowercase();
    if lowered == "project" || lowered == "personal project" {
        "project".to_string()
    } else {
        "employment".to_string()
    }
}

fn derive_organization(source_area: &str) -> String {
    if source_area.is_empty() {
        "Unknown".to_string()
    } else {
        source_area.to_string()
    }
}

fn derive_title(source_area: &str, proposed_title: Option<&str>) -> String {
    if let Some(title) = proposed_title.and_then(|value| normalize_optional_text(Some(value))) {
        title
    } else if source_area.is_empty() {
        "Unknown Experience".to_string()
    } else {
        format!("{} Experience", source_area)
    }
}

fn logical_experience_slug(organization: &str, title: &str) -> Option<String> {
    let slug = slugify_record_slug(&format!("{organization}-{title}"));
    if slug.is_empty() {
        None
    } else {
        Some(slug)
    }
}

fn slug_exists(conn: &Connection, slug: &str) -> Result<bool, String> {
    conn.query_row(
        "SELECT 1 FROM experience_records WHERE slug = ?1 LIMIT 1",
        params![slug],
        |_| Ok(()),
    )
    .optional()
    .map(|row| row.is_some())
    .map_err(|error| error.to_string())
}

fn make_experience_slug(
    conn: &Connection,
    organization: &str,
    title: &str,
    reserved_slugs: &mut HashSet<String>,
) -> Result<String, String> {
    let base = logical_experience_slug(organization, title)
        .ok_or_else(|| "Could not derive a slug for the imported experience record.".to_string())?;
    let mut candidate = base.clone();
    let mut counter = 2;
    while reserved_slugs.contains(&candidate) || slug_exists(conn, &candidate)? {
        candidate = format!("{base}-{counter}");
        counter += 1;
    }
    reserved_slugs.insert(candidate.clone());
    Ok(candidate)
}

fn determine_action(item: &RawIntakeItem) -> ImportAction {
    if item.raw_text.is_empty() {
        return ImportAction::Skip(ImportSkipReason::EmptyRawText);
    }

    if item.target_record_ref.is_some() {
        return if item.item_type_hint == "evidence" {
            ImportAction::TargetedEvidence
        } else {
            ImportAction::Skip(ImportSkipReason::UnsupportedAction)
        };
    }

    match item.item_type_hint.as_str() {
        "evidence" => ImportAction::Skip(ImportSkipReason::MissingTargetRecord),
        "experience" | "experience_or_evidence" => {
            if seems_vague(&item.raw_text) {
                ImportAction::Skip(ImportSkipReason::AmbiguousItem)
            } else {
                ImportAction::GroupedExperienceRecord
            }
        }
        _ => ImportAction::Skip(ImportSkipReason::UnsupportedAction),
    }
}

fn prepare_evidence(
    conn: &Connection,
    item: &RawIntakeItem,
    record_type: &str,
    organization: &str,
    title: &str,
) -> Result<PreparedEvidence, EvidencePreparationError> {
    let tags = infer_tags_for_input(
        conn,
        &TagInferenceInput {
            claim: Some(&item.raw_text),
            evidence_note: None,
            source_area: if item.source_area.is_empty() {
                None
            } else {
                Some(&item.source_area)
            },
            organization: Some(organization),
            title: Some(title),
            record_type: Some(record_type),
        },
    )
    .map_err(EvidencePreparationError::Fatal)?;

    if tags.is_empty() {
        return Err(EvidencePreparationError::Skip(
            ImportSkipReason::ZeroInferredTags,
        ));
    }

    let claim = normalize_required_text(Some(item.raw_text.as_str()), "claim")
        .map_err(|_| EvidencePreparationError::Skip(ImportSkipReason::InvalidItem))?;

    Ok(PreparedEvidence {
        id: new_id(),
        claim,
        date_range: None,
        tags,
        evidence_note: Some("Derived from intake item.".to_string()),
    })
}

fn resolve_target_record(
    conn: &Connection,
    token: &str,
) -> Result<Option<(String, String, String, String, String)>, String> {
    conn.query_row(
        "SELECT id, slug, organization, title, record_type FROM experience_records WHERE id = ?1 OR slug = ?1 LIMIT 1",
        params![token],
        |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        },
    )
    .optional()
    .map_err(|error| error.to_string())
}

fn evidence_duplicate_key(experience_record_id: &str, claim: &str) -> (String, String) {
    (
        experience_record_id.to_string(),
        normalize_compare_text(claim),
    )
}

fn evidence_claim_entity_id(experience_record_id: &str, claim: &str) -> String {
    format!("{}:{}", experience_record_id, normalize_compare_text(claim))
}

fn find_matching_evidence_row(
    conn: &Connection,
    experience_record_id: &str,
    claim: &str,
) -> Result<Option<ExistingEvidenceRow>, String> {
    let normalized_claim = normalize_compare_text(claim);
    let mut stmt = conn
        .prepare(
            "SELECT id, claim, date_range, tags_json, evidence_note
             FROM evidence_items
             WHERE experience_record_id = ?1
             ORDER BY created_at, id",
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(params![experience_record_id], |row| {
            Ok(ExistingEvidenceRow {
                id: row.get(0)?,
                claim: row.get(1)?,
                date_range: row.get(2)?,
                tags_json: row
                    .get::<_, Option<String>>(3)?
                    .unwrap_or_else(|| "[]".to_string()),
                evidence_note: row.get(4)?,
            })
        })
        .map_err(|error| error.to_string())?;

    for row in rows {
        let row = row.map_err(|error| error.to_string())?;
        if normalize_compare_text(&row.claim) == normalized_claim {
            return Ok(Some(row));
        }
    }

    Ok(None)
}

fn render_diff_value(value: &Value) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| value.to_string())
}

fn evidence_material_differences(
    existing: &ExistingEvidenceRow,
    prepared: &PreparedEvidence,
) -> Vec<String> {
    let mut differences = Vec::new();

    let existing_date_range = existing.date_range.clone().unwrap_or_default();
    let incoming_date_range = prepared.date_range.clone().unwrap_or_default();
    if existing_date_range != incoming_date_range {
        differences.push(format!(
            "date_range: existing={} incoming={}",
            render_diff_value(&Value::String(existing_date_range)),
            render_diff_value(&Value::String(incoming_date_range))
        ));
    }

    let existing_evidence_note = existing.evidence_note.clone().unwrap_or_default();
    let incoming_evidence_note = prepared.evidence_note.clone().unwrap_or_default();
    if existing_evidence_note != incoming_evidence_note {
        differences.push(format!(
            "evidence_note: existing={} incoming={}",
            render_diff_value(&Value::String(existing_evidence_note)),
            render_diff_value(&Value::String(incoming_evidence_note))
        ));
    }

    let existing_tags = serde_json::from_str::<Value>(&existing.tags_json).unwrap_or(Value::Null);
    let incoming_tags = serde_json::to_value(&prepared.tags).unwrap_or(Value::Null);
    if existing_tags != incoming_tags {
        differences.push(format!(
            "tags_json: existing={} incoming={}",
            render_diff_value(&existing_tags),
            render_diff_value(&incoming_tags)
        ));
    }

    differences
}

fn sync_duplicate_claim_anomaly(
    conn: &Connection,
    entity_id: &str,
    existing_evidence_id: Option<&str>,
    differences: &[String],
) -> Result<(), String> {
    let message = existing_evidence_id.map(|existing_id| {
        if differences.is_empty() {
            format!("duplicate claim matches evidence_item {existing_id}")
        } else {
            format!(
                "duplicate claim matches evidence_item {} with field differences: {}",
                existing_id,
                differences.join("; ")
            )
        }
    });

    let row = conn
        .query_row(
            "SELECT id FROM anomalies WHERE entity_type = 'evidence_claim' AND entity_id = ?1 AND anomaly_code = 'duplicate_claim' LIMIT 1",
            params![entity_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    match (row, message) {
        (Some(id), Some(message)) => {
            conn.execute(
                "UPDATE anomalies
                 SET severity = 'warning', message = ?1, detected_at = strftime('%Y-%m-%dT%H:%M:%SZ','now'), resolved_at = NULL
                 WHERE id = ?2",
                params![message, id],
            )
            .map_err(|error| error.to_string())?;
        }
        (Some(id), None) => {
            conn.execute(
                "UPDATE anomalies SET resolved_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?1",
                params![id],
            )
            .map_err(|error| error.to_string())?;
        }
        (None, Some(message)) => {
            conn.execute(
                "INSERT INTO anomalies (
                    id, entity_type, entity_id, anomaly_code, severity, message, detected_at
                 ) VALUES (
                    ?1, 'evidence_claim', ?2, 'duplicate_claim', 'warning', ?3,
                    strftime('%Y-%m-%dT%H:%M:%SZ','now')
                 )",
                params![new_id(), entity_id, message],
            )
            .map_err(|error| error.to_string())?;
        }
        (None, None) => {}
    }

    Ok(())
}

fn insert_import_run(
    conn: &Connection,
    run_id: &str,
    source_path: &str,
    total_item_count: i64,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO raw_intake_import_runs (
            id, source_path, total_item_count, imported_record_count, imported_evidence_count, skipped_count
         ) VALUES (?1, ?2, ?3, 0, 0, 0)",
        params![run_id, source_path, total_item_count],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn finalize_import_run(
    conn: &Connection,
    run_id: &str,
    imported_record_count: i64,
    imported_evidence_count: i64,
    skipped_count: i64,
) -> Result<(), String> {
    conn.execute(
        "UPDATE raw_intake_import_runs
         SET imported_record_count = ?1, imported_evidence_count = ?2, skipped_count = ?3
         WHERE id = ?4",
        params![
            imported_record_count,
            imported_evidence_count,
            skipped_count,
            run_id
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn intake_id_already_imported(conn: &Connection, intake_id: &str) -> Result<bool, String> {
    conn.query_row(
        "SELECT 1 FROM raw_intake_import_items WHERE intake_id = ?1 AND outcome = 'imported' LIMIT 1",
        params![intake_id],
        |_| Ok(()),
    )
    .optional()
    .map(|row| row.is_some())
    .map_err(|error| error.to_string())
}

fn insert_import_item(
    conn: &Connection,
    intake_id: &str,
    run_id: &str,
    source_area: &str,
    outcome: &str,
    skip_reason: Option<ImportSkipReason>,
    experience_record_id: Option<&str>,
    created_evidence_ids: &[String],
) -> Result<(), String> {
    let created_evidence_ids_json = if created_evidence_ids.is_empty() {
        None
    } else {
        Some(serde_json::to_string(created_evidence_ids).map_err(|error| error.to_string())?)
    };

    conn.execute(
        "INSERT INTO raw_intake_import_items (
            intake_id, run_id, source_area, outcome, skip_reason, experience_record_id, created_evidence_ids_json
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            intake_id,
            run_id,
            source_area,
            outcome,
            skip_reason.map(|reason| reason.as_str().to_string()),
            experience_record_id,
            created_evidence_ids_json,
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn insert_grouped_record(
    conn: &Connection,
    item: &RawIntakeItem,
    prepared: &PreparedEvidence,
    reserved_slugs: &mut HashSet<String>,
) -> Result<ImportedRecordState, String> {
    let organization = derive_organization(&item.source_area);
    let title = derive_title(&item.source_area, item.proposed_title.as_deref());
    let record_type = derive_record_type(&item.source_area);
    let slug = make_experience_slug(conn, &organization, &title, reserved_slugs)?;
    let id = new_id();
    let context_tags = prepared.tags.iter().cloned().collect::<BTreeSet<_>>();
    let start_date = normalize_optional_owned(item.start_date.clone());
    let end_date = normalize_optional_owned(item.end_date.clone());
    let location = if record_type == "employment" {
        normalize_optional_owned(item.location.clone())
    } else {
        None
    };
    let employment_type = if record_type == "employment" {
        normalize_optional_owned(item.employment_type.clone())
    } else {
        None
    };

    conn.execute(
        "INSERT INTO experience_records (
            id, slug, record_type, organization, title, start_date, end_date, location,
                employment_type, context_tags_json,
            created_at, updated_at
         ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
            strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now')
         )",
        params![
            id,
            slug,
            record_type,
            organization,
            title,
            start_date,
            end_date,
            location,
            employment_type,
            serde_json::to_string(&context_tags.iter().cloned().collect::<Vec<_>>())
                .map_err(|error| error.to_string())?,
        ],
    )
    .map_err(|error| error.to_string())?;

    Ok(ImportedRecordState {
        id,
        slug,
        context_tags,
        start_date,
        end_date,
        location,
        employment_type,
    })
}

fn preview_grouped_record_state(
    conn: &Connection,
    item: &RawIntakeItem,
    prepared: &PreparedEvidence,
    reserved_slugs: &mut HashSet<String>,
) -> Result<ImportedRecordState, String> {
    let organization = derive_organization(&item.source_area);
    let title = derive_title(&item.source_area, item.proposed_title.as_deref());
    let record_type = derive_record_type(&item.source_area);
    let slug = make_experience_slug(conn, &organization, &title, reserved_slugs)?;
    let context_tags = prepared.tags.iter().cloned().collect::<BTreeSet<_>>();
    let start_date = normalize_optional_owned(item.start_date.clone());
    let end_date = normalize_optional_owned(item.end_date.clone());
    let location = if record_type == "employment" {
        normalize_optional_owned(item.location.clone())
    } else {
        None
    };
    let employment_type = if record_type == "employment" {
        normalize_optional_owned(item.employment_type.clone())
    } else {
        None
    };

    Ok(ImportedRecordState {
        id: format!("preview:{slug}"),
        slug,
        context_tags,
        start_date,
        end_date,
        location,
        employment_type,
    })
}

fn merge_grouped_record_state_values(
    state: &mut ImportedRecordState,
    item: &RawIntakeItem,
    prepared: &PreparedEvidence,
) -> bool {
    let mut changed = false;

    for tag in &prepared.tags {
        if state.context_tags.insert(tag.clone()) {
            changed = true;
        }
    }
    if state.start_date.is_none() && item.start_date.is_some() {
        state.start_date = normalize_optional_owned(item.start_date.clone());
        changed = true;
    }
    if state.end_date.is_none() && item.end_date.is_some() {
        state.end_date = normalize_optional_owned(item.end_date.clone());
        changed = true;
    }
    if state.location.is_none() && item.location.is_some() {
        state.location = normalize_optional_owned(item.location.clone());
        changed = true;
    }
    if state.employment_type.is_none() && item.employment_type.is_some() {
        state.employment_type = normalize_optional_owned(item.employment_type.clone());
        changed = true;
    }

    changed
}

fn merge_grouped_record_state(
    conn: &Connection,
    state: &mut ImportedRecordState,
    item: &RawIntakeItem,
    prepared: &PreparedEvidence,
) -> Result<(), String> {
    if !merge_grouped_record_state_values(state, item, prepared) {
        return Ok(());
    }

    conn.execute(
        "UPDATE experience_records
         SET context_tags_json = ?1,
             start_date = ?2,
             end_date = ?3,
             location = ?4,
             employment_type = ?5,
             updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
         WHERE id = ?6",
        params![
            serde_json::to_string(&state.context_tags.iter().cloned().collect::<Vec<_>>())
                .map_err(|error| error.to_string())?,
            state.start_date,
            state.end_date,
            state.location,
            state.employment_type,
            state.id,
        ],
    )
    .map_err(|error| error.to_string())?;

    Ok(())
}

fn insert_evidence_item(
    conn: &Connection,
    experience_record_id: &str,
    prepared: &PreparedEvidence,
) -> Result<String, String> {
    conn.execute(
        "INSERT INTO evidence_items (
            id, experience_record_id, claim, date_range, tags_json,
            evidence_note, created_at, updated_at
         ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6,
            strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now')
         )",
        params![
            prepared.id,
            experience_record_id,
            prepared.claim,
            prepared.date_range,
            serde_json::to_string(&prepared.tags).map_err(|error| error.to_string())?,
            prepared.evidence_note,
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(prepared.id.clone())
}

fn record_skip_result(
    item: &RawIntakeItem,
    reason: ImportSkipReason,
    message: String,
    skip_counts: &mut HashMap<ImportSkipReason, i64>,
    messages: &mut Vec<String>,
    skipped_count: &mut i64,
) {
    record_skip(
        skip_counts,
        messages,
        skipped_count,
        &item.intake_id,
        reason,
        message,
    );
}

fn prepare_evidence_or_skip(
    conn: &Connection,
    item: &RawIntakeItem,
    record_type: &str,
    organization: &str,
    title: &str,
    skip_counts: &mut HashMap<ImportSkipReason, i64>,
    messages: &mut Vec<String>,
    skipped_count: &mut i64,
) -> Result<Option<PreparedEvidence>, String> {
    match prepare_evidence(conn, item, record_type, organization, title) {
        Ok(prepared) => Ok(Some(prepared)),
        Err(EvidencePreparationError::Skip(reason)) => {
            record_skip_result(
                item,
                reason,
                format!("skipped because {}", reason.as_str()),
                skip_counts,
                messages,
                skipped_count,
            );
            Ok(None)
        }
        Err(EvidencePreparationError::Fatal(error)) => Err(error),
    }
}

fn process_evidence_import(
    conn: &Connection,
    mode: RawIntakeRunMode,
    run_id: Option<&str>,
    item: &RawIntakeItem,
    action: &str,
    record_id: &str,
    record_slug: &str,
    prepared: &PreparedEvidence,
    duplicate_evidence_keys: &mut HashSet<(String, String)>,
    skip_counts: &mut HashMap<ImportSkipReason, i64>,
    messages: &mut Vec<String>,
    skipped_count: &mut i64,
    imported_evidence_count: &mut i64,
    preview_items: &mut Vec<RawIntakePreviewItem>,
    would_create_record: bool,
) -> Result<(), String> {
    let duplicate_key = evidence_duplicate_key(record_id, &prepared.claim);
    let existing_row = find_matching_evidence_row(conn, record_id, &prepared.claim)?;
    if duplicate_evidence_keys.contains(&duplicate_key) || existing_row.is_some() {
        let differences = existing_row
            .as_ref()
            .map(|row| evidence_material_differences(row, prepared))
            .unwrap_or_default();
        if mode.is_commit() {
            sync_duplicate_claim_anomaly(
                conn,
                &evidence_claim_entity_id(record_id, &prepared.claim),
                existing_row.as_ref().map(|row| row.id.as_str()),
                &differences,
            )?;
        }
        let message = format!(
            "skipped duplicate evidence claim under {} ({})",
            record_id, record_slug
        );
        record_skip_result(
            item,
            ImportSkipReason::DuplicateClaim,
            message.clone(),
            skip_counts,
            messages,
            skipped_count,
        );
        if mode.is_preview() {
            preview_items.push(preview_skip_item(
                item.intake_id.clone(),
                Some(item.intake_id.clone()),
                item.source_area.clone(),
                action,
                ImportSkipReason::DuplicateClaim,
                format!("{}: {message}", item.intake_id),
            ));
        }
        return Ok(());
    }

    duplicate_evidence_keys.insert(duplicate_key);
    *imported_evidence_count += 1;
    if mode.is_preview() {
        let message = format!(
            "{}: would insert evidence under {} ({})",
            item.intake_id, record_id, record_slug
        );
        messages.push(message.clone());
        preview_items.push(preview_import_item(
            item,
            action,
            if would_create_record {
                None
            } else {
                Some(record_id.to_string())
            },
            Some(record_slug.to_string()),
            would_create_record,
            true,
            message,
        ));
        return Ok(());
    }

    let run_id = run_id.ok_or_else(|| "Import run id missing for committed intake.".to_string())?;
    sync_duplicate_claim_anomaly(
        conn,
        &evidence_claim_entity_id(record_id, &prepared.claim),
        None,
        &[],
    )?;
    let inserted_evidence_id = insert_evidence_item(conn, record_id, prepared)?;
    messages.push(format!(
        "{}: inserted evidence_item {} under {} ({})",
        item.intake_id, inserted_evidence_id, record_id, record_slug
    ));
    insert_import_item(
        conn,
        &item.intake_id,
        run_id,
        &item.source_area,
        "imported",
        None,
        Some(record_id),
        &[inserted_evidence_id],
    )
}

fn record_skip(
    counts: &mut HashMap<ImportSkipReason, i64>,
    messages: &mut Vec<String>,
    skipped_count: &mut i64,
    intake_id: &str,
    reason: ImportSkipReason,
    message: String,
) {
    *counts.entry(reason).or_insert(0) += 1;
    *skipped_count += 1;
    messages.push(format!("{}: {}", intake_id, message));
}

fn build_skip_summaries(
    counts: &HashMap<ImportSkipReason, i64>,
) -> Vec<RawIntakeImportSkipSummary> {
    let mut entries = counts
        .iter()
        .map(|(reason, count)| RawIntakeImportSkipSummary {
            reason: reason.as_str().to_string(),
            count: *count,
        })
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| left.reason.cmp(&right.reason));
    entries
}

fn run_raw_intake(
    conn: &Connection,
    raw_file_path: &str,
    mode: RawIntakeRunMode,
) -> Result<RawIntakeRunReport, String> {
    let values = load_raw_intake_values(raw_file_path)?;
    let run_id = if mode.is_commit() {
        Some(new_id())
    } else {
        None
    };

    let mut reserved_slugs = HashSet::new();
    let mut imported_record_states: HashMap<String, ImportedRecordState> = HashMap::new();
    let mut duplicate_evidence_keys = HashSet::new();
    let mut seen_intake_ids = HashSet::new();
    let mut duplicate_intake_ids = Vec::new();
    let mut messages = Vec::new();
    let mut preview_items = Vec::new();
    let mut skip_counts = HashMap::new();
    let mut imported_record_count = 0_i64;
    let mut imported_evidence_count = 0_i64;
    let mut skipped_count = 0_i64;

    if let Some(run_id) = run_id.as_deref() {
        insert_import_run(conn, run_id, raw_file_path, values.len() as i64)?;
    }

    for (index, value) in values.iter().enumerate() {
        let item = match parse_raw_intake_item(value, index) {
            Ok(item) => item,
            Err(error) => {
                let item_ref = format!("intake_items[{}]", index + 1);
                record_skip(
                    &mut skip_counts,
                    &mut messages,
                    &mut skipped_count,
                    &item_ref,
                    ImportSkipReason::InvalidItem,
                    error.clone(),
                );
                if mode.is_preview() {
                    preview_items.push(preview_skip_item(
                        item_ref.clone(),
                        None,
                        String::new(),
                        "parse",
                        ImportSkipReason::InvalidItem,
                        format!("{}: {}", item_ref, error),
                    ));
                }
                continue;
            }
        };

        if !seen_intake_ids.insert(item.intake_id.clone())
            || intake_id_already_imported(conn, &item.intake_id)?
        {
            duplicate_intake_ids.push(item.intake_id.clone());
            let message = "skipped duplicate intake id".to_string();
            record_skip(
                &mut skip_counts,
                &mut messages,
                &mut skipped_count,
                &item.intake_id,
                ImportSkipReason::DuplicateIntakeId,
                message.clone(),
            );
            if mode.is_preview() {
                preview_items.push(preview_skip_item(
                    item.intake_id.clone(),
                    Some(item.intake_id.clone()),
                    item.source_area.clone(),
                    "duplicate_intake_id_check",
                    ImportSkipReason::DuplicateIntakeId,
                    format!("{}: {}", item.intake_id, message),
                ));
            }
            continue;
        }

        let action = determine_action(&item);
        match action {
            ImportAction::Skip(reason) => {
                let message = format!("skipped because {}", reason.as_str());
                record_skip_result(
                    &item,
                    reason,
                    message.clone(),
                    &mut skip_counts,
                    &mut messages,
                    &mut skipped_count,
                );
                if mode.is_preview() {
                    preview_items.push(preview_skip_item(
                        item.intake_id.clone(),
                        Some(item.intake_id.clone()),
                        item.source_area.clone(),
                        action_label(&action),
                        reason,
                        format!("{}: {}", item.intake_id, message),
                    ));
                }
            }
            ImportAction::TargetedEvidence => {
                let action_name = action_label(&action);
                let target_ref = match item.target_record_ref.as_deref() {
                    Some(target_ref) => target_ref,
                    None => {
                        let message = "missing target record ref".to_string();
                        record_skip_result(
                            &item,
                            ImportSkipReason::MissingTargetRecord,
                            message.clone(),
                            &mut skip_counts,
                            &mut messages,
                            &mut skipped_count,
                        );
                        if mode.is_preview() {
                            preview_items.push(preview_skip_item(
                                item.intake_id.clone(),
                                Some(item.intake_id.clone()),
                                item.source_area.clone(),
                                action_name,
                                ImportSkipReason::MissingTargetRecord,
                                format!("{}: {}", item.intake_id, message),
                            ));
                        }
                        continue;
                    }
                };

                let Some((record_id, record_slug, organization, title, record_type)) =
                    resolve_target_record(conn, target_ref)?
                else {
                    let message = format!("target record '{}' does not exist", target_ref);
                    record_skip_result(
                        &item,
                        ImportSkipReason::UnknownTargetRecord,
                        message.clone(),
                        &mut skip_counts,
                        &mut messages,
                        &mut skipped_count,
                    );
                    if mode.is_preview() {
                        preview_items.push(preview_skip_item(
                            item.intake_id.clone(),
                            Some(item.intake_id.clone()),
                            item.source_area.clone(),
                            action_name,
                            ImportSkipReason::UnknownTargetRecord,
                            format!("{}: {}", item.intake_id, message),
                        ));
                    }
                    continue;
                };

                let prepared =
                    match prepare_evidence(conn, &item, &record_type, &organization, &title) {
                        Ok(prepared) => prepared,
                        Err(EvidencePreparationError::Skip(reason)) => {
                            let message = format!("skipped because {}", reason.as_str());
                            record_skip_result(
                                &item,
                                reason,
                                message.clone(),
                                &mut skip_counts,
                                &mut messages,
                                &mut skipped_count,
                            );
                            if mode.is_preview() {
                                preview_items.push(preview_skip_item(
                                    item.intake_id.clone(),
                                    Some(item.intake_id.clone()),
                                    item.source_area.clone(),
                                    action_name,
                                    reason,
                                    format!("{}: {}", item.intake_id, message),
                                ));
                            }
                            continue;
                        }
                        Err(EvidencePreparationError::Fatal(error)) => return Err(error),
                    };

                process_evidence_import(
                    conn,
                    mode,
                    run_id.as_deref(),
                    &item,
                    action_name,
                    &record_id,
                    &record_slug,
                    &prepared,
                    &mut duplicate_evidence_keys,
                    &mut skip_counts,
                    &mut messages,
                    &mut skipped_count,
                    &mut imported_evidence_count,
                    &mut preview_items,
                    false,
                )?;
            }
            ImportAction::GroupedExperienceRecord => {
                let action_name = action_label(&action);
                let organization = derive_organization(&item.source_area);
                let title = derive_title(&item.source_area, item.proposed_title.as_deref());
                let record_type = derive_record_type(&item.source_area);
                let prepared =
                    match prepare_evidence(conn, &item, &record_type, &organization, &title) {
                        Ok(prepared) => prepared,
                        Err(EvidencePreparationError::Skip(reason)) => {
                            let message = format!("skipped because {}", reason.as_str());
                            record_skip_result(
                                &item,
                                reason,
                                message.clone(),
                                &mut skip_counts,
                                &mut messages,
                                &mut skipped_count,
                            );
                            if mode.is_preview() {
                                preview_items.push(preview_skip_item(
                                    item.intake_id.clone(),
                                    Some(item.intake_id.clone()),
                                    item.source_area.clone(),
                                    action_name,
                                    reason,
                                    format!("{}: {}", item.intake_id, message),
                                ));
                            }
                            continue;
                        }
                        Err(EvidencePreparationError::Fatal(error)) => return Err(error),
                    };

                let group_key = logical_experience_slug(&organization, &title)
                    .unwrap_or_else(|| format!("{}:{}", organization, title));
                let mut would_create_record = false;

                if !imported_record_states.contains_key(&group_key) {
                    let state = if mode.is_commit() {
                        insert_grouped_record(conn, &item, &prepared, &mut reserved_slugs)?
                    } else {
                        preview_grouped_record_state(conn, &item, &prepared, &mut reserved_slugs)?
                    };
                    let message = if mode.is_commit() {
                        format!(
                            "{}: inserted experience_record {} ({})",
                            item.intake_id, state.id, state.slug
                        )
                    } else {
                        format!(
                            "{}: would insert experience_record ({})",
                            item.intake_id, state.slug
                        )
                    };
                    messages.push(message);
                    imported_record_count += 1;
                    would_create_record = true;
                    imported_record_states.insert(group_key.clone(), state);
                }

                let (record_id, record_slug) = {
                    let state = imported_record_states.get_mut(&group_key).unwrap();
                    if mode.is_commit() {
                        merge_grouped_record_state(conn, state, &item, &prepared)?;
                    } else {
                        merge_grouped_record_state_values(state, &item, &prepared);
                    }
                    (state.id.clone(), state.slug.clone())
                };

                process_evidence_import(
                    conn,
                    mode,
                    run_id.as_deref(),
                    &item,
                    action_name,
                    &record_id,
                    &record_slug,
                    &prepared,
                    &mut duplicate_evidence_keys,
                    &mut skip_counts,
                    &mut messages,
                    &mut skipped_count,
                    &mut imported_evidence_count,
                    &mut preview_items,
                    would_create_record,
                )?;
            }
        }
    }

    if let Some(run_id) = run_id.as_deref() {
        finalize_import_run(
            conn,
            run_id,
            imported_record_count,
            imported_evidence_count,
            skipped_count,
        )?;
    }

    Ok(RawIntakeRunReport {
        run_id,
        source_path: raw_file_path.to_string(),
        total_item_count: values.len() as i64,
        imported_record_count,
        imported_evidence_count,
        skipped_count,
        skip_reasons: build_skip_summaries(&skip_counts),
        duplicate_intake_ids,
        messages,
        preview_items,
    })
}

pub fn preview_raw_intake_impl(
    conn: &Connection,
    raw_file_path: &str,
) -> Result<RawIntakePreviewResult, String> {
    let report = run_raw_intake(conn, raw_file_path, RawIntakeRunMode::Preview)?;

    Ok(RawIntakePreviewResult {
        success: true,
        source_path: report.source_path,
        total_item_count: report.total_item_count,
        would_import_record_count: report.imported_record_count,
        would_import_evidence_count: report.imported_evidence_count,
        skipped_count: report.skipped_count,
        skip_reasons: report.skip_reasons,
        duplicate_intake_ids: report.duplicate_intake_ids,
        items: report.preview_items,
        messages: report.messages,
        error: None,
    })
}

pub fn import_raw_intake_impl(
    conn: &Connection,
    raw_file_path: &str,
) -> Result<RawIntakeImportResult, String> {
    taxonomy::with_transaction(conn, |conn| {
        let report = run_raw_intake(conn, raw_file_path, RawIntakeRunMode::Commit)?;

        Ok(RawIntakeImportResult {
            run_id: report.run_id,
            success: true,
            source_path: report.source_path,
            imported_record_count: report.imported_record_count,
            imported_evidence_count: report.imported_evidence_count,
            skipped_count: report.skipped_count,
            skip_reasons: report.skip_reasons,
            duplicate_intake_ids: report.duplicate_intake_ids,
            messages: report.messages,
            error: None,
        })
    })
}

#[cfg(test)]
mod tests {
    use super::{import_raw_intake_impl, load_raw_intake_values, preview_raw_intake_impl};
    use crate::taxonomy::ensure_runtime_taxonomy_seeded;
    use rusqlite::{params, Connection};
    use std::env;
    use std::fs;
    use uuid::Uuid;

    fn temp_file_path(extension: &str) -> std::path::PathBuf {
        env::temp_dir().join(format!(
            "career-ledger-intake-{}.{}",
            Uuid::new_v4(),
            extension
        ))
    }

    fn import_test_db_path() -> std::path::PathBuf {
        env::temp_dir().join(format!("career-ledger-intake-db-{}.db", Uuid::new_v4()))
    }

    fn setup_import_db() -> std::path::PathBuf {
        let path = import_test_db_path();
        let conn = Connection::open(&path).unwrap();
        conn.execute_batch(crate::embedded_assets::CAREER_SCHEMA_SQL)
            .unwrap();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();
        conn.execute(
            r#"
            INSERT INTO experience_records (
              id, slug, record_type, organization, title, context_tags_json
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            "#,
            (
                "rec_1",
                "sample-record",
                "employment",
                "Sample Org",
                "Analyst",
                "[]",
            ),
        )
        .unwrap();
        drop(conn);
        path
    }

    fn write_raw_yaml(path: &std::path::Path, body: &str) {
        fs::write(path, body).unwrap();
    }

    fn count_import_items(conn: &Connection, intake_id: &str) -> i64 {
        conn.query_row(
            "SELECT COUNT(*) FROM raw_intake_import_items WHERE intake_id = ?1",
            params![intake_id],
            |row| row.get(0),
        )
        .unwrap()
    }

    fn count_evidence(conn: &Connection) -> i64 {
        conn.query_row("SELECT COUNT(*) FROM evidence_items", [], |row| row.get(0))
            .unwrap()
    }

    fn count_import_runs(conn: &Connection) -> i64 {
        conn.query_row("SELECT COUNT(*) FROM raw_intake_import_runs", [], |row| {
            row.get(0)
        })
        .unwrap()
    }

    #[test]
    fn loads_raw_intake_values_from_yaml() {
        let path = temp_file_path("yaml");
        write_raw_yaml(
            &path,
            r#"
intake_items:
  - id: item_1
    status: raw
    source_area: example-hr-ops
    target_record_ref: sample-record
    item_type_hint: evidence
    raw_text: Supported Workday rollout training and routed user issues.
"#,
        );

        let loaded = load_raw_intake_values(path.to_str().unwrap()).unwrap();
        fs::remove_file(&path).ok();

        assert_eq!(loaded.len(), 1);
    }

    #[test]
    fn previews_targeted_evidence_without_writing_import_rows() {
        let db_path = setup_import_db();
        let path = temp_file_path("yaml");
        write_raw_yaml(
            &path,
            r#"
intake_items:
  - id: item_1
    status: raw
    source_area: example-hr-ops
    target_record_ref: sample-record
    item_type_hint: evidence
    raw_text: Supported Workday rollout training and routed user issues.
"#,
        );

        let conn = Connection::open(&db_path).unwrap();
        let result = preview_raw_intake_impl(&conn, path.to_str().unwrap()).unwrap();
        let evidence_count = count_evidence(&conn);
        let import_run_count = count_import_runs(&conn);
        let import_item_count = count_import_items(&conn, "item_1");
        drop(conn);
        fs::remove_file(&path).ok();
        fs::remove_file(&db_path).ok();

        assert!(result.success);
        assert_eq!(result.total_item_count, 1);
        assert_eq!(result.would_import_record_count, 0);
        assert_eq!(result.would_import_evidence_count, 1);
        assert_eq!(result.skipped_count, 0);
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].outcome, "would_import");
        assert_eq!(result.items[0].action, "targeted_evidence");
        assert_eq!(
            result.items[0].target_record_slug.as_deref(),
            Some("sample-record")
        );
        assert_eq!(evidence_count, 0);
        assert_eq!(import_run_count, 0);
        assert_eq!(import_item_count, 0);
    }

    #[test]
    fn preview_reports_skips_with_repair_hints() {
        let db_path = setup_import_db();
        let path = temp_file_path("yaml");
        write_raw_yaml(
            &path,
            r#"
intake_items:
  - id: missing-target-1
    status: raw
    source_area: example-hr-ops
    target_record_ref: does-not-exist
    item_type_hint: evidence
    raw_text: Supported Workday rollout training and routed user issues.
  - id: vague-1
    status: raw
    source_area: example-hr-ops
    item_type_hint: experience
    raw_text: Helped with HR stuff.
"#,
        );

        let conn = Connection::open(&db_path).unwrap();
        let result = preview_raw_intake_impl(&conn, path.to_str().unwrap()).unwrap();
        let evidence_count = count_evidence(&conn);
        let import_run_count = count_import_runs(&conn);
        drop(conn);
        fs::remove_file(&path).ok();
        fs::remove_file(&db_path).ok();

        assert_eq!(result.would_import_record_count, 0);
        assert_eq!(result.would_import_evidence_count, 0);
        assert_eq!(result.skipped_count, 2);
        assert!(result.items.iter().any(|item| item.skip_reason.as_deref()
            == Some("unknown_target_record")
            && item
                .repair_hint
                .as_deref()
                .unwrap_or_default()
                .contains("target record")));
        assert!(result.items.iter().any(|item| item.skip_reason.as_deref()
            == Some("ambiguous_item")
            && item
                .repair_hint
                .as_deref()
                .unwrap_or_default()
                .contains("clearer raw_text")));
        assert_eq!(evidence_count, 0);
        assert_eq!(import_run_count, 0);
    }

    #[test]
    fn imports_targeted_evidence_from_raw_yaml() {
        let db_path = setup_import_db();
        let path = temp_file_path("yaml");
        write_raw_yaml(
            &path,
            r#"
intake_items:
  - id: item_1
    status: raw
    source_area: example-hr-ops
    target_record_ref: sample-record
    item_type_hint: evidence
    raw_text: Supported Workday rollout training and routed user issues.
"#,
        );

        let conn = Connection::open(&db_path).unwrap();
        let result = import_raw_intake_impl(&conn, path.to_str().unwrap()).unwrap();
        let evidence_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM evidence_items", [], |row| row.get(0))
            .unwrap();
        drop(conn);
        fs::remove_file(&path).ok();
        fs::remove_file(&db_path).ok();

        assert!(result.success);
        assert_eq!(result.imported_record_count, 0);
        assert_eq!(result.imported_evidence_count, 1);
        assert_eq!(evidence_count, 1);
    }

    #[test]
    fn groups_new_record_items_within_one_import() {
        let db_path = setup_import_db();
        let path = temp_file_path("yaml");
        write_raw_yaml(
            &path,
            r#"
intake_items:
  - id: project-1
    status: raw
    source_area: Personal Project
    item_type_hint: experience
    proposed_title: Career Ledger
    raw_text: Built Rust import tooling and taxonomy-backed inference for a desktop workflow.
  - id: project-2
    status: raw
    source_area: Personal Project
    item_type_hint: experience
    proposed_title: Career Ledger
    raw_text: Added SQLite persistence and grouped evidence import behavior for desktop curation.
"#,
        );

        let conn = Connection::open(&db_path).unwrap();
        let result = import_raw_intake_impl(&conn, path.to_str().unwrap()).unwrap();
        let record_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM experience_records WHERE slug != 'sample-record'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let evidence_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM evidence_items", [], |row| row.get(0))
            .unwrap();
        drop(conn);
        fs::remove_file(&path).ok();
        fs::remove_file(&db_path).ok();

        assert_eq!(result.imported_record_count, 1);
        assert_eq!(result.imported_evidence_count, 2);
        assert_eq!(record_count, 1);
        assert_eq!(evidence_count, 2);
    }

    #[test]
    fn skips_ambiguous_untargeted_items() {
        let db_path = setup_import_db();
        let path = temp_file_path("yaml");
        write_raw_yaml(
            &path,
            r#"
intake_items:
  - id: vague-1
    status: raw
    source_area: example-hr-ops
    item_type_hint: experience
    raw_text: Helped with HR stuff.
"#,
        );

        let conn = Connection::open(&db_path).unwrap();
        let result = import_raw_intake_impl(&conn, path.to_str().unwrap()).unwrap();
        drop(conn);
        fs::remove_file(&path).ok();
        fs::remove_file(&db_path).ok();

        assert_eq!(result.imported_record_count, 0);
        assert_eq!(result.imported_evidence_count, 0);
        assert_eq!(result.skipped_count, 1);
        assert!(result
            .skip_reasons
            .iter()
            .any(|entry| entry.reason == "ambiguous_item" && entry.count == 1));
    }

    #[test]
    fn blocks_duplicate_intake_ids_on_reimport() {
        let db_path = setup_import_db();
        let path = temp_file_path("yaml");
        write_raw_yaml(
            &path,
            r#"
intake_items:
  - id: item_1
    status: raw
    source_area: example-hr-ops
    target_record_ref: sample-record
    item_type_hint: evidence
    raw_text: Supported Workday rollout training and routed user issues.
"#,
        );

        let conn = Connection::open(&db_path).unwrap();
        let first = import_raw_intake_impl(&conn, path.to_str().unwrap()).unwrap();
        let second = import_raw_intake_impl(&conn, path.to_str().unwrap()).unwrap();
        let import_item_count = count_import_items(&conn, "item_1");
        drop(conn);
        fs::remove_file(&path).ok();
        fs::remove_file(&db_path).ok();

        assert_eq!(first.imported_evidence_count, 1);
        assert_eq!(second.imported_evidence_count, 0);
        assert_eq!(second.skipped_count, 1);
        assert_eq!(second.duplicate_intake_ids, vec!["item_1".to_string()]);
        assert_eq!(import_item_count, 1);
    }

    #[test]
    fn retries_unknown_target_record_after_target_created() {
        let db_path = setup_import_db();
        let path = temp_file_path("yaml");
        write_raw_yaml(
            &path,
            r#"
intake_items:
  - id: retry-target-1
    status: raw
    source_area: example-hr-ops
    target_record_ref: later-record
    item_type_hint: evidence
    raw_text: Supported Workday rollout training and routed user issues.
"#,
        );

        let conn = Connection::open(&db_path).unwrap();
        let first = import_raw_intake_impl(&conn, path.to_str().unwrap()).unwrap();
        let first_import_item_count = count_import_items(&conn, "retry-target-1");

        conn.execute(
            r#"
            INSERT INTO experience_records (
              id, slug, record_type, organization, title, context_tags_json
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            "#,
            (
                "rec_later",
                "later-record",
                "employment",
                "Later Org",
                "Later Analyst",
                "[]",
            ),
        )
        .unwrap();

        let second = import_raw_intake_impl(&conn, path.to_str().unwrap()).unwrap();
        let second_import_item_count = count_import_items(&conn, "retry-target-1");
        let evidence_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM evidence_items WHERE experience_record_id = 'rec_later'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        drop(conn);
        fs::remove_file(&path).ok();
        fs::remove_file(&db_path).ok();

        assert_eq!(first.imported_evidence_count, 0);
        assert_eq!(first.skipped_count, 1);
        assert!(first
            .skip_reasons
            .iter()
            .any(|entry| entry.reason == "unknown_target_record" && entry.count == 1));
        assert_eq!(first_import_item_count, 0);

        assert_eq!(second.imported_evidence_count, 1);
        assert_eq!(second.skipped_count, 0);
        assert!(second.duplicate_intake_ids.is_empty());
        assert_eq!(second_import_item_count, 1);
        assert_eq!(evidence_count, 1);
    }

    #[test]
    fn skipped_items_do_not_leave_import_ledger_rows() {
        let db_path = setup_import_db();
        let path = temp_file_path("yaml");
        write_raw_yaml(
            &path,
            r#"
intake_items:
  - id: missing-target-1
    status: raw
    source_area: example-hr-ops
    target_record_ref: does-not-exist
    item_type_hint: evidence
    raw_text: Supported Workday rollout training and routed user issues.
  - id: vague-1
    status: raw
    source_area: example-hr-ops
    item_type_hint: experience
    raw_text: Helped with HR stuff.
"#,
        );

        let conn = Connection::open(&db_path).unwrap();
        let result = import_raw_intake_impl(&conn, path.to_str().unwrap()).unwrap();
        let import_item_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM raw_intake_import_items", [], |row| {
                row.get(0)
            })
            .unwrap();
        drop(conn);
        fs::remove_file(&path).ok();
        fs::remove_file(&db_path).ok();

        assert_eq!(result.imported_evidence_count, 0);
        assert_eq!(result.imported_record_count, 0);
        assert_eq!(result.skipped_count, 2);
        assert_eq!(import_item_count, 0);
    }

    #[test]
    fn creates_duplicate_claim_anomaly_for_duplicate_import_claim() {
        let db_path = setup_import_db();
        let path = temp_file_path("yaml");
        write_raw_yaml(
            &path,
            r#"
intake_items:
  - id: duplicate-1
    status: raw
    source_area: example-hr-ops
    target_record_ref: sample-record
    item_type_hint: evidence
    raw_text: Supported Workday rollout training and routed user issues.
"#,
        );

        let conn = Connection::open(&db_path).unwrap();
        conn.execute(
            "INSERT INTO evidence_items (
                id, experience_record_id, claim, date_range, tags_json, evidence_note
             ) VALUES (?1, ?2, ?3, NULL, ?4, NULL)",
            params![
                "existing-evidence",
                "rec_1",
                "Supported Workday rollout training and routed user issues.",
                "[\"workday\"]",
            ],
        )
        .unwrap();

        let result = import_raw_intake_impl(&conn, path.to_str().unwrap()).unwrap();
        let anomaly_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM anomalies WHERE anomaly_code = 'duplicate_claim' AND resolved_at IS NULL",
                [],
                |row| row.get(0),
            )
            .unwrap();
        drop(conn);
        fs::remove_file(&path).ok();
        fs::remove_file(&db_path).ok();

        assert_eq!(result.imported_evidence_count, 0);
        assert_eq!(result.skipped_count, 1);
        assert_eq!(anomaly_count, 1);
    }
}
