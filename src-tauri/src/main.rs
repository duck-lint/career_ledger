#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    collections::{BTreeSet, HashSet},
    path::PathBuf,
};

use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

const SEMANTIC_OVERLAY_JSON: &str = include_str!("../fixtures/source-authority-semantic-overlay.json");
const CAREER_DB_FILE_NAME: &str = "career.db";
const RECORD_TAG_WEIGHT: u32 = 1;
const EVIDENCE_TAG_WEIGHT: u32 = 2;
const EVIDENCE_EXPERIENCE_WEIGHT: u32 = 1;

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

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TagLink {
    tag_id: String,
    weight: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ExperienceRecord {
    id: String,
    label: String,
    tag_links: Vec<TagLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ExperienceLink {
    weight: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct EvidenceItem {
    id: String,
    label: String,
    experience_record_id: String,
    experience_link: ExperienceLink,
    tag_links: Vec<TagLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TaxonomyTag {
    id: String,
    label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TagRequirementLink {
    tag_id: String,
    requirement_id: String,
    weight: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Requirement {
    id: String,
    label: String,
    default_weight: u32,
    cue_terms: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TargetRegion {
    id: String,
    label: String,
    requirement_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Taxonomy {
    tags: Vec<TaxonomyTag>,
    tag_requirement_links: Vec<TagRequirementLink>,
    requirements: Vec<Requirement>,
    target_regions: Vec<TargetRegion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JobPostingInput {
    title: String,
    text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SourceAuthority {
    experience_records: Vec<ExperienceRecord>,
    evidence_items: Vec<EvidenceItem>,
    taxonomy: Taxonomy,
    #[serde(rename = "jobPostingInput")]
    job_posting_input: JobPostingInput,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SemanticOverlayTaxonomy {
    tag_requirement_links: Vec<TagRequirementLink>,
    requirements: Vec<Requirement>,
    target_regions: Vec<TargetRegion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SemanticOverlay {
    taxonomy: SemanticOverlayTaxonomy,
    job_posting_input: JobPostingInput,
}

fn source_authority_db_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures")
        .join(CAREER_DB_FILE_NAME)
}

fn open_source_authority_db() -> Result<Connection, String> {
    let path = source_authority_db_path();

    if !path.is_file() {
        return Err(format!(
            "Source-authority database not found at {}.",
            path.display()
        ));
    }

    Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|error| {
        format!(
            "Failed to open source-authority database at {}: {error}",
            path.display()
        )
    })
}

fn load_semantic_overlay() -> Result<SemanticOverlay, String> {
    serde_json::from_str(SEMANTIC_OVERLAY_JSON)
        .map_err(|error| format!("Failed to parse the source-authority semantic overlay: {error}"))
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value
        .map(|text| text.trim().to_owned())
        .filter(|text| !text.is_empty())
}

fn parse_tag_links(
    raw_tags: &str,
    field_label: &str,
    canonical_tag_ids: &HashSet<String>,
    weight: u32,
) -> Result<Vec<TagLink>, String> {
    let tag_ids = serde_json::from_str::<Vec<String>>(raw_tags).map_err(|error| {
        format!("Failed to parse {field_label} as a JSON string array: {error}")
    })?;

    let unique_tag_ids = tag_ids
        .into_iter()
        .map(|tag| tag.trim().to_owned())
        .filter(|tag| !tag.is_empty() && canonical_tag_ids.contains(tag))
        .collect::<BTreeSet<_>>();

    Ok(unique_tag_ids
        .into_iter()
        .map(|tag_id| TagLink { tag_id, weight })
        .collect())
}

fn load_taxonomy_tags(connection: &Connection) -> Result<(Vec<TaxonomyTag>, HashSet<String>), String> {
    let mut statement = connection
        .prepare("SELECT tag FROM canonical_tags ORDER BY tag")
        .map_err(|error| format!("Failed to prepare canonical_tags query: {error}"))?;
    let mut rows = statement
        .query([])
        .map_err(|error| format!("Failed to query canonical_tags: {error}"))?;
    let mut tags = Vec::new();
    let mut canonical_tag_ids = HashSet::new();

    while let Some(row) = rows
        .next()
        .map_err(|error| format!("Failed to read canonical_tags row: {error}"))?
    {
        let tag = row
            .get::<_, String>(0)
            .map_err(|error| format!("Failed to read canonical tag value: {error}"))?;

        canonical_tag_ids.insert(tag.clone());
        tags.push(TaxonomyTag {
            id: tag.clone(),
            label: tag,
        });
    }

    Ok((tags, canonical_tag_ids))
}

fn load_experience_records(
    connection: &Connection,
    canonical_tag_ids: &HashSet<String>,
) -> Result<Vec<ExperienceRecord>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, organization, title, canonical_scope_summary, context_tags_json \
             FROM experience_records \
             ORDER BY id",
        )
        .map_err(|error| format!("Failed to prepare experience_records query: {error}"))?;
    let mut rows = statement
        .query([])
        .map_err(|error| format!("Failed to query experience_records: {error}"))?;
    let mut records = Vec::new();

    while let Some(row) = rows
        .next()
        .map_err(|error| format!("Failed to read experience_records row: {error}"))?
    {
        let id = row
            .get::<_, String>(0)
            .map_err(|error| format!("Failed to read experience_records.id: {error}"))?;
        let organization = row
            .get::<_, String>(1)
            .map_err(|error| format!("Failed to read experience_records.organization for {id}: {error}"))?;
        let title = row
            .get::<_, String>(2)
            .map_err(|error| format!("Failed to read experience_records.title for {id}: {error}"))?;
        let canonical_scope_summary = row
            .get::<_, Option<String>>(3)
            .map_err(|error| {
                format!(
                    "Failed to read experience_records.canonical_scope_summary for {id}: {error}"
                )
            })?;
        let context_tags_json = row
            .get::<_, String>(4)
            .map_err(|error| {
                format!(
                    "Failed to read experience_records.context_tags_json for {id}: {error}"
                )
            })?;

        let label = normalize_optional_string(canonical_scope_summary)
            .unwrap_or_else(|| format!("{} · {}", organization.trim(), title.trim()));
        let tag_links = parse_tag_links(
            &context_tags_json,
            &format!("experience_records[{id}].context_tags_json"),
            canonical_tag_ids,
            RECORD_TAG_WEIGHT,
        )?;

        records.push(ExperienceRecord {
            id,
            label,
            tag_links,
        });
    }

    Ok(records)
}

fn load_evidence_items(
    connection: &Connection,
    canonical_tag_ids: &HashSet<String>,
) -> Result<Vec<EvidenceItem>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, experience_record_id, claim, evidence_note, tags_json \
             FROM evidence_items \
             ORDER BY id",
        )
        .map_err(|error| format!("Failed to prepare evidence_items query: {error}"))?;
    let mut rows = statement
        .query([])
        .map_err(|error| format!("Failed to query evidence_items: {error}"))?;
    let mut items = Vec::new();

    while let Some(row) = rows
        .next()
        .map_err(|error| format!("Failed to read evidence_items row: {error}"))?
    {
        let id = row
            .get::<_, String>(0)
            .map_err(|error| format!("Failed to read evidence_items.id: {error}"))?;
        let experience_record_id = row
            .get::<_, String>(1)
            .map_err(|error| {
                format!(
                    "Failed to read evidence_items.experience_record_id for {id}: {error}"
                )
            })?;
        let claim = row
            .get::<_, String>(2)
            .map_err(|error| format!("Failed to read evidence_items.claim for {id}: {error}"))?;
        let evidence_note = row
            .get::<_, Option<String>>(3)
            .map_err(|error| {
                format!("Failed to read evidence_items.evidence_note for {id}: {error}")
            })?;
        let tags_json = row
            .get::<_, String>(4)
            .map_err(|error| format!("Failed to read evidence_items.tags_json for {id}: {error}"))?;

        let label = normalize_optional_string(evidence_note)
            .unwrap_or_else(|| claim.trim().to_owned());
        let tag_links = parse_tag_links(
            &tags_json,
            &format!("evidence_items[{id}].tags_json"),
            canonical_tag_ids,
            EVIDENCE_TAG_WEIGHT,
        )?;

        items.push(EvidenceItem {
            id,
            label,
            experience_record_id,
            experience_link: ExperienceLink {
                weight: EVIDENCE_EXPERIENCE_WEIGHT,
            },
            tag_links,
        });
    }

    Ok(items)
}

fn validate_overlay(
    overlay: &SemanticOverlay,
    canonical_tag_ids: &HashSet<String>,
) -> Result<(), String> {
    let requirement_ids = overlay
        .taxonomy
        .requirements
        .iter()
        .map(|requirement| requirement.id.as_str())
        .collect::<HashSet<_>>();

    for link in &overlay.taxonomy.tag_requirement_links {
        if !canonical_tag_ids.contains(&link.tag_id) {
            return Err(format!(
                "The semantic overlay references an unknown canonical tag: {}.",
                link.tag_id
            ));
        }

        if !requirement_ids.contains(link.requirement_id.as_str()) {
            return Err(format!(
                "The semantic overlay references an unknown requirement id: {}.",
                link.requirement_id
            ));
        }
    }

    for region in &overlay.taxonomy.target_regions {
        for requirement_id in &region.requirement_ids {
            if !requirement_ids.contains(requirement_id.as_str()) {
                return Err(format!(
                    "The semantic overlay target region {} references an unknown requirement id: {}.",
                    region.id, requirement_id
                ));
            }
        }
    }

    Ok(())
}

#[tauri::command]
fn load_source_authority() -> Result<Value, String> {
    let overlay = load_semantic_overlay()?;
    let connection = open_source_authority_db()?;
    let (tags, canonical_tag_ids) = load_taxonomy_tags(&connection)?;

    validate_overlay(&overlay, &canonical_tag_ids)?;

    let source_authority = SourceAuthority {
        experience_records: load_experience_records(&connection, &canonical_tag_ids)?,
        evidence_items: load_evidence_items(&connection, &canonical_tag_ids)?,
        taxonomy: Taxonomy {
            tags,
            tag_requirement_links: overlay.taxonomy.tag_requirement_links,
            requirements: overlay.taxonomy.requirements,
            target_regions: overlay.taxonomy.target_regions,
        },
        job_posting_input: overlay.job_posting_input,
    };

    serde_json::to_value(source_authority)
        .map_err(|error| format!("Failed to serialize the source authority payload: {error}"))
}

#[tauri::command]
fn report_i06_probe(summary: ProbeSummary, app: AppHandle) -> Result<(), String> {
    let encoded = serde_json::to_string(&summary)
        .map_err(|error| format!("Failed to serialize probe summary: {error}"))?;

    println!("I06_PROBE:{encoded}");
    app.exit(0);
    Ok(())
}

fn main() {
    let probe_mode = std::env::args().any(|arg| arg == "--i06-probe");
    let window_url = if probe_mode {
        WebviewUrl::App("index.html?probe=1".into())
    } else {
        WebviewUrl::App("index.html".into())
    };

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_source_authority, report_i06_probe])
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