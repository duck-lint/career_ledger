#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    collections::{BTreeSet, HashSet},
    path::PathBuf,
};

use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

const CAREER_DB_FILE_NAME: &str = "career.db";
const RECORD_TAG_WEIGHT: u32 = 1;
const EVIDENCE_TAG_WEIGHT: u32 = 2;
const EVIDENCE_EXPERIENCE_WEIGHT: u32 = 1;
const REQUIREMENT_REGION_AUTHORITY_SQLITE: &str = "sqlite";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProbeRunSummary {
    runtime_error: Option<String>,
    requirement_region_authority: String,
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
    target_region_label: String,
    selected_region_score: String,
    requirement_weights: String,
    matched_cue_terms: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProbeFieldDifference {
    field: String,
    first_value: String,
    second_value: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct I08ProbeSummary {
    first_run: ProbeRunSummary,
    second_run: ProbeRunSummary,
    differing_visible_analysis_fields: Vec<ProbeFieldDifference>,
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

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JobPostingInput {
    #[serde(default)]
    title: String,
    #[serde(default)]
    summary: String,
    #[serde(default)]
    text: String,
    #[serde(default)]
    description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthorityMarkers {
    requirement_region_authority: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SourceAuthority {
    experience_records: Vec<ExperienceRecord>,
    evidence_items: Vec<EvidenceItem>,
    taxonomy: Taxonomy,
    #[serde(rename = "jobPostingInput")]
    job_posting_input: JobPostingInput,
    #[serde(rename = "authorityMarkers")]
    authority_markers: AuthorityMarkers,
}

impl JobPostingInput {
    fn normalized(self) -> Result<Self, String> {
        let normalized = Self {
            title: self.title.trim().to_owned(),
            summary: self.summary.trim().to_owned(),
            text: self.text.trim().to_owned(),
            description: self.description.trim().to_owned(),
        };

        if [
            normalized.title.as_str(),
            normalized.summary.as_str(),
            normalized.text.as_str(),
            normalized.description.as_str(),
        ]
        .iter()
        .all(|value| value.is_empty())
        {
            return Err("jobPostingInput must include at least one non-empty text field.".to_owned());
        }

        Ok(normalized)
    }
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

fn parse_string_array(raw_json: &str, field_label: &str) -> Result<Vec<String>, String> {
    let values = serde_json::from_str::<Vec<String>>(raw_json)
        .map_err(|error| format!("Failed to parse {field_label} as a JSON string array: {error}"))?;

    values
        .into_iter()
        .enumerate()
        .map(|(index, value)| {
            let trimmed = value.trim().to_owned();
            if trimmed.is_empty() {
                return Err(format!("{field_label}[{index}] must be a non-empty string."));
            }

            Ok(trimmed)
        })
        .collect()
}

fn parse_non_negative_u32(value: i64, field_label: &str) -> Result<u32, String> {
    u32::try_from(value)
        .map_err(|_| format!("{field_label} must be a non-negative 32-bit integer."))
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

fn load_tag_requirement_links(connection: &Connection) -> Result<Vec<TagRequirementLink>, String> {
    let mut statement = connection
        .prepare(
            "SELECT tag_id, requirement_id, weight \
             FROM tag_requirement_links \
             ORDER BY tag_id, requirement_id",
        )
        .map_err(|error| format!("Failed to prepare tag_requirement_links query: {error}"))?;
    let mut rows = statement
        .query([])
        .map_err(|error| format!("Failed to query tag_requirement_links: {error}"))?;
    let mut links = Vec::new();

    while let Some(row) = rows
        .next()
        .map_err(|error| format!("Failed to read tag_requirement_links row: {error}"))?
    {
        let tag_id = row
            .get::<_, String>(0)
            .map_err(|error| format!("Failed to read tag_requirement_links.tag_id: {error}"))?;
        let requirement_id = row
            .get::<_, String>(1)
            .map_err(|error| {
                format!(
                    "Failed to read tag_requirement_links.requirement_id for {tag_id}: {error}"
                )
            })?;
        let raw_weight = row
            .get::<_, i64>(2)
            .map_err(|error| {
                format!("Failed to read tag_requirement_links.weight for {tag_id}: {error}")
            })?;

        links.push(TagRequirementLink {
            tag_id: tag_id.clone(),
            requirement_id,
            weight: parse_non_negative_u32(
                raw_weight,
                &format!("tag_requirement_links[{tag_id}].weight"),
            )?,
        });
    }

    Ok(links)
}

fn load_requirements(connection: &Connection) -> Result<Vec<Requirement>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, label, default_weight, cue_terms_json \
             FROM requirements \
             ORDER BY id",
        )
        .map_err(|error| format!("Failed to prepare requirements query: {error}"))?;
    let mut rows = statement
        .query([])
        .map_err(|error| format!("Failed to query requirements: {error}"))?;
    let mut requirements = Vec::new();

    while let Some(row) = rows
        .next()
        .map_err(|error| format!("Failed to read requirements row: {error}"))?
    {
        let id = row
            .get::<_, String>(0)
            .map_err(|error| format!("Failed to read requirements.id: {error}"))?;
        let label = row
            .get::<_, String>(1)
            .map_err(|error| format!("Failed to read requirements.label for {id}: {error}"))?;
        let raw_default_weight = row
            .get::<_, i64>(2)
            .map_err(|error| {
                format!("Failed to read requirements.default_weight for {id}: {error}")
            })?;
        let cue_terms_json = row
            .get::<_, String>(3)
            .map_err(|error| {
                format!("Failed to read requirements.cue_terms_json for {id}: {error}")
            })?;

        requirements.push(Requirement {
            id: id.clone(),
            label,
            default_weight: parse_non_negative_u32(
                raw_default_weight,
                &format!("requirements[{id}].default_weight"),
            )?,
            cue_terms: parse_string_array(
                &cue_terms_json,
                &format!("requirements[{id}].cue_terms_json"),
            )?,
        });
    }

    Ok(requirements)
}

fn load_target_regions(connection: &Connection) -> Result<Vec<TargetRegion>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, label, requirement_ids_json \
             FROM target_regions \
             ORDER BY id",
        )
        .map_err(|error| format!("Failed to prepare target_regions query: {error}"))?;
    let mut rows = statement
        .query([])
        .map_err(|error| format!("Failed to query target_regions: {error}"))?;
    let mut target_regions = Vec::new();

    while let Some(row) = rows
        .next()
        .map_err(|error| format!("Failed to read target_regions row: {error}"))?
    {
        let id = row
            .get::<_, String>(0)
            .map_err(|error| format!("Failed to read target_regions.id: {error}"))?;
        let label = row
            .get::<_, String>(1)
            .map_err(|error| format!("Failed to read target_regions.label for {id}: {error}"))?;
        let requirement_ids_json = row
            .get::<_, String>(2)
            .map_err(|error| {
                format!("Failed to read target_regions.requirement_ids_json for {id}: {error}")
            })?;

        target_regions.push(TargetRegion {
            id: id.clone(),
            label,
            requirement_ids: parse_string_array(
                &requirement_ids_json,
                &format!("target_regions[{id}].requirement_ids_json"),
            )?,
        });
    }

    Ok(target_regions)
}

fn validate_requirement_region_taxonomy(
    canonical_tag_ids: &HashSet<String>,
    tag_requirement_links: &[TagRequirementLink],
    requirements: &[Requirement],
    target_regions: &[TargetRegion],
) -> Result<(), String> {
    let requirement_ids = requirements
        .iter()
        .map(|requirement| requirement.id.as_str())
        .collect::<HashSet<_>>();

    for link in tag_requirement_links {
        if !canonical_tag_ids.contains(&link.tag_id) {
            return Err(format!(
                "The taxonomy authority references an unknown canonical tag: {}.",
                link.tag_id
            ));
        }

        if !requirement_ids.contains(link.requirement_id.as_str()) {
            return Err(format!(
                "The taxonomy authority references an unknown requirement id: {}.",
                link.requirement_id
            ));
        }
    }

    for region in target_regions {
        for requirement_id in &region.requirement_ids {
            if !requirement_ids.contains(requirement_id.as_str()) {
                return Err(format!(
                    "The taxonomy authority target region {} references an unknown requirement id: {}.",
                    region.id, requirement_id
                ));
            }
        }
    }

    Ok(())
}

fn load_requirement_region_taxonomy(
    connection: &Connection,
    canonical_tag_ids: &HashSet<String>,
) -> Result<(Vec<TagRequirementLink>, Vec<Requirement>, Vec<TargetRegion>), String> {
    let tag_requirement_links = load_tag_requirement_links(connection)?;
    let requirements = load_requirements(connection)?;
    let target_regions = load_target_regions(connection)?;

    validate_requirement_region_taxonomy(
        canonical_tag_ids,
        &tag_requirement_links,
        &requirements,
        &target_regions,
    )?;

    Ok((tag_requirement_links, requirements, target_regions))
}

#[tauri::command]
fn load_source_authority(job_posting_input: JobPostingInput) -> Result<Value, String> {
    let connection = open_source_authority_db()?;
    let (tags, canonical_tag_ids) = load_taxonomy_tags(&connection)?;
    let (tag_requirement_links, requirements, target_regions) =
        load_requirement_region_taxonomy(&connection, &canonical_tag_ids)?;

    let source_authority = SourceAuthority {
        experience_records: load_experience_records(&connection, &canonical_tag_ids)?,
        evidence_items: load_evidence_items(&connection, &canonical_tag_ids)?,
        taxonomy: Taxonomy {
            tags,
            tag_requirement_links,
            requirements,
            target_regions,
        },
        job_posting_input: job_posting_input.normalized()?,
        authority_markers: AuthorityMarkers {
            requirement_region_authority: REQUIREMENT_REGION_AUTHORITY_SQLITE.to_owned(),
        },
    };

    serde_json::to_value(source_authority)
        .map_err(|error| format!("Failed to serialize the source authority payload: {error}"))
}

#[tauri::command]
fn report_i08_probe(summary: I08ProbeSummary, app: AppHandle) -> Result<(), String> {
    let encoded = serde_json::to_string(&summary)
        .map_err(|error| format!("Failed to serialize probe summary: {error}"))?;

    println!("I08_PROBE:{encoded}");
    app.exit(0);
    Ok(())
}

fn main() {
    let probe_mode = std::env::args().any(|arg| arg == "--i08-probe");
    let window_url = if probe_mode {
        WebviewUrl::App("index.html?probe=i08".into())
    } else {
        WebviewUrl::App("index.html".into())
    };

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_source_authority, report_i08_probe])
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