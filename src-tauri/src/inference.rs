use crate::taxonomy::{self, TagInferenceMarker};
use crate::validation::normalize_optional_text;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Default)]
pub struct TagInferenceInput<'a> {
    pub claim: Option<&'a str>,
    pub evidence_note: Option<&'a str>,
    pub source_area: Option<&'a str>,
    pub organization: Option<&'a str>,
    pub title: Option<&'a str>,
    pub record_type: Option<&'a str>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceRecordContext {
    pub record_type: String,
    pub organization: String,
    pub title: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceValueSource {
    Manual,
    Inferred,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceSaveDecision {
    pub tags_source: Option<EvidenceValueSource>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceInferenceComparison {
    pub manual_tags: Vec<String>,
    pub inferred_tags: Vec<String>,
    pub unknown_manual_tags: Vec<String>,
    pub tags_match: bool,
}

fn normalize_text(value: &str) -> String {
    normalize_optional_text(Some(value)).unwrap_or_default()
}

fn build_inference_text(input: &TagInferenceInput<'_>) -> String {
    [
        input.claim.map(normalize_text).unwrap_or_default(),
        input.evidence_note.map(normalize_text).unwrap_or_default(),
        input.source_area.map(normalize_text).unwrap_or_default(),
        input.organization.map(normalize_text).unwrap_or_default(),
        input.title.map(normalize_text).unwrap_or_default(),
        input.record_type.map(normalize_text).unwrap_or_default(),
    ]
    .into_iter()
    .filter(|part| !part.is_empty())
    .collect::<Vec<_>>()
    .join(" ")
    .to_lowercase()
}

fn is_boundary_char(ch: char, phrase_marker: bool) -> bool {
    ch.is_alphanumeric() || ch == '_' || (phrase_marker && ch == '-')
}

pub(crate) fn marker_matches_text(marker: &str, text: &str) -> bool {
    let normalized_marker = normalize_text(marker).to_lowercase();
    if normalized_marker.is_empty() {
        return false;
    }

    let phrase_marker = normalized_marker.contains(' ');
    for (index, _) in text.match_indices(&normalized_marker) {
        let before = text[..index].chars().next_back();
        let after = text[index + normalized_marker.len()..].chars().next();
        let before_ok = before
            .map(|ch| !is_boundary_char(ch, phrase_marker))
            .unwrap_or(true);
        let after_ok = after
            .map(|ch| !is_boundary_char(ch, phrase_marker))
            .unwrap_or(true);
        if before_ok && after_ok {
            return true;
        }
    }

    false
}

pub(crate) fn compound_marker_matches(marker: &TagInferenceMarker, text: &str) -> bool {
    let all_of = marker
        .terms
        .iter()
        .filter(|term| term.term_group == "all_of")
        .map(|term| term.term_value.as_str())
        .collect::<Vec<_>>();
    let any_of = marker
        .terms
        .iter()
        .filter(|term| term.term_group == "any_of")
        .map(|term| term.term_value.as_str())
        .collect::<Vec<_>>();

    if all_of.is_empty() && any_of.is_empty() {
        return false;
    }
    if !all_of.is_empty() && !all_of.iter().all(|term| marker_matches_text(term, text)) {
        return false;
    }
    if !any_of.is_empty() && !any_of.iter().any(|term| marker_matches_text(term, text)) {
        return false;
    }

    true
}

pub(crate) fn tag_marker_matches(marker: &TagInferenceMarker, text: &str) -> bool {
    match marker.marker_kind.as_str() {
        "literal" => marker
            .literal_value
            .as_deref()
            .map(|literal| marker_matches_text(literal, text))
            .unwrap_or(false),
        "compound" => compound_marker_matches(marker, text),
        _ => false,
    }
}

fn group_markers_by_tag(
    markers: Vec<TagInferenceMarker>,
) -> HashMap<String, Vec<TagInferenceMarker>> {
    let mut grouped = HashMap::new();
    for marker in markers {
        grouped
            .entry(marker.canonical_tag.clone())
            .or_insert_with(Vec::new)
            .push(marker);
    }
    grouped
}

pub fn infer_tags(
    conn: &Connection,
    context: &EvidenceRecordContext,
    claim: &str,
    evidence_note: Option<&str>,
) -> Result<Vec<String>, String> {
    infer_tags_for_input(
        conn,
        &TagInferenceInput {
            claim: Some(claim),
            evidence_note,
            source_area: None,
            organization: Some(&context.organization),
            title: Some(&context.title),
            record_type: Some(&context.record_type),
        },
    )
}

pub fn infer_tags_for_input(
    conn: &Connection,
    input: &TagInferenceInput<'_>,
) -> Result<Vec<String>, String> {
    let inference_text = build_inference_text(input);
    if inference_text.is_empty() {
        return Ok(Vec::new());
    }

    let grouped = group_markers_by_tag(taxonomy::get_all_tag_inference_markers(conn)?);
    let mut raw_tags = Vec::new();

    for (canonical_tag, markers) in grouped {
        if markers
            .iter()
            .any(|marker| tag_marker_matches(marker, &inference_text))
        {
            raw_tags.push(canonical_tag);
        }
    }

    if raw_tags.is_empty() {
        return Ok(Vec::new());
    }

    taxonomy::canonicalize_tags(conn, &raw_tags)
}

pub fn compare_evidence_inference(
    conn: &Connection,
    context: &EvidenceRecordContext,
    claim: &str,
    evidence_note: Option<&str>,
    manual_tags: Vec<String>,
    unknown_manual_tags: Vec<String>,
) -> Result<EvidenceInferenceComparison, String> {
    let inferred_tags = infer_tags(conn, context, claim, evidence_note)?;
    let tags_match = unknown_manual_tags.is_empty() && manual_tags == inferred_tags;

    Ok(EvidenceInferenceComparison {
        manual_tags,
        inferred_tags,
        unknown_manual_tags,
        tags_match,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::taxonomy::{
        ensure_runtime_taxonomy_seeded, replace_tag_inference_markers, TagInferenceMarkerInput,
    };

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(crate::embedded_assets::CAREER_SCHEMA_SQL)
            .unwrap();
        conn
    }

    fn record_context() -> EvidenceRecordContext {
        EvidenceRecordContext {
            record_type: "employment".to_string(),
            organization: "Example Operations Company".to_string(),
            title: "HR Operations Coordinator".to_string(),
        }
    }

    #[test]
    fn literal_marker_matching_respects_phrase_boundaries() {
        assert!(marker_matches_text("ahk", "project-ahk-pp"));
        assert!(!marker_matches_text(
            "type inference",
            "fact-type inference"
        ));
    }

    #[test]
    fn infers_tags_from_literal_and_compound_markers() {
        let conn = setup_conn();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();
        replace_tag_inference_markers(
            &conn,
            "python".to_string(),
            vec![
                TagInferenceMarkerInput {
                    marker_kind: "literal".to_string(),
                    literal_value: Some("py scripting".to_string()),
                    all_of: Vec::new(),
                    any_of: Vec::new(),
                },
                TagInferenceMarkerInput {
                    marker_kind: "compound".to_string(),
                    literal_value: None,
                    all_of: vec!["continuous".to_string(), "integration".to_string()],
                    any_of: Vec::new(),
                },
            ],
        )
        .unwrap();
        let inferred = infer_tags(
            &conn,
            &record_context(),
            "Built py scripting helpers for release workflows",
            Some("continuous integration handoff"),
        )
        .unwrap();
        assert!(inferred.contains(&"python".to_string()));
    }

    #[test]
    fn infers_tags_from_source_area_in_generic_input() {
        let conn = setup_conn();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();

        let inferred = infer_tags_for_input(
            &conn,
            &TagInferenceInput {
                claim: Some("Supported rollout readiness and learner support"),
                evidence_note: None,
                source_area: Some("workday hris"),
                organization: Some("Example Org"),
                title: Some("Analyst"),
                record_type: Some("employment"),
            },
        )
        .unwrap();

        assert!(inferred.contains(&"workday".to_string()));
    }
}
