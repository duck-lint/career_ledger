use crate::inference::{self, EvidenceRecordContext};
use crate::validation::{
    normalize_lower_snake_case, normalize_optional_owned, normalize_optional_text,
    normalize_required_text, slugify_lower_snake,
};
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::env;
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

const CANONICAL_TAG_SELECT: &str = "
    SELECT ct.id, ct.tag, ct.description, dtm.category_name, dtm.display_label, ct.created_at
    FROM canonical_tags ct
    LEFT JOIN delivery_toolkit_metadata dtm ON dtm.canonical_tag = ct.tag
";
const TAXONOMY_VERSION_METADATA_KEY: &str = "version";
const TAXONOMY_CHANGE_GENERATION_METADATA_KEY: &str = "taxonomy_change_generation";
const LAST_LIBRARY_TAG_REFRESH_GENERATION_METADATA_KEY: &str =
    "last_library_tag_refresh_generation";
const LAST_TAXONOMY_CHANGE_AT_METADATA_KEY: &str = "last_taxonomy_change_at";
const LAST_LIBRARY_TAG_REFRESH_AT_METADATA_KEY: &str = "last_library_tag_refresh_at";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CanonicalTag {
    pub id: String,
    pub tag: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub display_label: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeliveryToolkitCategory {
    pub name: String,
    pub sort_order: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TagInferenceMarkerTerm {
    pub id: String,
    pub term_group: String,
    pub term_value: String,
    pub sort_order: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TagInferenceMarker {
    pub id: String,
    pub canonical_tag: String,
    pub marker_kind: String,
    pub literal_value: Option<String>,
    pub terms: Vec<TagInferenceMarkerTerm>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TagInferenceMarkerInput {
    pub marker_kind: String,
    pub literal_value: Option<String>,
    #[serde(default)]
    pub all_of: Vec<String>,
    #[serde(default)]
    pub any_of: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TagNormalizationResult {
    pub normalized: Vec<String>,
    pub unknown: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TaxonomyImportResult {
    pub imported_taxonomy_version: String,
    pub retagged_evidence_count: usize,
    pub rebuilt_record_count: usize,
    pub unknown_candidate_profile_signal_tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LibraryTagRefreshResult {
    pub taxonomy_version: String,
    pub retagged_evidence_count: usize,
    pub rebuilt_record_count: usize,
    pub unknown_candidate_profile_signal_tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LibraryTagSyncStatus {
    pub requires_reinference: bool,
    pub last_taxonomy_change_at: Option<String>,
    pub last_library_tag_refresh_at: Option<String>,
}

#[derive(Debug, Clone)]
struct NormalizedTagInferenceMarkerInput {
    marker_kind: String,
    literal_value: Option<String>,
    all_of: Vec<String>,
    any_of: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct TaxonomySeed {
    version: Option<String>,
    canonical_tags: Vec<String>,
    #[serde(default)]
    delivery_toolkit_categories: Vec<DeliveryToolkitCategorySeed>,
    #[serde(default)]
    delivery_toolkit_metadata: BTreeMap<String, DeliveryToolkitMetadataSeed>,
    #[serde(default)]
    tag_inference_markers: BTreeMap<String, Vec<MarkerSeed>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct DeliveryToolkitCategorySeed {
    name: String,
    sort_order: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct DeliveryToolkitMetadataSeed {
    category: String,
    display_label: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
enum MarkerSeed {
    Literal(String),
    Compound(CompoundMarkerSeed),
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
struct CompoundMarkerSeed {
    #[serde(default)]
    all_of: Vec<String>,
    #[serde(default)]
    any_of: Vec<String>,
}

fn normalize_marker_text(value: &str) -> Option<String> {
    normalize_optional_text(Some(value)).map(|text| text.to_lowercase())
}

fn default_tag_inference_markers(tag: &str) -> Vec<String> {
    let phrase = tag.replace('_', " ");
    let mut markers = Vec::new();
    if let Some(cleaned) = normalize_marker_text(&phrase) {
        markers.push(cleaned.clone());
        if phrase.contains(' ') {
            let hyphenated = phrase.replace(' ', "-");
            if let Some(cleaned_hyphenated) = normalize_marker_text(&hyphenated) {
                if !markers.contains(&cleaned_hyphenated) {
                    markers.push(cleaned_hyphenated);
                }
            }
        }
    }
    markers
}

fn new_id() -> String {
    Uuid::new_v4().to_string()
}

fn taxonomy_metadata_now() -> &'static str {
    "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
}

fn current_taxonomy_metadata_timestamp(conn: &Connection) -> Result<String, String> {
    conn.query_row(
        &format!("SELECT {}", taxonomy_metadata_now()),
        [],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

fn get_taxonomy_metadata_value(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT metadata_value FROM taxonomy_metadata WHERE metadata_key = ?1 LIMIT 1",
        params![key],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(|e| e.to_string())
}

fn get_taxonomy_metadata_i64(conn: &Connection, key: &str) -> Result<Option<i64>, String> {
    let Some(value) = get_taxonomy_metadata_value(conn, key)? else {
        return Ok(None);
    };

    value.parse::<i64>().map(Some).map_err(|error| {
        format!("Invalid integer metadata value for {key:?}: {error}")
    })
}

fn upsert_taxonomy_metadata_value(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        &format!(
            "INSERT INTO taxonomy_metadata (metadata_key, metadata_value, updated_at)
             VALUES (?1, ?2, {})
             ON CONFLICT(metadata_key) DO UPDATE SET
                 metadata_value = excluded.metadata_value,
                 updated_at = {}",
            taxonomy_metadata_now(),
            taxonomy_metadata_now(),
        ),
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn mark_taxonomy_changed(conn: &Connection) -> Result<(i64, String), String> {
    let next_generation = get_taxonomy_metadata_i64(conn, TAXONOMY_CHANGE_GENERATION_METADATA_KEY)?
        .unwrap_or(0)
        + 1;
    let timestamp = current_taxonomy_metadata_timestamp(conn)?;

    upsert_taxonomy_metadata_value(
        conn,
        TAXONOMY_CHANGE_GENERATION_METADATA_KEY,
        &next_generation.to_string(),
    )?;
    upsert_taxonomy_metadata_value(conn, LAST_TAXONOMY_CHANGE_AT_METADATA_KEY, &timestamp)?;

    Ok((next_generation, timestamp))
}

fn mark_library_tags_refreshed(conn: &Connection) -> Result<(i64, String), String> {
    let generation = get_taxonomy_metadata_i64(conn, TAXONOMY_CHANGE_GENERATION_METADATA_KEY)?
        .unwrap_or(0);
    let timestamp = current_taxonomy_metadata_timestamp(conn)?;

    upsert_taxonomy_metadata_value(
        conn,
        LAST_LIBRARY_TAG_REFRESH_GENERATION_METADATA_KEY,
        &generation.to_string(),
    )?;
    upsert_taxonomy_metadata_value(conn, LAST_LIBRARY_TAG_REFRESH_AT_METADATA_KEY, &timestamp)?;

    Ok((generation, timestamp))
}

fn mark_taxonomy_and_library_tags_in_sync(conn: &Connection) -> Result<(i64, String), String> {
    let (generation, timestamp) = mark_taxonomy_changed(conn)?;
    upsert_taxonomy_metadata_value(
        conn,
        LAST_LIBRARY_TAG_REFRESH_GENERATION_METADATA_KEY,
        &generation.to_string(),
    )?;
    upsert_taxonomy_metadata_value(conn, LAST_LIBRARY_TAG_REFRESH_AT_METADATA_KEY, &timestamp)?;
    Ok((generation, timestamp))
}

fn build_library_tag_refresh_result(
    conn: &Connection,
    retagged_evidence_count: usize,
    rebuilt_record_count: usize,
) -> Result<LibraryTagRefreshResult, String> {
    Ok(LibraryTagRefreshResult {
        taxonomy_version: get_runtime_taxonomy_version(conn)?,
        retagged_evidence_count,
        rebuilt_record_count,
        unknown_candidate_profile_signal_tags: query_unknown_candidate_profile_signal_tags(conn)?,
    })
}

fn row_to_canonical_tag(row: &Row<'_>) -> rusqlite::Result<CanonicalTag> {
    Ok(CanonicalTag {
        id: row.get(0)?,
        tag: row.get(1)?,
        description: row.get(2)?,
        category: row.get(3)?,
        display_label: row.get(4)?,
        created_at: row.get(5)?,
    })
}

fn dedupe_preserve(values: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut deduped = Vec::new();
    for value in values {
        if seen.insert(value.clone()) {
            deduped.push(value);
        }
    }
    deduped
}

fn normalize_marker_terms(values: &[String]) -> Vec<String> {
    dedupe_preserve(
        values
            .iter()
            .filter_map(|value| normalize_marker_text(value))
            .collect(),
    )
}

fn normalize_tag_inference_marker_inputs(
    inputs: Vec<TagInferenceMarkerInput>,
) -> Result<Vec<NormalizedTagInferenceMarkerInput>, String> {
    let mut normalized = Vec::new();

    for input in inputs {
        match input.marker_kind.as_str() {
            "literal" => {
                let literal_value = input
                    .literal_value
                    .as_deref()
                    .and_then(normalize_marker_text)
                    .ok_or_else(|| {
                        "Literal markers must contain a non-empty literal value.".to_string()
                    })?;
                normalized.push(NormalizedTagInferenceMarkerInput {
                    marker_kind: "literal".to_string(),
                    literal_value: Some(literal_value),
                    all_of: Vec::new(),
                    any_of: Vec::new(),
                });
            }
            "compound" => {
                let all_of = normalize_marker_terms(&input.all_of);
                let any_of = normalize_marker_terms(&input.any_of);
                if all_of.is_empty() && any_of.is_empty() {
                    return Err(
                        "Compound markers must include at least one all_of or any_of term."
                            .to_string(),
                    );
                }
                normalized.push(NormalizedTagInferenceMarkerInput {
                    marker_kind: "compound".to_string(),
                    literal_value: None,
                    all_of,
                    any_of,
                });
            }
            _ => {
                return Err("Marker kind must be either 'literal' or 'compound'.".to_string());
            }
        }
    }

    if normalized.is_empty() {
        return Err("Every canonical tag must have at least one inference marker.".to_string());
    }

    Ok(normalized)
}

pub(crate) fn with_transaction<T, F>(conn: &Connection, operation: F) -> Result<T, String>
where
    F: FnOnce(&Connection) -> Result<T, String>,
{
    conn.execute_batch("BEGIN IMMEDIATE TRANSACTION")
        .map_err(|e| e.to_string())?;
    let result = operation(conn);
    match result {
        Ok(value) => {
            conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
            Ok(value)
        }
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

fn clear_taxonomy_tables(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "DELETE FROM tag_inference_marker_terms;
         DELETE FROM tag_inference_markers;
         DELETE FROM delivery_toolkit_metadata;
         DELETE FROM delivery_toolkit_categories;
         DELETE FROM canonical_tags;
         DELETE FROM taxonomy_metadata;",
    )
    .map_err(|e| e.to_string())
}

fn parse_tags_json(raw: Option<String>) -> Vec<String> {
    raw.and_then(|value| serde_json::from_str::<Vec<String>>(&value).ok())
        .unwrap_or_default()
}

fn serialize_tags_json(tags: &[String]) -> String {
    serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string())
}

fn parse_taxonomy_json_str(raw_text: &str) -> Result<TaxonomySeed, String> {
    serde_json::from_str(raw_text).map_err(|error| error.to_string())
}

fn parse_taxonomy_seed() -> Result<TaxonomySeed, String> {
    parse_taxonomy_json_str(crate::embedded_assets::TAGS_TAXONOMY_JSON)
}

fn normalize_canonical_tags(seed: &TaxonomySeed) -> Result<Vec<String>, String> {
    let mut normalized = Vec::new();
    let mut seen = HashSet::new();
    for raw_tag in &seed.canonical_tags {
        let tag = normalize_lower_snake_case(raw_tag, "canonical_tag")?;
        if !seen.insert(tag.clone()) {
            return Err(format!(
                "tags taxonomy 'canonical_tags' contains duplicate value {tag:?}."
            ));
        }
        normalized.push(tag);
    }
    Ok(normalized)
}

fn normalize_delivery_toolkit_categories(
    seed: &TaxonomySeed,
) -> Result<Vec<DeliveryToolkitCategory>, String> {
    let mut categories = Vec::new();
    let mut seen_names = HashSet::new();
    let mut seen_sort_orders = HashSet::new();

    for entry in &seed.delivery_toolkit_categories {
        let name = normalize_required_text(
            Some(entry.name.as_str()),
            "delivery_toolkit_categories.name",
        )?;

        if !seen_names.insert(name.clone()) {
            return Err(format!(
                "delivery_toolkit_categories contains duplicate category {name:?}."
            ));
        }

        if entry.sort_order < 0 {
            return Err(format!(
                "delivery_toolkit_categories sort_order for {name:?} must be non-negative."
            ));
        }

        if !seen_sort_orders.insert(entry.sort_order) {
            return Err(format!(
                "delivery_toolkit_categories contains duplicate sort_order {:?}.",
                entry.sort_order
            ));
        }

        categories.push(DeliveryToolkitCategory {
            name,
            sort_order: entry.sort_order,
        });
    }

    categories.sort_by(|left, right| {
        left.sort_order
            .cmp(&right.sort_order)
            .then_with(|| left.name.cmp(&right.name))
    });
    Ok(categories)
}

fn seed_taxonomy_contents_from_seed(conn: &Connection, seed: &TaxonomySeed) -> Result<String, String> {
    let version =
        normalize_optional_text(seed.version.as_deref()).unwrap_or_else(|| "1.0".to_string());
    let canonical_tags = normalize_canonical_tags(seed)?;
    let canonical_tag_set: HashSet<String> = canonical_tags.iter().cloned().collect();
    let delivery_toolkit_categories = normalize_delivery_toolkit_categories(seed)?;
    let delivery_toolkit_category_set: HashSet<String> = delivery_toolkit_categories
        .iter()
        .map(|category| category.name.clone())
        .collect();

    for tag in &canonical_tags {
        conn.execute(
            "INSERT INTO canonical_tags (id, tag, description) VALUES (?1, ?2, NULL)",
            params![new_id(), tag],
        )
        .map_err(|e| e.to_string())?;
    }

    for category in &delivery_toolkit_categories {
        conn.execute(
            "INSERT INTO delivery_toolkit_categories (name, sort_order) VALUES (?1, ?2)",
            params![category.name, category.sort_order],
        )
        .map_err(|e| e.to_string())?;
    }

    let metadata_keys: HashSet<String> = seed
        .delivery_toolkit_metadata
        .keys()
        .map(|tag| normalize_lower_snake_case(tag, "delivery_toolkit_metadata tag"))
        .collect::<Result<HashSet<_>, _>>()?;
    if metadata_keys != canonical_tag_set {
        let missing: Vec<String> = canonical_tag_set
            .difference(&metadata_keys)
            .cloned()
            .collect();
        if !missing.is_empty() {
            return Err(format!(
                "delivery_toolkit_metadata missing canonical tags: {}.",
                missing.join(", ")
            ));
        }
    }

    for (raw_tag, entry) in &seed.delivery_toolkit_metadata {
        let canonical_tag = normalize_lower_snake_case(raw_tag, "delivery_toolkit_metadata tag")?;
        if !canonical_tag_set.contains(&canonical_tag) {
            return Err(format!(
                "delivery_toolkit_metadata references unknown canonical tag {raw_tag:?}."
            ));
        }
        let category = normalize_required_text(
            Some(entry.category.as_str()),
            "delivery_toolkit_metadata.category",
        )?;
        if !delivery_toolkit_category_set.contains(&category) {
            return Err(format!(
                "delivery_toolkit_metadata for canonical tag {canonical_tag:?} references unknown category {category:?}."
            ));
        }
        let display_label = normalize_required_text(
            Some(entry.display_label.as_str()),
            "delivery_toolkit_metadata.display_label",
        )?;

        conn.execute(
            "INSERT INTO delivery_toolkit_metadata (canonical_tag, category_name, display_label) VALUES (?1, ?2, ?3)",
            params![canonical_tag, category, display_label],
        )
        .map_err(|e| e.to_string())?;
    }

    let marker_keys: HashSet<String> = seed
        .tag_inference_markers
        .keys()
        .map(|tag| normalize_lower_snake_case(tag, "tag_inference_markers tag"))
        .collect::<Result<HashSet<_>, _>>()?;
    let unknown_marker_tags: Vec<String> = marker_keys
        .difference(&canonical_tag_set)
        .cloned()
        .collect();
    if !unknown_marker_tags.is_empty() {
        return Err(format!(
            "tag_inference_markers references unknown canonical tags: {}.",
            unknown_marker_tags.join(", ")
        ));
    }

    for canonical_tag in &canonical_tags {
        let markers = seed.tag_inference_markers.get(canonical_tag);
        let mut inserted_any = false;

        if let Some(markers) = markers {
            for marker in markers {
                match marker {
                    MarkerSeed::Literal(literal) => {
                        let Some(normalized_literal) = normalize_marker_text(literal) else {
                            continue;
                        };
                        conn.execute(
                            "INSERT INTO tag_inference_markers (id, canonical_tag, marker_kind, literal_value) VALUES (?1, ?2, 'literal', ?3)",
                            params![new_id(), canonical_tag, normalized_literal],
                        )
                        .map_err(|e| e.to_string())?;
                        inserted_any = true;
                    }
                    MarkerSeed::Compound(compound) => {
                        let all_of: Vec<String> = compound
                            .all_of
                            .iter()
                            .filter_map(|value| normalize_marker_text(value))
                            .collect();
                        let any_of: Vec<String> = compound
                            .any_of
                            .iter()
                            .filter_map(|value| normalize_marker_text(value))
                            .collect();
                        if all_of.is_empty() && any_of.is_empty() {
                            continue;
                        }

                        let marker_id = new_id();
                        conn.execute(
                            "INSERT INTO tag_inference_markers (id, canonical_tag, marker_kind, literal_value) VALUES (?1, ?2, 'compound', NULL)",
                            params![marker_id, canonical_tag],
                        )
                        .map_err(|e| e.to_string())?;

                        for (index, term) in all_of.iter().enumerate() {
                            conn.execute(
                                "INSERT INTO tag_inference_marker_terms (id, marker_id, term_group, term_value, sort_order) VALUES (?1, ?2, 'all_of', ?3, ?4)",
                                params![new_id(), marker_id, term, index as i64],
                            )
                            .map_err(|e| e.to_string())?;
                        }
                        for (index, term) in any_of.iter().enumerate() {
                            conn.execute(
                                "INSERT INTO tag_inference_marker_terms (id, marker_id, term_group, term_value, sort_order) VALUES (?1, ?2, 'any_of', ?3, ?4)",
                                params![new_id(), marker_id, term, index as i64],
                            )
                            .map_err(|e| e.to_string())?;
                        }

                        inserted_any = true;
                    }
                }
            }
        }

        if !inserted_any {
            for literal in default_tag_inference_markers(canonical_tag) {
                conn.execute(
                    "INSERT INTO tag_inference_markers (id, canonical_tag, marker_kind, literal_value) VALUES (?1, ?2, 'literal', ?3)",
                    params![new_id(), canonical_tag, literal],
                )
                .map_err(|e| e.to_string())?;
                inserted_any = true;
            }
        }

        if !inserted_any {
            return Err(format!(
                "{canonical_tag:?} must resolve to at least one marker."
            ));
        }
    }

    conn.execute(
        "INSERT INTO taxonomy_metadata (metadata_key, metadata_value) VALUES (?1, ?2)",
        params![TAXONOMY_VERSION_METADATA_KEY, version],
    )
    .map_err(|e| e.to_string())?;

    Ok(version)
}

fn seed_taxonomy_contents(conn: &Connection) -> Result<String, String> {
    let seed = parse_taxonomy_seed()?;
    seed_taxonomy_contents_from_seed(conn, &seed)
}

fn export_runtime_taxonomy_document(conn: &Connection) -> Result<TaxonomySeed, String> {
    ensure_runtime_taxonomy_seeded(conn)?;

    let version = Some(get_runtime_taxonomy_version(conn)?);
    let delivery_toolkit_categories = get_delivery_toolkit_categories(conn)?
        .into_iter()
        .map(|category| DeliveryToolkitCategorySeed {
            name: category.name,
            sort_order: category.sort_order,
        })
        .collect::<Vec<_>>();
    let canonical_tags = get_canonical_tags(conn)?;
    let all_markers = get_all_tag_inference_markers(conn)?;
    let mut tag_inference_markers = BTreeMap::new();

    for canonical_tag in &canonical_tags {
        tag_inference_markers.entry(canonical_tag.tag.clone()).or_insert_with(Vec::new);
    }

    for marker in all_markers {
        let entry = tag_inference_markers
            .entry(marker.canonical_tag.clone())
            .or_insert_with(Vec::new);
        match marker.marker_kind.as_str() {
            "literal" => {
                let literal = marker.literal_value.ok_or_else(|| {
                    format!(
                        "Literal marker {:?} for canonical tag {:?} is missing a literal value.",
                        marker.id, marker.canonical_tag
                    )
                })?;
                entry.push(MarkerSeed::Literal(literal));
            }
            "compound" => {
                let all_of = marker
                    .terms
                    .iter()
                    .filter(|term| term.term_group == "all_of")
                    .map(|term| term.term_value.clone())
                    .collect::<Vec<_>>();
                let any_of = marker
                    .terms
                    .iter()
                    .filter(|term| term.term_group == "any_of")
                    .map(|term| term.term_value.clone())
                    .collect::<Vec<_>>();
                entry.push(MarkerSeed::Compound(CompoundMarkerSeed { all_of, any_of }));
            }
            other => {
                return Err(format!(
                    "Unsupported marker kind {other:?} for canonical tag {:?}.",
                    marker.canonical_tag
                ));
            }
        }
    }

    let mut delivery_toolkit_metadata = BTreeMap::new();
    let mut canonical_tag_names = Vec::new();
    for canonical_tag in canonical_tags {
        let category = canonical_tag.category.ok_or_else(|| {
            format!("Canonical tag {:?} is missing delivery toolkit category metadata.", canonical_tag.tag)
        })?;
        let display_label = canonical_tag.display_label.ok_or_else(|| {
            format!("Canonical tag {:?} is missing display label metadata.", canonical_tag.tag)
        })?;
        canonical_tag_names.push(canonical_tag.tag.clone());
        delivery_toolkit_metadata.insert(
            canonical_tag.tag,
            DeliveryToolkitMetadataSeed {
                category,
                display_label,
            },
        );
    }

    Ok(TaxonomySeed {
        version,
        canonical_tags: canonical_tag_names,
        delivery_toolkit_categories,
        delivery_toolkit_metadata,
        tag_inference_markers,
    })
}

fn resolve_taxonomy_file_path(path: &str) -> Result<PathBuf, String> {
    let normalized_path = normalize_optional_text(Some(path))
        .ok_or_else(|| "Taxonomy path must be a non-empty string.".to_string())?;
    let requested_path = PathBuf::from(normalized_path);
    if requested_path.is_absolute() {
        Ok(requested_path)
    } else {
        Ok(env::current_dir()
            .map_err(|error| format!("Failed to resolve current directory: {error}"))?
            .join(requested_path))
    }
}

fn read_taxonomy_seed_from_file(taxonomy_path: &str) -> Result<TaxonomySeed, String> {
    let resolved_path = resolve_taxonomy_file_path(taxonomy_path)?;
    if !resolved_path.exists() {
        return Err(format!(
            "Taxonomy file not found: {}",
            resolved_path.display()
        ));
    }
    if resolved_path.is_dir() {
        return Err(format!(
            "Taxonomy path must point to a file, not a directory: {}",
            resolved_path.display()
        ));
    }

    let raw_text = fs::read_to_string(&resolved_path).map_err(|error| {
        format!("Failed to read taxonomy file {}: {error}", resolved_path.display())
    })?;
    parse_taxonomy_json_str(&raw_text)
}

fn write_taxonomy_document_to_file(document: &TaxonomySeed, output_path: &str) -> Result<String, String> {
    let resolved_path = resolve_taxonomy_file_path(output_path)?;
    if let Some(parent) = resolved_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create taxonomy export directory {}: {error}",
                parent.display()
            )
        })?;
    }

    let mut json_bytes = serde_json::to_vec_pretty(document).map_err(|error| error.to_string())?;
    json_bytes.push(b'\n');
    fs::write(&resolved_path, &json_bytes).map_err(|error| {
        format!(
            "Failed to write taxonomy export {}: {error}",
            resolved_path.display()
        )
    })?;

    let canonicalized_path = resolved_path.canonicalize().map_err(|error| {
        format!(
            "Failed to resolve taxonomy export path {}: {error}",
            resolved_path.display()
        )
    })?;

    Ok(canonicalized_path.display().to_string())
}

fn retag_evidence_and_rebuild_record_contexts(conn: &Connection) -> Result<(usize, usize), String> {
    let mut evidence_stmt = conn
        .prepare(
            "SELECT e.id, e.experience_record_id, e.claim, e.evidence_note, e.tags_json,
                    r.record_type, r.organization, r.title
             FROM evidence_items e
             JOIN experience_records r ON r.id = e.experience_record_id
             ORDER BY e.created_at ASC, e.id ASC",
        )
        .map_err(|error| error.to_string())?;
    let evidence_rows = evidence_stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, String>(7)?,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut record_tag_map: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    let mut retagged_evidence_count = 0;

    for (evidence_id, record_id, claim, evidence_note, raw_tags, record_type, organization, title) in evidence_rows {
        let context = EvidenceRecordContext {
            record_type,
            organization,
            title,
        };
        let inferred_tags = inference::infer_tags(conn, &context, &claim, evidence_note.as_deref())?;
        let existing_tags = parse_tags_json(raw_tags);
        if inferred_tags != existing_tags {
            conn.execute(
                "UPDATE evidence_items
                 SET tags_json = ?1,
                     updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
                 WHERE id = ?2",
                params![serialize_tags_json(&inferred_tags), evidence_id],
            )
            .map_err(|error| error.to_string())?;
            retagged_evidence_count += 1;
        }

        let entry = record_tag_map.entry(record_id).or_insert_with(BTreeSet::new);
        for tag in inferred_tags {
            entry.insert(tag);
        }
    }

    let mut records_stmt = conn
        .prepare("SELECT id, context_tags_json FROM experience_records ORDER BY id ASC")
        .map_err(|error| error.to_string())?;
    let records = records_stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut rebuilt_record_count = 0;
    for (record_id, raw_context_tags) in records {
        let next_tags = record_tag_map
            .remove(&record_id)
            .unwrap_or_default()
            .into_iter()
            .collect::<Vec<_>>();
        let existing_tags = parse_tags_json(raw_context_tags);
        if next_tags != existing_tags {
            conn.execute(
                "UPDATE experience_records
                 SET context_tags_json = ?1,
                     updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
                 WHERE id = ?2",
                params![serialize_tags_json(&next_tags), record_id],
            )
            .map_err(|error| error.to_string())?;
            rebuilt_record_count += 1;
        }
    }

    Ok((retagged_evidence_count, rebuilt_record_count))
}

fn query_unknown_candidate_profile_signal_tags(conn: &Connection) -> Result<Vec<String>, String> {
    let canonical_tags = query_canonical_set(conn)?;
    let mut unknown_tags = BTreeSet::new();

    let mut education_stmt = conn
        .prepare(
            "SELECT signal_tags_json
             FROM candidate_profile_education
             WHERE profile_id = 'active'",
        )
        .map_err(|error| error.to_string())?;
    let education_rows = education_stmt
        .query_map([], |row| row.get::<_, Option<String>>(0))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    for raw_json in education_rows {
        for tag in parse_tags_json(raw_json) {
            if !canonical_tags.contains(&tag) {
                unknown_tags.insert(tag);
            }
        }
    }

    let mut certification_stmt = conn
        .prepare(
            "SELECT signal_tags_json
             FROM candidate_profile_certifications
             WHERE profile_id = 'active'",
        )
        .map_err(|error| error.to_string())?;
    let certification_rows = certification_stmt
        .query_map([], |row| row.get::<_, Option<String>>(0))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    for raw_json in certification_rows {
        for tag in parse_tags_json(raw_json) {
            if !canonical_tags.contains(&tag) {
                unknown_tags.insert(tag);
            }
        }
    }

    Ok(unknown_tags.into_iter().collect())
}

fn import_taxonomy_seed_inner(
    conn: &Connection,
    seed: &TaxonomySeed,
) -> Result<TaxonomyImportResult, String> {
    clear_taxonomy_tables(conn)?;
    let imported_taxonomy_version = seed_taxonomy_contents_from_seed(conn, seed)?;
    let (retagged_evidence_count, rebuilt_record_count) = retag_evidence_and_rebuild_record_contexts(conn)?;
    let unknown_candidate_profile_signal_tags = query_unknown_candidate_profile_signal_tags(conn)?;
    mark_taxonomy_and_library_tags_in_sync(conn)?;

    Ok(TaxonomyImportResult {
        imported_taxonomy_version,
        retagged_evidence_count,
        rebuilt_record_count,
        unknown_candidate_profile_signal_tags,
    })
}

pub fn ensure_runtime_taxonomy_seeded(conn: &Connection) -> Result<(), String> {
    let existing_version = get_taxonomy_metadata_value(conn, TAXONOMY_VERSION_METADATA_KEY)?;

    if existing_version.is_some() {
        return Ok(());
    }

    with_transaction(conn, |conn| {
        clear_taxonomy_tables(conn)?;
        seed_taxonomy_contents(conn)?;
        mark_taxonomy_and_library_tags_in_sync(conn).map(|_| ())
    })
}

pub fn get_runtime_taxonomy_version(conn: &Connection) -> Result<String, String> {
    ensure_runtime_taxonomy_seeded(conn)?;
    get_taxonomy_metadata_value(conn, TAXONOMY_VERSION_METADATA_KEY)?
        .ok_or_else(|| "Failed to read taxonomy version metadata.".to_string())
}

pub fn get_library_tag_sync_status(conn: &Connection) -> Result<LibraryTagSyncStatus, String> {
    ensure_runtime_taxonomy_seeded(conn)?;

    let current_generation =
        get_taxonomy_metadata_i64(conn, TAXONOMY_CHANGE_GENERATION_METADATA_KEY)?.unwrap_or(0);
    let last_refresh_generation = get_taxonomy_metadata_i64(
        conn,
        LAST_LIBRARY_TAG_REFRESH_GENERATION_METADATA_KEY,
    )?
    .unwrap_or(0);

    Ok(LibraryTagSyncStatus {
        requires_reinference: current_generation > last_refresh_generation,
        last_taxonomy_change_at: get_taxonomy_metadata_value(
            conn,
            LAST_TAXONOMY_CHANGE_AT_METADATA_KEY,
        )?,
        last_library_tag_refresh_at: get_taxonomy_metadata_value(
            conn,
            LAST_LIBRARY_TAG_REFRESH_AT_METADATA_KEY,
        )?,
    })
}

pub fn re_infer_library_tags(conn: &Connection) -> Result<LibraryTagRefreshResult, String> {
    ensure_runtime_taxonomy_seeded(conn)?;

    with_transaction(conn, |conn| {
        let (retagged_evidence_count, rebuilt_record_count) =
            retag_evidence_and_rebuild_record_contexts(conn)?;
        mark_library_tags_refreshed(conn)?;
        build_library_tag_refresh_result(conn, retagged_evidence_count, rebuilt_record_count)
    })
}

pub fn import_taxonomy_from_file(
    conn: &Connection,
    taxonomy_path: String,
) -> Result<TaxonomyImportResult, String> {
    let seed = read_taxonomy_seed_from_file(&taxonomy_path)?;
    with_transaction(conn, |conn| import_taxonomy_seed_inner(conn, &seed))
}

pub fn export_taxonomy_to_file(conn: &Connection, output_path: String) -> Result<String, String> {
    let document = export_runtime_taxonomy_document(conn)?;
    write_taxonomy_document_to_file(&document, &output_path)
}

pub fn reset_runtime_taxonomy_to_starter(conn: &Connection) -> Result<TaxonomyImportResult, String> {
    let seed = parse_taxonomy_seed()?;
    with_transaction(conn, |conn| import_taxonomy_seed_inner(conn, &seed))
}

pub fn clear_runtime_taxonomy(conn: &Connection) -> Result<TaxonomyImportResult, String> {
    let seed = parse_taxonomy_json_str(crate::embedded_assets::EMPTY_TAXONOMY_JSON)?;
    with_transaction(conn, |conn| import_taxonomy_seed_inner(conn, &seed))
}

fn query_canonical_set(conn: &Connection) -> Result<HashSet<String>, String> {
    let mut stmt = conn
        .prepare("SELECT tag FROM canonical_tags")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<HashSet<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

pub fn canonicalize_tags(conn: &Connection, tags: &[String]) -> Result<Vec<String>, String> {
    let result = normalize_tags(conn, tags)?;
    if result.unknown.is_empty() {
        return Ok(result.normalized);
    }
    Err(format!(
        "Unknown canonical tags: {}",
        result.unknown.join(", ")
    ))
}

pub fn normalize_tags(
    conn: &Connection,
    tags: &[String],
) -> Result<TagNormalizationResult, String> {
    let canonical_set = query_canonical_set(conn)?;

    let mut normalized = Vec::new();
    let mut unknown = Vec::new();
    let mut seen_inputs = HashSet::new();
    let mut seen_canonical = HashSet::new();

    for raw_tag in tags {
        let candidate = slugify_lower_snake(raw_tag);
        if candidate.is_empty() || !seen_inputs.insert(candidate.clone()) {
            continue;
        }

        if canonical_set.contains(&candidate) {
            if seen_canonical.insert(candidate.clone()) {
                normalized.push(candidate);
            }
            continue;
        }

        unknown.push(candidate);
    }

    Ok(TagNormalizationResult {
        normalized,
        unknown,
    })
}

pub fn get_canonical_tags(conn: &Connection) -> Result<Vec<CanonicalTag>, String> {
    let mut stmt = conn
        .prepare(&format!("{CANONICAL_TAG_SELECT} ORDER BY ct.tag ASC"))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], row_to_canonical_tag)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_canonical_tag(conn: &Connection, tag: &str) -> Result<Option<CanonicalTag>, String> {
    conn.query_row(
        &format!("{CANONICAL_TAG_SELECT} WHERE ct.tag = ?1"),
        params![tag],
        row_to_canonical_tag,
    )
    .optional()
    .map_err(|e| e.to_string())
}

pub fn get_delivery_toolkit_categories(
    conn: &Connection,
) -> Result<Vec<DeliveryToolkitCategory>, String> {
    let mut stmt = conn
        .prepare("SELECT name, sort_order FROM delivery_toolkit_categories ORDER BY sort_order ASC, name ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(DeliveryToolkitCategory {
                name: row.get(0)?,
                sort_order: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn query_delivery_toolkit_category(
    conn: &Connection,
    name: &str,
) -> Result<Option<DeliveryToolkitCategory>, String> {
    conn.query_row(
        "SELECT name, sort_order FROM delivery_toolkit_categories WHERE name = ?1 LIMIT 1",
        params![name],
        |row| {
            Ok(DeliveryToolkitCategory {
                name: row.get(0)?,
                sort_order: row.get(1)?,
            })
        },
    )
    .optional()
    .map_err(|e| e.to_string())
}

fn next_delivery_toolkit_category_sort_order(conn: &Connection) -> Result<i64, String> {
    let max_sort_order = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), 0) FROM delivery_toolkit_categories",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(max_sort_order + 100)
}

fn count_tags_using_category(conn: &Connection, name: &str) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(*) FROM delivery_toolkit_metadata WHERE category_name = ?1",
        params![name],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

pub fn create_delivery_toolkit_category(
    conn: &Connection,
    name: String,
) -> Result<DeliveryToolkitCategory, String> {
    let normalized_name = normalize_required_text(Some(name.as_str()), "category")?;
    if query_delivery_toolkit_category(conn, &normalized_name)?.is_some() {
        return Err(format!("Category {normalized_name:?} already exists"));
    }

    let sort_order = next_delivery_toolkit_category_sort_order(conn)?;
    conn.execute(
        "INSERT INTO delivery_toolkit_categories (name, sort_order) VALUES (?1, ?2)",
        params![normalized_name, sort_order],
    )
    .map_err(|e| e.to_string())?;

    query_delivery_toolkit_category(conn, &normalized_name)?.ok_or_else(|| {
        format!("Delivery toolkit category {normalized_name:?} not found after create.")
    })
}

pub fn rename_delivery_toolkit_category(
    conn: &Connection,
    current_name: String,
    next_name: String,
) -> Result<DeliveryToolkitCategory, String> {
    let normalized_current_name =
        normalize_required_text(Some(current_name.as_str()), "current_category")?;
    let normalized_next_name = normalize_required_text(Some(next_name.as_str()), "category")?;

    if query_delivery_toolkit_category(conn, &normalized_current_name)?.is_none() {
        return Err(format!(
            "Delivery toolkit category {normalized_current_name:?} not found"
        ));
    }
    if normalized_current_name != normalized_next_name
        && query_delivery_toolkit_category(conn, &normalized_next_name)?.is_some()
    {
        return Err(format!("Category {normalized_next_name:?} already exists"));
    }

    conn.execute(
        "UPDATE delivery_toolkit_categories SET name = ?1 WHERE name = ?2",
        params![normalized_next_name, normalized_current_name],
    )
    .map_err(|e| e.to_string())?;

    query_delivery_toolkit_category(conn, &normalized_next_name)?.ok_or_else(|| {
        format!(
            "Delivery toolkit category {normalized_next_name:?} not found after rename."
        )
    })
}

pub fn delete_delivery_toolkit_category(conn: &Connection, name: String) -> Result<(), String> {
    let normalized_name = normalize_required_text(Some(name.as_str()), "category")?;
    if query_delivery_toolkit_category(conn, &normalized_name)?.is_none() {
        return Err(format!(
            "Delivery toolkit category {normalized_name:?} not found"
        ));
    }

    let tags_using_category = count_tags_using_category(conn, &normalized_name)?;
    if tags_using_category > 0 {
        return Err(format!(
            "Cannot delete category in use by {tags_using_category} canonical tag(s)"
        ));
    }

    conn.execute(
        "DELETE FROM delivery_toolkit_categories WHERE name = ?1",
        params![normalized_name],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn query_marker_terms(
    conn: &Connection,
    marker_id: &str,
) -> Result<Vec<TagInferenceMarkerTerm>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, term_group, term_value, sort_order
             FROM tag_inference_marker_terms
             WHERE marker_id = ?1
             ORDER BY CASE term_group WHEN 'all_of' THEN 0 ELSE 1 END, sort_order ASC, id ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![marker_id], |row| {
            Ok(TagInferenceMarkerTerm {
                id: row.get(0)?,
                term_group: row.get(1)?,
                term_value: row.get(2)?,
                sort_order: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn query_tag_inference_markers(
    conn: &Connection,
    canonical_tag: Option<&str>,
) -> Result<Vec<TagInferenceMarker>, String> {
    let query = if canonical_tag.is_some() {
        "SELECT id, canonical_tag, marker_kind, literal_value, created_at
         FROM tag_inference_markers
         WHERE canonical_tag = ?1
         ORDER BY created_at ASC, id ASC"
    } else {
        "SELECT id, canonical_tag, marker_kind, literal_value, created_at
         FROM tag_inference_markers
         ORDER BY canonical_tag ASC, created_at ASC, id ASC"
    };

    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
    let mut markers = Vec::new();

    if let Some(canonical_tag) = canonical_tag {
        let rows = stmt
            .query_map(params![canonical_tag], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (id, canonical_tag, marker_kind, literal_value, created_at) =
                row.map_err(|e| e.to_string())?;
            markers.push(TagInferenceMarker {
                terms: query_marker_terms(conn, &id)?,
                id,
                canonical_tag,
                marker_kind,
                literal_value,
                created_at,
            });
        }
    } else {
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (id, canonical_tag, marker_kind, literal_value, created_at) =
                row.map_err(|e| e.to_string())?;
            markers.push(TagInferenceMarker {
                terms: query_marker_terms(conn, &id)?,
                id,
                canonical_tag,
                marker_kind,
                literal_value,
                created_at,
            });
        }
    }

    Ok(markers)
}

fn replace_tag_inference_markers_inner(
    conn: &Connection,
    canonical_tag: &str,
    markers: &[NormalizedTagInferenceMarkerInput],
) -> Result<(), String> {
    conn.execute(
        "DELETE FROM tag_inference_markers WHERE canonical_tag = ?1",
        params![canonical_tag],
    )
    .map_err(|e| e.to_string())?;

    for marker in markers {
        let marker_id = new_id();
        conn.execute(
            "INSERT INTO tag_inference_markers (id, canonical_tag, marker_kind, literal_value) VALUES (?1, ?2, ?3, ?4)",
            params![marker_id, canonical_tag, marker.marker_kind, marker.literal_value],
        )
        .map_err(|e| e.to_string())?;

        for (index, term) in marker.all_of.iter().enumerate() {
            conn.execute(
                "INSERT INTO tag_inference_marker_terms (id, marker_id, term_group, term_value, sort_order) VALUES (?1, ?2, 'all_of', ?3, ?4)",
                params![new_id(), marker_id, term, index as i64],
            )
            .map_err(|e| e.to_string())?;
        }

        for (index, term) in marker.any_of.iter().enumerate() {
            conn.execute(
                "INSERT INTO tag_inference_marker_terms (id, marker_id, term_group, term_value, sort_order) VALUES (?1, ?2, 'any_of', ?3, ?4)",
                params![new_id(), marker_id, term, index as i64],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

fn rewrite_tag_inference_markers_to_defaults(
    conn: &Connection,
    canonical_tag: &str,
) -> Result<(), String> {
    let defaults = default_tag_inference_markers(canonical_tag)
        .into_iter()
        .map(|literal| NormalizedTagInferenceMarkerInput {
            marker_kind: "literal".to_string(),
            literal_value: Some(literal),
            all_of: Vec::new(),
            any_of: Vec::new(),
        })
        .collect::<Vec<_>>();
    replace_tag_inference_markers_inner(conn, canonical_tag, &defaults)
}

pub fn get_tag_inference_markers(
    conn: &Connection,
    canonical_tag: &str,
) -> Result<Vec<TagInferenceMarker>, String> {
    let normalized_tag = normalize_lower_snake_case(canonical_tag, "canonical_tag")?;
    if get_canonical_tag(conn, &normalized_tag)?.is_none() {
        return Err(format!("Canonical tag {normalized_tag:?} not found"));
    }
    query_tag_inference_markers(conn, Some(&normalized_tag))
}

pub fn get_all_tag_inference_markers(conn: &Connection) -> Result<Vec<TagInferenceMarker>, String> {
    query_tag_inference_markers(conn, None)
}

pub fn replace_tag_inference_markers(
    conn: &Connection,
    canonical_tag: String,
    markers: Vec<TagInferenceMarkerInput>,
) -> Result<Vec<TagInferenceMarker>, String> {
    let normalized_tag = normalize_lower_snake_case(&canonical_tag, "canonical_tag")?;
    if get_canonical_tag(conn, &normalized_tag)?.is_none() {
        return Err(format!("Canonical tag {normalized_tag:?} not found"));
    }
    let normalized_markers = normalize_tag_inference_marker_inputs(markers)?;

    with_transaction(conn, |conn| {
        replace_tag_inference_markers_inner(conn, &normalized_tag, &normalized_markers)?;
        mark_taxonomy_changed(conn).map(|_| ())
    })?;
    get_tag_inference_markers(conn, &normalized_tag)
}
fn ensure_category_exists(conn: &Connection, category: &str) -> Result<(), String> {
    if query_delivery_toolkit_category(conn, category)?.is_none() {
        return Err(format!(
            "Delivery toolkit category {category:?} does not exist."
        ));
    }
    Ok(())
}

fn rewrite_tag_array_column(
    conn: &Connection,
    table_name: &str,
    id_column: &str,
    json_column: &str,
    old_tag: &str,
    new_tag: &str,
) -> Result<(), String> {
    let query = format!("SELECT {id_column}, {json_column} FROM {table_name}");
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for (row_id, raw_json) in rows {
        let Some(raw_json) = raw_json else {
            continue;
        };
        let mut tags: Vec<String> = serde_json::from_str(&raw_json).unwrap_or_default();
        let mut changed = false;
        for tag in &mut tags {
            if tag == old_tag {
                *tag = new_tag.to_string();
                changed = true;
            }
        }
        if changed {
            let update =
                format!("UPDATE {table_name} SET {json_column} = ?1 WHERE {id_column} = ?2");
            conn.execute(
                &update,
                params![
                    serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string()),
                    row_id
                ],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

pub fn create_canonical_tag(
    conn: &Connection,
    tag: String,
    description: Option<String>,
    category: String,
    display_label: String,
) -> Result<CanonicalTag, String> {
    let normalized_tag = normalize_lower_snake_case(&tag, "canonical_tag")?;
    let normalized_description = normalize_optional_owned(description);
    let normalized_category = normalize_required_text(Some(category.as_str()), "category")?;
    let normalized_display_label =
        normalize_required_text(Some(display_label.as_str()), "display_label")?;

    ensure_category_exists(conn, &normalized_category)?;

    if get_canonical_tag(conn, &normalized_tag)?.is_some() {
        return Err(format!("Tag {normalized_tag:?} already exists"));
    }

    with_transaction(conn, |conn| {
        conn.execute(
            "INSERT INTO canonical_tags (id, tag, description) VALUES (?1, ?2, ?3)",
            params![new_id(), normalized_tag, normalized_description],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO delivery_toolkit_metadata (canonical_tag, category_name, display_label) VALUES (?1, ?2, ?3)",
            params![normalized_tag, normalized_category, normalized_display_label],
        )
        .map_err(|e| e.to_string())?;
        rewrite_tag_inference_markers_to_defaults(conn, &normalized_tag)?;
        mark_taxonomy_changed(conn).map(|_| ())
    })?;

    get_canonical_tag(conn, &normalized_tag)?
        .ok_or_else(|| format!("Canonical tag {normalized_tag:?} not found after create."))
}

pub fn update_canonical_tag(
    conn: &Connection,
    old_tag: String,
    new_tag: String,
    description: Option<String>,
    category: String,
    display_label: String,
) -> Result<CanonicalTag, String> {
    let normalized_old_tag = normalize_lower_snake_case(&old_tag, "canonical_tag")?;
    let normalized_new_tag = normalize_lower_snake_case(&new_tag, "canonical_tag")?;
    let normalized_description = normalize_optional_owned(description);
    let normalized_category = normalize_required_text(Some(category.as_str()), "category")?;
    let normalized_display_label =
        normalize_required_text(Some(display_label.as_str()), "display_label")?;

    if get_canonical_tag(conn, &normalized_old_tag)?.is_none() {
        return Err(format!("Canonical tag {normalized_old_tag:?} not found"));
    }
    if normalized_new_tag != normalized_old_tag
        && get_canonical_tag(conn, &normalized_new_tag)?.is_some()
    {
        return Err(format!("Tag {normalized_new_tag:?} already exists"));
    }
    ensure_category_exists(conn, &normalized_category)?;

    with_transaction(conn, |conn| {
        conn.execute(
            "UPDATE canonical_tags SET tag = ?1, description = ?2 WHERE tag = ?3",
            params![
                normalized_new_tag,
                normalized_description,
                normalized_old_tag
            ],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE delivery_toolkit_metadata SET category_name = ?1, display_label = ?2 WHERE canonical_tag = ?3",
            params![normalized_category, normalized_display_label, normalized_new_tag],
        )
        .map_err(|e| e.to_string())?;
        if normalized_new_tag != normalized_old_tag {
            rewrite_tag_array_column(
                conn,
                "experience_records",
                "id",
                "context_tags_json",
                &normalized_old_tag,
                &normalized_new_tag,
            )?;
            rewrite_tag_array_column(
                conn,
                "evidence_items",
                "id",
                "tags_json",
                &normalized_old_tag,
                &normalized_new_tag,
            )?;
        }
        mark_taxonomy_changed(conn).map(|_| ())
    })?;

    get_canonical_tag(conn, &normalized_new_tag)?
        .ok_or_else(|| format!("Canonical tag {normalized_new_tag:?} not found after update."))
}

pub fn delete_canonical_tag(conn: &Connection, tag: String) -> Result<(), String> {
    let normalized_tag = normalize_lower_snake_case(&tag, "canonical_tag")?;

    let records_using: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM experience_records WHERE instr(COALESCE(context_tags_json, '[]'), ?1) > 0",
            params![format!("\"{normalized_tag}\"")],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let evidence_using: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM evidence_items WHERE instr(COALESCE(tags_json, '[]'), ?1) > 0",
            params![format!("\"{normalized_tag}\"")],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if records_using > 0 || evidence_using > 0 {
        return Err(format!(
            "Cannot delete tag in use by {records_using} record(s) and {evidence_using} evidence item(s)"
        ));
    }

    conn.execute(
        "DELETE FROM canonical_tags WHERE tag = ?1",
        params![normalized_tag],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn insert_record(conn: &Connection, id: &str, organization: &str, title: &str) {
        conn.execute(
            "INSERT INTO experience_records (
                id, slug, record_type, organization, title, start_date, end_date,
                location, employment_type, context_tags_json, canonical_scope_summary,
                common_context_json, created_at, updated_at
             ) VALUES (
                ?1, ?2, 'employment', ?3, ?4, '2023-01-01', '2024-01-01',
                NULL, NULL, '[]', NULL, NULL, '2026-04-08T00:00:00Z', '2026-04-08T00:00:00Z'
             )",
            params![id, format!("{id}-slug"), organization, title],
        )
        .unwrap();
    }

    fn insert_evidence(conn: &Connection, id: &str, record_id: &str, claim: &str) {
        conn.execute(
            "INSERT INTO evidence_items (
                id, experience_record_id, claim, date_range, tags_json, scope_context_json,
                evidence_note, created_at, updated_at
             ) VALUES (?1, ?2, ?3, NULL, '[]', NULL, NULL, '2026-04-08T00:00:00Z', '2026-04-08T00:00:00Z')",
            params![id, record_id, claim],
        )
        .unwrap();
    }

    fn insert_active_candidate_profile(conn: &Connection) {
        conn.execute(
            "INSERT INTO candidate_profiles (
                id, version, config_type, display_name, location, email, phone, linkedin, github,
                created_at, updated_at
             ) VALUES (
                'active', '1.0', 'candidate_profile', 'Test User', 'Remote', NULL, NULL, NULL, NULL,
                '2026-04-08T00:00:00Z', '2026-04-08T00:00:00Z'
             )",
            [],
        )
        .unwrap();
    }

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(crate::embedded_assets::CAREER_SCHEMA_SQL)
            .unwrap();
        conn
    }

    #[test]
    fn seeds_runtime_taxonomy_and_categories() {
        let conn = setup_conn();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();

        let categories = get_delivery_toolkit_categories(&conn).unwrap();
        assert!(!categories.is_empty());

        let tags = get_canonical_tags(&conn).unwrap();
        assert!(tags
            .iter()
            .all(|tag| tag.category.is_some() && tag.display_label.is_some()));
    }

    #[test]
    fn normalizes_canonical_tags_and_collects_unknowns() {
        let conn = setup_conn();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();

        let result = normalize_tags(
            &conn,
            &[
                "ci_cd".to_string(),
                "python".to_string(),
                "unknown tag".to_string(),
            ],
        )
        .unwrap();
        assert!(result.normalized.contains(&"ci_cd".to_string()));
        assert!(result.normalized.contains(&"python".to_string()));
        assert_eq!(result.unknown, vec!["unknown_tag".to_string()]);
    }

    #[test]
    fn canonical_tag_create_materializes_default_markers() {
        let conn = setup_conn();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();

        let created = create_canonical_tag(
            &conn,
            "workflow_review".to_string(),
            None,
            "Implementation & Delivery".to_string(),
            "Workflow Review".to_string(),
        )
        .unwrap();

        let markers = get_tag_inference_markers(&conn, &created.tag).unwrap();
        assert!(!markers.is_empty());
        assert!(markers.iter().all(|marker| marker.marker_kind == "literal"));
    }

    #[test]
    fn explicit_reinference_retags_library_and_clears_stale_status() {
        let conn = setup_conn();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();
        insert_record(&conn, "record-1", "Acme", "Engineer");
        insert_evidence(&conn, "evidence-1", "record-1", "Led zebra delivery migration");

        create_canonical_tag(
            &conn,
            "zebra_delivery".to_string(),
            None,
            "Implementation & Delivery".to_string(),
            "Zebra Delivery".to_string(),
        )
        .unwrap();

        let stale_status = get_library_tag_sync_status(&conn).unwrap();
        assert!(stale_status.requires_reinference);

        let result = re_infer_library_tags(&conn).unwrap();
        assert_eq!(result.retagged_evidence_count, 1);
        assert_eq!(result.rebuilt_record_count, 1);
        assert!(result
            .unknown_candidate_profile_signal_tags
            .is_empty());

        let evidence_tags: String = conn
            .query_row(
                "SELECT tags_json FROM evidence_items WHERE id = 'evidence-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(evidence_tags.contains("zebra_delivery"));

        let record_tags: String = conn
            .query_row(
                "SELECT context_tags_json FROM experience_records WHERE id = 'record-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(record_tags.contains("zebra_delivery"));

        let clean_status = get_library_tag_sync_status(&conn).unwrap();
        assert!(!clean_status.requires_reinference);
        assert!(clean_status.last_taxonomy_change_at.is_some());
        assert!(clean_status.last_library_tag_refresh_at.is_some());
    }

    #[test]
    fn second_reinference_run_is_idempotent_without_new_taxonomy_changes() {
        let conn = setup_conn();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();
        insert_record(&conn, "record-1", "Acme", "Engineer");
        insert_evidence(&conn, "evidence-1", "record-1", "Led zebra delivery migration");

        create_canonical_tag(
            &conn,
            "zebra_delivery".to_string(),
            None,
            "Implementation & Delivery".to_string(),
            "Zebra Delivery".to_string(),
        )
        .unwrap();

        re_infer_library_tags(&conn).unwrap();
        let second_run = re_infer_library_tags(&conn).unwrap();
        assert_eq!(second_run.retagged_evidence_count, 0);
        assert_eq!(second_run.rebuilt_record_count, 0);
        assert!(!get_library_tag_sync_status(&conn)
            .unwrap()
            .requires_reinference);
    }

    #[test]
    fn taxonomy_edits_mark_library_tags_stale_until_reinference_or_reset() {
        let conn = setup_conn();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();
        assert!(!get_library_tag_sync_status(&conn)
            .unwrap()
            .requires_reinference);

        create_canonical_tag(
            &conn,
            "workflow_review".to_string(),
            None,
            "Implementation & Delivery".to_string(),
            "Workflow Review".to_string(),
        )
        .unwrap();
        assert!(get_library_tag_sync_status(&conn)
            .unwrap()
            .requires_reinference);

        re_infer_library_tags(&conn).unwrap();
        assert!(!get_library_tag_sync_status(&conn)
            .unwrap()
            .requires_reinference);

        update_canonical_tag(
            &conn,
            "workflow_review".to_string(),
            "workflow_assessment".to_string(),
            None,
            "Implementation & Delivery".to_string(),
            "Workflow Assessment".to_string(),
        )
        .unwrap();
        assert!(get_library_tag_sync_status(&conn)
            .unwrap()
            .requires_reinference);

        re_infer_library_tags(&conn).unwrap();
        replace_tag_inference_markers(
            &conn,
            "workflow_assessment".to_string(),
            vec![TagInferenceMarkerInput {
                marker_kind: "literal".to_string(),
                literal_value: Some("workflow assessment".to_string()),
                all_of: Vec::new(),
                any_of: Vec::new(),
            }],
        )
        .unwrap();
        assert!(get_library_tag_sync_status(&conn)
            .unwrap()
            .requires_reinference);

        reset_runtime_taxonomy_to_starter(&conn).unwrap();
        assert!(!get_library_tag_sync_status(&conn)
            .unwrap()
            .requires_reinference);
    }

    #[test]
    fn explicit_reinference_reports_unknown_candidate_profile_signal_tags() {
        let conn = setup_conn();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();
        insert_active_candidate_profile(&conn);
        conn.execute(
            "INSERT INTO candidate_profile_education (
                id, profile_id, sort_order, institution, credential, signal_tags_json,
                major, minor, created_at, updated_at
             ) VALUES (
                'education-1', 'active', 0, 'Test University', 'BS', '[\"unknown_custom_tag\"]',
                NULL, NULL, '2026-04-08T00:00:00Z', '2026-04-08T00:00:00Z'
             )",
            [],
        )
        .unwrap();

        let result = re_infer_library_tags(&conn).unwrap();
        assert_eq!(
            result.unknown_candidate_profile_signal_tags,
            vec!["unknown_custom_tag".to_string()]
        );
    }

    #[test]
    fn category_crud_is_user_owned_and_delete_is_blocked_while_in_use() {
        let conn = setup_conn();
        let empty_seed = parse_taxonomy_json_str(
            r#"{
  "version": "1.0",
  "canonical_tags": [],
  "delivery_toolkit_categories": [],
  "tag_inference_markers": {},
  "delivery_toolkit_metadata": {}
}"#,
        )
        .unwrap();
        import_taxonomy_seed_inner(&conn, &empty_seed).unwrap();

        let created =
            create_delivery_toolkit_category(&conn, "Field Operations".to_string()).unwrap();
        assert_eq!(created.name, "Field Operations");
        assert!(get_delivery_toolkit_categories(&conn)
            .unwrap()
            .iter()
            .any(|category| category.name == "Field Operations"));

        create_canonical_tag(
            &conn,
            "field_enablement".to_string(),
            None,
            "Field Operations".to_string(),
            "Field Enablement".to_string(),
        )
        .unwrap();

        let renamed = rename_delivery_toolkit_category(
            &conn,
            "Field Operations".to_string(),
            "Field Delivery".to_string(),
        )
        .unwrap();
        assert_eq!(renamed.name, "Field Delivery");
        assert_eq!(
            get_canonical_tag(&conn, "field_enablement")
                .unwrap()
                .unwrap()
                .category,
            Some("Field Delivery".to_string())
        );

        let delete_error = delete_delivery_toolkit_category(&conn, "Field Delivery".to_string())
            .unwrap_err();
        assert!(delete_error.contains("Cannot delete category in use"));

        delete_canonical_tag(&conn, "field_enablement".to_string()).unwrap();
        delete_delivery_toolkit_category(&conn, "Field Delivery".to_string()).unwrap();
        assert!(get_delivery_toolkit_categories(&conn)
            .unwrap()
            .iter()
            .all(|category| category.name != "Field Delivery"));
    }

    #[test]
    fn empty_taxonomy_import_keeps_categories_empty() {
        let conn = setup_conn();
        let empty_seed = parse_taxonomy_json_str(
            r#"{
  "version": "1.0",
  "canonical_tags": [],
  "delivery_toolkit_categories": [],
  "tag_inference_markers": {},
  "delivery_toolkit_metadata": {}
}"#,
        )
        .unwrap();

        let result = import_taxonomy_seed_inner(&conn, &empty_seed).unwrap();
        assert_eq!(result.imported_taxonomy_version, "1.0");
        assert!(get_canonical_tags(&conn).unwrap().is_empty());
        assert!(get_delivery_toolkit_categories(&conn).unwrap().is_empty());
        assert_eq!(get_runtime_taxonomy_version(&conn).unwrap(), "1.0");
    }

    #[test]
    fn taxonomy_export_includes_explicit_category_rows() {
        let conn = setup_conn();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();

        let exported = export_runtime_taxonomy_document(&conn).unwrap();
        assert!(!exported.delivery_toolkit_categories.is_empty());
        assert!(exported
            .delivery_toolkit_categories
            .iter()
            .all(|category| category.sort_order >= 0));
        assert!(exported.delivery_toolkit_metadata.values().all(|metadata| exported
            .delivery_toolkit_categories
            .iter()
            .any(|category| category.name == metadata.category)));
    }

    #[test]
    fn replacing_markers_requires_at_least_one_marker() {
        let conn = setup_conn();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();

        let error =
            replace_tag_inference_markers(&conn, "python".to_string(), Vec::new()).unwrap_err();
        assert!(error.contains("at least one inference marker"));
    }

    #[test]
    fn canonical_tag_update_preserves_existing_markers() {
        let conn = setup_conn();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();

        replace_tag_inference_markers(
            &conn,
            "python".to_string(),
            vec![TagInferenceMarkerInput {
                marker_kind: "literal".to_string(),
                literal_value: Some("py scripting".to_string()),
                all_of: Vec::new(),
                any_of: Vec::new(),
            }],
        )
        .unwrap();

        update_canonical_tag(
            &conn,
            "python".to_string(),
            "python_platform".to_string(),
            None,
            "Technical Skills & Programming Languages".to_string(),
            "Python Platform".to_string(),
        )
        .unwrap();

        let markers = get_tag_inference_markers(&conn, "python_platform").unwrap();
        let literals = markers
            .iter()
            .filter_map(|marker| marker.literal_value.clone())
            .collect::<Vec<_>>();
        assert!(literals.contains(&"py scripting".to_string()));
        assert!(!literals.contains(&"python platform".to_string()));

        update_canonical_tag(
            &conn,
            "python_platform".to_string(),
            "python_platform".to_string(),
            Some("Updated description".to_string()),
            "Technical Skills & Programming Languages".to_string(),
            "Python Platform".to_string(),
        )
        .unwrap();

        let markers_after_metadata_update = get_tag_inference_markers(&conn, "python_platform").unwrap();
        let literals_after_metadata_update = markers_after_metadata_update
            .iter()
            .filter_map(|marker| marker.literal_value.clone())
            .collect::<Vec<_>>();
        assert!(literals_after_metadata_update.contains(&"py scripting".to_string()));
    }

    #[test]
    fn canonical_tag_serializes_snake_case_keys() {
        let serialized = serde_json::to_value(CanonicalTag {
            id: "tag-1".to_string(),
            tag: "python".to_string(),
            description: Some("Programming language".to_string()),
            category: Some("Technical Skills & Programming Languages".to_string()),
            display_label: Some("Python".to_string()),
            created_at: "2026-04-08T00:00:00Z".to_string(),
        })
        .unwrap();

        let object = serialized.as_object().unwrap();
        assert!(object.contains_key("display_label"));
        assert!(object.contains_key("created_at"));
        assert!(!object.contains_key("displayLabel"));
        assert!(!object.contains_key("createdAt"));
    }

    #[test]
    fn delivery_toolkit_category_serializes_snake_case_keys() {
        let serialized = serde_json::to_value(DeliveryToolkitCategory {
            name: "Reporting & Analytics".to_string(),
            sort_order: 400,
        })
        .unwrap();

        let object = serialized.as_object().unwrap();
        assert!(object.contains_key("sort_order"));
        assert!(!object.contains_key("sortOrder"));
    }
}
