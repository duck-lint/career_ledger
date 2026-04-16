use crate::library_export::{
    CareerLibraryExport, CareerLibraryExportEvidenceItem, CareerLibraryExportRecord,
};
use crate::requirement_analysis::{
    normalize_semantic_tag, normalize_surface_term, RequirementAnalysis,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreflightReferentialIntegrityError(pub String);

impl std::fmt::Display for PreflightReferentialIntegrityError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.0)
    }
}

impl std::error::Error for PreflightReferentialIntegrityError {}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct PreflightCounts {
    pub records: u32,
    pub evidence: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct PreflightDecisionLogEntry {
    pub record_id: String,
    pub decision: String,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct PreflightReport {
    pub threshold: f64,
    pub fallback_min_records: u32,
    pub kept_counts: PreflightCounts,
    pub dropped_counts: PreflightCounts,
    pub decision_log: Vec<PreflightDecisionLogEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct PreflightFilterResult {
    pub career_library_export: CareerLibraryExport,
    pub preflight_report: PreflightReport,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct PreflightConfig {
    pub threshold: f64,
    pub fallback_min_records: u32,
}

pub fn run_preflight_filter(
    career_library_export: &CareerLibraryExport,
    requirement_analysis: &RequirementAnalysis,
    threshold: f64,
    fallback_min_records: u32,
) -> Result<PreflightFilterResult, PreflightReferentialIntegrityError> {
    let target_tags = extract_requirement_tags(&requirement_analysis.source.posting_keyword_bank);
    let filtered_export = apply_preflight_filter(
        career_library_export,
        &target_tags,
        threshold,
        fallback_min_records,
    )?;
    let preflight_report = build_preflight_report(
        career_library_export,
        &filtered_export,
        threshold,
        fallback_min_records,
    );

    Ok(PreflightFilterResult {
        career_library_export: filtered_export,
        preflight_report,
    })
}

pub fn extract_requirement_tags(values: &[String]) -> HashSet<String> {
    values
        .iter()
        .map(|value| normalize_surface_term(value))
        .filter(|value| !value.is_empty())
        .collect()
}

pub fn f1_tag_score(candidate_tags: &HashSet<String>, target_tags: &HashSet<String>) -> f64 {
    let overlap = candidate_tags.intersection(target_tags).count();
    if overlap == 0 || candidate_tags.is_empty() || target_tags.is_empty() {
        return 0.0;
    }
    let precision = overlap as f64 / candidate_tags.len() as f64;
    let recall = overlap as f64 / target_tags.len() as f64;
    (2.0 * precision * recall) / (precision + recall)
}

pub fn score_evidence_item(
    evidence: &CareerLibraryExportEvidenceItem,
    target_tags: &HashSet<String>,
    record_context_tags: Option<&HashSet<String>>,
) -> f64 {
    if target_tags.is_empty() {
        return 0.0;
    }

    let mut candidate_tags = normalized_tag_set(&evidence.tags);
    if candidate_tags.is_empty() {
        if let Some(context_tags) = record_context_tags {
            candidate_tags = context_tags.clone();
        }
    }
    if candidate_tags.is_empty() {
        return 0.0;
    }

    candidate_tags.intersection(target_tags).count() as f64 / candidate_tags.len() as f64
}

pub fn score_record(record: &CareerLibraryExportRecord, target_tags: &HashSet<String>) -> f64 {
    if target_tags.is_empty() {
        return 0.0;
    }

    let context_tags = normalized_tag_set(&record.context_tags);
    if record.evidence.is_empty() {
        if context_tags.is_empty() {
            return 0.0;
        }
        return context_tags.intersection(target_tags).count() as f64 / context_tags.len() as f64;
    }

    let context_score = if context_tags.is_empty() {
        0.0
    } else {
        context_tags.intersection(target_tags).count() as f64 / context_tags.len() as f64
    };

    record
        .evidence
        .iter()
        .map(|evidence| score_evidence_item(evidence, target_tags, Some(&context_tags)))
        .fold(context_score, f64::max)
}

pub fn enforce_referential_integrity(
    filtered_export: &CareerLibraryExport,
) -> Result<(), PreflightReferentialIntegrityError> {
    for (record_index, record) in filtered_export.experience_records.iter().enumerate() {
        for (evidence_index, evidence) in record.evidence.iter().enumerate() {
            if evidence.experience_record_id != record.id {
                return Err(PreflightReferentialIntegrityError(format!(
                    "experience_records[{}].evidence[{}]: evidence item {:?} references record {:?} but is nested under record {:?}.",
                    record_index + 1,
                    evidence_index + 1,
                    evidence.id,
                    evidence.experience_record_id,
                    record.id,
                )));
            }
        }
    }

    Ok(())
}

pub fn apply_preflight_filter(
    career_library_export: &CareerLibraryExport,
    target_tags: &HashSet<String>,
    threshold: f64,
    fallback_min_records: u32,
) -> Result<CareerLibraryExport, PreflightReferentialIntegrityError> {
    if target_tags.is_empty() {
        return Ok(career_library_export.clone());
    }

    let mut kept_records = Vec::new();
    let mut removed_records = Vec::new();

    for record in &career_library_export.experience_records {
        let passing_evidence = filter_evidence_in_record(record, threshold, target_tags);
        if passing_evidence.is_empty() {
            removed_records.push(record.clone());
        } else {
            let mut next_record = record.clone();
            next_record.evidence = passing_evidence;
            kept_records.push(next_record);
        }
    }

    if kept_records.len() < fallback_min_records as usize && !removed_records.is_empty() {
        let needed = fallback_min_records as usize - kept_records.len();
        removed_records.sort_by(|left, right| {
            score_record(right, target_tags)
                .total_cmp(&score_record(left, target_tags))
                .then_with(|| left.id.cmp(&right.id))
        });
        for record in removed_records.into_iter().take(needed) {
            kept_records.push(record);
        }
    }

    let filtered_export = CareerLibraryExport {
        export_type: career_library_export.export_type.clone(),
        experience_records: kept_records,
        export_meta: career_library_export.export_meta.clone(),
    };

    enforce_referential_integrity(&filtered_export)?;
    Ok(filtered_export)
}

pub fn build_preflight_report(
    original_export: &CareerLibraryExport,
    filtered_export: &CareerLibraryExport,
    threshold: f64,
    fallback_min_records: u32,
) -> PreflightReport {
    let original_counts = count_export_contents(original_export);
    let filtered_counts = count_export_contents(filtered_export);
    let filtered_record_ids = filtered_export
        .experience_records
        .iter()
        .enumerate()
        .map(|(index, record)| record_entity_id(record, index + 1))
        .collect::<HashSet<_>>();

    let mut decision_log = Vec::new();
    for (index, record) in original_export.experience_records.iter().enumerate() {
        let record_id = record_entity_id(record, index + 1);
        let kept = filtered_record_ids.contains(&record_id);
        decision_log.push(PreflightDecisionLogEntry {
            record_id,
            decision: if kept {
                "kept".to_string()
            } else {
                "dropped".to_string()
            },
            reason: if kept {
                "present_in_filtered_export".to_string()
            } else {
                "removed_by_preflight_filter".to_string()
            },
        });
    }

    PreflightReport {
        threshold,
        fallback_min_records,
        kept_counts: filtered_counts.clone(),
        dropped_counts: PreflightCounts {
            records: original_counts
                .records
                .saturating_sub(filtered_counts.records),
            evidence: original_counts
                .evidence
                .saturating_sub(filtered_counts.evidence),
        },
        decision_log,
    }
}

fn normalized_tag_set(values: &[String]) -> HashSet<String> {
    values
        .iter()
        .map(|value| normalize_semantic_tag(value))
        .filter(|value| !value.is_empty())
        .collect()
}

fn filter_evidence_in_record(
    record: &CareerLibraryExportRecord,
    threshold: f64,
    target_tags: &HashSet<String>,
) -> Vec<CareerLibraryExportEvidenceItem> {
    let context_tags = normalized_tag_set(&record.context_tags);
    record
        .evidence
        .iter()
        .filter(|evidence| {
            score_evidence_item(evidence, target_tags, Some(&context_tags)) >= threshold
        })
        .cloned()
        .collect()
}

fn count_export_contents(export: &CareerLibraryExport) -> PreflightCounts {
    PreflightCounts {
        records: export.experience_records.len() as u32,
        evidence: export
            .experience_records
            .iter()
            .map(|record| record.evidence.len() as u32)
            .sum(),
    }
}

fn record_entity_id(record: &CareerLibraryExportRecord, one_based_index: usize) -> String {
    if record.id.trim().is_empty() {
        return format!("experience_records[{}]", one_based_index);
    }
    record.id.clone()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library_export::{
        CareerLibraryExport, CareerLibraryExportEvidenceItem, CareerLibraryExportMeta,
        CareerLibraryExportRecord,
    };
    use crate::requirement_analysis::build_requirement_analysis;
    use crate::taxonomy::ensure_runtime_taxonomy_seeded;
    use rusqlite::Connection;
    use serde_json::json;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(crate::embedded_assets::CAREER_SCHEMA_SQL)
            .unwrap();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();
        conn
    }

    fn make_evidence(
        ev_id: &str,
        record_id: &str,
        tags: &[&str],
    ) -> CareerLibraryExportEvidenceItem {
        CareerLibraryExportEvidenceItem {
            id: ev_id.to_string(),
            experience_record_id: record_id.to_string(),
            claim: format!("Claim for {ev_id}."),
            date_range: None,
            tags: tags.iter().map(|tag| tag.to_string()).collect(),
            scope_context: None,
            evidence_note: None,
            created_at: "2024-01-01T00:00:00".to_string(),
            updated_at: "2024-01-01T00:00:00".to_string(),
        }
    }

    fn make_record(
        record_id: &str,
        evidence: Vec<CareerLibraryExportEvidenceItem>,
        context_tags: &[&str],
    ) -> CareerLibraryExportRecord {
        CareerLibraryExportRecord {
            id: record_id.to_string(),
            slug: record_id.replace('_', "-"),
            record_type: "employment".to_string(),
            organization: format!("Org {record_id}"),
            title: format!("Title {record_id}"),
            start_date: Some("2022-01".to_string()),
            end_date: Some("2023-01".to_string()),
            location: None,
            employment_type: None,
            context_tags: context_tags.iter().map(|tag| tag.to_string()).collect(),
            canonical_scope_summary: None,
            common_context: None,
            created_at: "2024-01-01T00:00:00".to_string(),
            updated_at: "2024-01-01T00:00:00".to_string(),
            evidence,
        }
    }

    fn make_export(records: Vec<CareerLibraryExportRecord>) -> CareerLibraryExport {
        CareerLibraryExport {
            export_type: "career_library_extract".to_string(),
            experience_records: records,
            export_meta: CareerLibraryExportMeta {
                schema_version: "1.0".to_string(),
                exported_at: "2024-01-01T00:00:00Z".to_string(),
                taxonomy_version: "1.0".to_string(),
                source_db_name: "career.db".to_string(),
            },
        }
    }

    #[test]
    fn threshold_filters_irrelevant_evidence_and_records() {
        let target_tags = extract_requirement_tags(&["python".to_string()]);
        let export = make_export(vec![
            make_record(
                "rec_keep",
                vec![
                    make_evidence("ev_keep", "rec_keep", &["python"]),
                    make_evidence("ev_drop", "rec_keep", &["cobol"]),
                ],
                &[],
            ),
            make_record(
                "rec_drop",
                vec![make_evidence("ev_irrelevant", "rec_drop", &["cobol"])],
                &[],
            ),
        ]);

        let result = apply_preflight_filter(&export, &target_tags, 0.5, 0).unwrap();

        assert_eq!(
            result
                .experience_records
                .iter()
                .map(|record| record.id.as_str())
                .collect::<Vec<_>>(),
            vec!["rec_keep"]
        );
        assert_eq!(
            result.experience_records[0]
                .evidence
                .iter()
                .map(|evidence| evidence.id.as_str())
                .collect::<Vec<_>>(),
            vec!["ev_keep"]
        );
    }

    #[test]
    fn fallback_tie_breaks_by_id_ascending() {
        let target_tags = extract_requirement_tags(&["python".to_string()]);
        let export = make_export(vec![
            make_record(
                "rec_zzz",
                vec![make_evidence("ev_zzz", "rec_zzz", &["python"])],
                &[],
            ),
            make_record(
                "rec_aaa",
                vec![make_evidence("ev_aaa", "rec_aaa", &["python"])],
                &[],
            ),
        ]);

        let result = apply_preflight_filter(&export, &target_tags, 2.0, 1).unwrap();

        assert_eq!(
            result
                .experience_records
                .iter()
                .map(|record| record.id.as_str())
                .collect::<Vec<_>>(),
            vec!["rec_aaa"]
        );
    }

    #[test]
    fn no_target_tags_returns_detached_clone() {
        let export = make_export(vec![make_record(
            "rec1",
            vec![make_evidence("ev1", "rec1", &["python"])],
            &[],
        )]);
        let result = apply_preflight_filter(&export, &HashSet::new(), 1.0, 0).unwrap();

        assert_eq!(result, export);
        assert_ne!(
            (&result as *const CareerLibraryExport),
            (&export as *const CareerLibraryExport)
        );
    }

    #[test]
    fn referential_integrity_violation_raises() {
        let export = make_export(vec![make_record(
            "rec1",
            vec![make_evidence("ev1", "wrong_rec", &["python"])],
            &[],
        )]);

        let error = enforce_referential_integrity(&export).unwrap_err();
        assert!(error.to_string().contains("references record"));
    }

    #[test]
    fn run_preflight_filter_returns_contract_shaped_report() {
        let conn = setup_conn();
        let analysis = build_requirement_analysis(&conn, "Need a Python engineer.").unwrap();
        let export = make_export(vec![
            make_record(
                "rec1",
                vec![
                    make_evidence("ev_keep", "rec1", &["python"]),
                    make_evidence("ev_drop", "rec1", &["cobol"]),
                ],
                &[],
            ),
            make_record(
                "rec2",
                vec![make_evidence("ev_irrelevant", "rec2", &["cobol"])],
                &[],
            ),
        ]);

        let result = run_preflight_filter(&export, &analysis, 0.5, 1).unwrap();

        assert_eq!(result.preflight_report.threshold, 0.5);
        assert_eq!(result.preflight_report.fallback_min_records, 1);
        assert_eq!(result.preflight_report.kept_counts.records, 1);
        assert_eq!(result.preflight_report.kept_counts.evidence, 1);
        assert_eq!(result.preflight_report.dropped_counts.records, 1);
        assert_eq!(result.preflight_report.dropped_counts.evidence, 2);
        assert_eq!(
            serde_json::to_value(&result.preflight_report).unwrap()["decision_log"][0],
            json!({
                "record_id": "rec1",
                "decision": "kept",
                "reason": "present_in_filtered_export"
            })
        );
    }
}
