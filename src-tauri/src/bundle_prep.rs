use crate::build_policy::BuildPolicy;
use crate::candidate_profile::{
    CandidateCertificationEntry, CandidateContact, CandidateEducationEntry,
    CandidateEducationFieldNotes, CandidateProfile, CandidateStaticSections,
};
use crate::library_export::CareerLibraryExport;
use crate::preflight_filter::PreflightReport;
use crate::requirement_analysis::{normalize_semantic_tag, RequirementAnalysis};
use crate::taxonomy::{get_canonical_tags, get_delivery_toolkit_categories};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};

const DELIVERY_TOOLKIT_LABEL: &str = "DELIVERY TOOLKIT";
const BUNDLE_SEMANTICS_NOTES: &[&str] = &[
    "Active bundle semantics revolve around one concept: tags.",
    "Tags come from direct experience/evidence tags plus static-source education and certification tags.",
    "Posting-matched tags are a strict subset of toolkit_tags, and posting-derived keywords can only filter or prioritize supported tags rather than add new ones.",
    "Delivery toolkit is the grouped human-facing projection of posting_matched_tags, using explicit taxonomy metadata only.",
];

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct DeliveryToolkitGroup {
    pub group_name: String,
    pub items: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct DeliveryToolkit {
    pub label: String,
    pub groups: Vec<DeliveryToolkitGroup>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct BundleTagSources {
    pub direct_evidence_tags: Vec<String>,
    pub education_tags: Vec<String>,
    pub certification_tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct BundleSemantics {
    pub notes: Vec<String>,
    pub tags: Vec<String>,
    pub tag_sources: BundleTagSources,
    pub education_tags: Vec<String>,
    pub direct_evidence_tags: Vec<String>,
    pub certification_tags: Vec<String>,
    pub static_source_tags: BTreeMap<String, Vec<String>>,
    pub toolkit_tags: Vec<String>,
    pub posting_matched_tags: Vec<String>,
    pub delivery_toolkit: DeliveryToolkit,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct BundleCandidateContact {
    pub email: Option<String>,
    pub phone: Option<String>,
    pub linkedin: Option<String>,
    pub github: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct BundleCandidateIdentity {
    pub display_name: String,
    pub location: String,
    pub contact: BundleCandidateContact,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct BundleCandidateEducationFieldNotes {
    pub major: Option<String>,
    pub minor: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct BundleCandidateEducationEntry {
    pub id: String,
    pub institution: String,
    pub credential: String,
    pub signal_tags: Vec<String>,
    pub field_notes: BundleCandidateEducationFieldNotes,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct BundleCandidateCertificationEntry {
    pub id: String,
    pub name: String,
    pub issuer: String,
    pub credential_detail: String,
    pub signal_tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct BundleCandidateStaticSections {
    pub education: Vec<BundleCandidateEducationEntry>,
    pub certifications: Vec<BundleCandidateCertificationEntry>,
    pub profile_summary_seed: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct BundleCandidateProfile {
    pub version: String,
    pub config_type: String,
    pub candidate_identity: BundleCandidateIdentity,
    pub static_sections: BundleCandidateStaticSections,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct ResumeBundleInput {
    pub build_policy: BuildPolicy,
    pub job_posting_text: String,
    pub candidate_profile: BundleCandidateProfile,
    pub career_library_export: CareerLibraryExport,
    pub bundle_semantics: BundleSemantics,
    pub requirement_analysis: RequirementAnalysis,
    pub preflight_report: PreflightReport,
}

pub fn build_bundle_semantics(
    conn: &Connection,
    candidate_profile: &CandidateProfile,
    career_library_export: &CareerLibraryExport,
    requirement_analysis: &RequirementAnalysis,
) -> Result<BundleSemantics, String> {
    let mut direct_evidence_tags = HashSet::new();
    let mut education_tags = HashSet::new();
    let mut certification_tags = HashSet::new();
    let mut static_source_tags = BTreeMap::new();

    for record in &career_library_export.experience_records {
        extend_normalized_tag_set(&mut direct_evidence_tags, &record.context_tags);
        for evidence in &record.evidence {
            extend_normalized_tag_set(&mut direct_evidence_tags, &evidence.tags);
        }
    }

    for education_item in &candidate_profile.static_sections.education {
        let canonical_tags = canonicalize_static_tags(conn, &education_item.signal_tags)?;
        education_tags.extend(canonical_tags.iter().cloned());
        if !education_item.id.trim().is_empty() && !canonical_tags.is_empty() {
            static_source_tags.insert(format!("education:{}", education_item.id), canonical_tags);
        }
    }
    for certification in &candidate_profile.static_sections.certifications {
        let canonical_tags = canonicalize_static_tags(conn, &certification.signal_tags)?;
        certification_tags.extend(canonical_tags.iter().cloned());
        if !certification.id.trim().is_empty() && !canonical_tags.is_empty() {
            static_source_tags.insert(
                format!("certification:{}", certification.id),
                canonical_tags,
            );
        }
    }

    let direct_evidence_tags = sorted_tag_set(direct_evidence_tags);
    let education_tags = sorted_tag_set(education_tags);
    let certification_tags = sorted_tag_set(certification_tags);
    let tags = merge_sorted_tag_vectors(&[
        direct_evidence_tags.clone(),
        education_tags.clone(),
        certification_tags.clone(),
    ]);
    let toolkit_tags =
        merge_sorted_tag_vectors(&[direct_evidence_tags.clone(), certification_tags.clone()]);
    let posting_matched_tags = build_posting_matched_tags(&toolkit_tags, requirement_analysis);
    let delivery_toolkit = build_delivery_toolkit(conn, &posting_matched_tags)?;

    Ok(BundleSemantics {
        notes: BUNDLE_SEMANTICS_NOTES
            .iter()
            .map(|note| note.to_string())
            .collect(),
        tags,
        tag_sources: BundleTagSources {
            direct_evidence_tags: direct_evidence_tags.clone(),
            education_tags: education_tags.clone(),
            certification_tags: certification_tags.clone(),
        },
        education_tags,
        direct_evidence_tags,
        certification_tags,
        static_source_tags,
        toolkit_tags,
        posting_matched_tags,
        delivery_toolkit,
    })
}

pub fn prepare_resume_bundle(
    conn: &Connection,
    candidate_profile: &CandidateProfile,
    career_library_export: &CareerLibraryExport,
    build_policy: &BuildPolicy,
    job_posting_text: &str,
    requirement_analysis: &RequirementAnalysis,
    preflight_report: &PreflightReport,
) -> Result<ResumeBundleInput, String> {
    validate_bundle_coherence(build_policy, preflight_report)?;
    let bundle_semantics = build_bundle_semantics(
        conn,
        candidate_profile,
        career_library_export,
        requirement_analysis,
    )?;

    Ok(ResumeBundleInput {
        build_policy: build_policy.clone(),
        job_posting_text: job_posting_text.to_string(),
        candidate_profile: BundleCandidateProfile::from(candidate_profile),
        career_library_export: career_library_export.clone(),
        bundle_semantics,
        requirement_analysis: requirement_analysis.clone(),
        preflight_report: preflight_report.clone(),
    })
}

fn build_posting_matched_tags(
    toolkit_tags: &[String],
    requirement_analysis: &RequirementAnalysis,
) -> Vec<String> {
    let toolkit_lookup = toolkit_tags.iter().cloned().collect::<HashSet<_>>();
    let mut posting_matched_tags = Vec::new();
    let mut seen = HashSet::new();

    for raw_keyword in &requirement_analysis.source.posting_keyword_bank {
        let normalized = normalize_semantic_tag(raw_keyword);
        if normalized.is_empty()
            || !toolkit_lookup.contains(&normalized)
            || !seen.insert(normalized.clone())
        {
            continue;
        }
        posting_matched_tags.push(normalized);
    }

    posting_matched_tags
}

fn build_delivery_toolkit(
    conn: &Connection,
    posting_matched_tags: &[String],
) -> Result<DeliveryToolkit, String> {
    if posting_matched_tags.is_empty() {
        return Ok(DeliveryToolkit {
            label: DELIVERY_TOOLKIT_LABEL.to_string(),
            groups: Vec::new(),
        });
    }

    let category_order = get_delivery_toolkit_categories(conn)?
        .into_iter()
        .map(|category| (category.name, category.sort_order))
        .collect::<HashMap<_, _>>();
    let metadata_by_tag = get_canonical_tags(conn)?
        .into_iter()
        .map(|tag| {
            let category = tag.category.ok_or_else(|| {
                format!(
                    "Missing delivery toolkit metadata category for posting-matched tag '{}'.",
                    tag.tag
                )
            })?;
            let display_label = tag.display_label.ok_or_else(|| {
                format!(
                    "Missing delivery toolkit metadata display label for posting-matched tag '{}'.",
                    tag.tag
                )
            })?;
            Ok((tag.tag, (category, display_label)))
        })
        .collect::<Result<HashMap<_, _>, String>>()?;

    let mut grouped = HashMap::<String, Vec<String>>::new();
    for tag in posting_matched_tags {
        let Some((category, display_label)) = metadata_by_tag.get(tag) else {
            return Err(format!(
                "Missing delivery toolkit metadata for posting-matched tag '{tag}'."
            ));
        };
        grouped
            .entry(category.clone())
            .or_default()
            .push(display_label.clone());
    }

    let mut grouped_entries = grouped.into_iter().collect::<Vec<_>>();
    grouped_entries.sort_by(|left, right| {
        let left_rank = category_order.get(&left.0).copied().unwrap_or(i64::MAX);
        let right_rank = category_order.get(&right.0).copied().unwrap_or(i64::MAX);
        left_rank
            .cmp(&right_rank)
            .then_with(|| left.0.cmp(&right.0))
    });

    let groups = grouped_entries
        .into_iter()
        .map(|(group_name, mut items)| {
            items.sort_by_key(|item| item.to_lowercase());
            items.dedup();
            DeliveryToolkitGroup { group_name, items }
        })
        .filter(|group| !group.items.is_empty())
        .collect::<Vec<_>>();

    Ok(DeliveryToolkit {
        label: DELIVERY_TOOLKIT_LABEL.to_string(),
        groups,
    })
}

fn validate_bundle_coherence(
    build_policy: &BuildPolicy,
    preflight_report: &PreflightReport,
) -> Result<(), String> {
    let effective_preflight = build_policy.effective_preflight_config();
    if (effective_preflight.threshold - preflight_report.threshold).abs() > f64::EPSILON {
        return Err(
            "Preflight report threshold does not match the loaded build policy preflight threshold."
                .to_string(),
        );
    }
    if effective_preflight.fallback_min_records != preflight_report.fallback_min_records {
        return Err(
            "Preflight report fallback_min_records does not match the loaded build policy preflight fallback_min_records."
                .to_string(),
        );
    }
    Ok(())
}

fn canonicalize_static_tags(conn: &Connection, tags: &[String]) -> Result<Vec<String>, String> {
    crate::taxonomy::canonicalize_tags(conn, tags)
}

fn extend_normalized_tag_set(target: &mut HashSet<String>, values: &[String]) {
    for value in values {
        let normalized = normalize_semantic_tag(value);
        if !normalized.is_empty() {
            target.insert(normalized);
        }
    }
}

fn sorted_tag_set(values: HashSet<String>) -> Vec<String> {
    let mut items = values.into_iter().collect::<Vec<_>>();
    items.sort();
    items
}

fn merge_sorted_tag_vectors(values: &[Vec<String>]) -> Vec<String> {
    let mut merged = values
        .iter()
        .flat_map(|items| items.iter().cloned())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    merged.sort();
    merged
}

impl From<&CandidateProfile> for BundleCandidateProfile {
    fn from(value: &CandidateProfile) -> Self {
        Self {
            version: value.version.clone(),
            config_type: value.config_type.clone(),
            candidate_identity: BundleCandidateIdentity::from(&value.candidate_identity),
            static_sections: BundleCandidateStaticSections::from(&value.static_sections),
        }
    }
}

impl From<&crate::candidate_profile::CandidateIdentity> for BundleCandidateIdentity {
    fn from(value: &crate::candidate_profile::CandidateIdentity) -> Self {
        Self {
            display_name: value.display_name.clone(),
            location: value.location.clone(),
            contact: BundleCandidateContact::from(&value.contact),
        }
    }
}

impl From<&CandidateContact> for BundleCandidateContact {
    fn from(value: &CandidateContact) -> Self {
        Self {
            email: value.email.clone(),
            phone: value.phone.clone(),
            linkedin: value.linkedin.clone(),
            github: value.github.clone(),
        }
    }
}

impl From<&CandidateStaticSections> for BundleCandidateStaticSections {
    fn from(value: &CandidateStaticSections) -> Self {
        Self {
            education: value
                .education
                .iter()
                .map(BundleCandidateEducationEntry::from)
                .collect(),
            certifications: value
                .certifications
                .iter()
                .map(BundleCandidateCertificationEntry::from)
                .collect(),
            profile_summary_seed: value.profile_summary_seed.clone(),
        }
    }
}

impl From<&CandidateEducationEntry> for BundleCandidateEducationEntry {
    fn from(value: &CandidateEducationEntry) -> Self {
        Self {
            id: value.id.clone(),
            institution: value.institution.clone(),
            credential: value.credential.clone(),
            signal_tags: value.signal_tags.clone(),
            field_notes: BundleCandidateEducationFieldNotes::from(&value.field_notes),
        }
    }
}

impl From<&CandidateEducationFieldNotes> for BundleCandidateEducationFieldNotes {
    fn from(value: &CandidateEducationFieldNotes) -> Self {
        Self {
            major: value.major.clone(),
            minor: value.minor.clone(),
        }
    }
}

impl From<&CandidateCertificationEntry> for BundleCandidateCertificationEntry {
    fn from(value: &CandidateCertificationEntry) -> Self {
        Self {
            id: value.id.clone(),
            name: value.name.clone(),
            issuer: value.issuer.clone(),
            credential_detail: value.credential_detail.clone(),
            signal_tags: value.signal_tags.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::build_policy::parse_build_policy_value;
    use crate::library_export::{
        CareerLibraryExport, CareerLibraryExportEvidenceItem, CareerLibraryExportMeta,
        CareerLibraryExportRecord,
    };
    use crate::preflight_filter::run_preflight_filter;
    use crate::requirement_analysis::build_requirement_analysis;
    use crate::taxonomy::ensure_runtime_taxonomy_seeded;
    use serde_json::json;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(crate::embedded_assets::CAREER_SCHEMA_SQL)
            .unwrap();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();
        conn
    }

    fn candidate_profile() -> CandidateProfile {
        CandidateProfile {
            version: "1.0".to_string(),
            config_type: "candidate_profile".to_string(),
            candidate_identity: crate::candidate_profile::CandidateIdentity {
                display_name: "Test User".to_string(),
                location: "Remote".to_string(),
                contact: CandidateContact::default(),
            },
            static_sections: CandidateStaticSections {
                education: vec![CandidateEducationEntry {
                    id: "edu-1".to_string(),
                    institution: "Test University".to_string(),
                    credential: "BBA".to_string(),
                    signal_tags: vec!["degree".to_string(), "bachelor".to_string()],
                    field_notes: CandidateEducationFieldNotes::default(),
                }],
                certifications: vec![CandidateCertificationEntry {
                    id: "cert-1".to_string(),
                    name: "Testing Cert".to_string(),
                    issuer: "Cert Org".to_string(),
                    credential_detail: "Level 1".to_string(),
                    signal_tags: vec!["testing".to_string()],
                }],
                profile_summary_seed: Vec::new(),
            },
        }
    }

    fn export(records: Vec<CareerLibraryExportRecord>) -> CareerLibraryExport {
        CareerLibraryExport {
            export_type: "career_library_extract".to_string(),
            experience_records: records,
            export_meta: CareerLibraryExportMeta {
                schema_version: "2.0".to_string(),
                exported_at: "2024-01-01T00:00:00Z".to_string(),
                taxonomy_version: "1.0".to_string(),
                source_db_name: "career.db".to_string(),
            },
        }
    }

    fn record(record_id: &str, tags: &[&str]) -> CareerLibraryExportRecord {
        CareerLibraryExportRecord {
            id: record_id.to_string(),
            slug: format!("slug-{record_id}"),
            record_type: "employment".to_string(),
            organization: "Acme Corp".to_string(),
            title: "Software Engineer".to_string(),
            start_date: Some("2020-01".to_string()),
            end_date: Some("2023-01".to_string()),
            location: Some("Remote".to_string()),
            employment_type: None,
            context_tags: tags.iter().map(|tag| tag.to_string()).collect(),
            canonical_scope_summary: None,
            common_context: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            evidence: vec![CareerLibraryExportEvidenceItem {
                id: format!("ev-{record_id}"),
                experience_record_id: record_id.to_string(),
                claim: "Relevant achievement.".to_string(),
                date_range: None,
                tags: tags.iter().map(|tag| tag.to_string()).collect(),
                scope_context: None,
                evidence_note: None,
                created_at: "2024-01-01T00:00:00Z".to_string(),
                updated_at: "2024-01-01T00:00:00Z".to_string(),
            }],
        }
    }

    #[test]
    fn bundle_semantics_groups_posting_matched_tags() {
        let conn = setup_conn();
        let profile = candidate_profile();
        let analysis = build_requirement_analysis(&conn, "Looking for a Python engineer.").unwrap();
        let semantics = build_bundle_semantics(
            &conn,
            &profile,
            &export(vec![record("rec-1", &["python"])]),
            &analysis,
        )
        .unwrap();

        assert_eq!(semantics.posting_matched_tags, vec!["python"]);
        assert_eq!(
            semantics.delivery_toolkit,
            DeliveryToolkit {
                label: "DELIVERY TOOLKIT".to_string(),
                groups: vec![DeliveryToolkitGroup {
                    group_name: "Technical Skills & Programming Languages".to_string(),
                    items: vec!["Python".to_string()],
                }],
            }
        );
        assert!(semantics.education_tags.contains(&"bachelor".to_string()));
        assert!(semantics.static_source_tags.contains_key("education:edu-1"));
    }

    #[test]
    fn prepare_resume_bundle_recomputes_semantics_from_filtered_export() {
        let conn = setup_conn();
        let profile = candidate_profile();
        let library_export = export(vec![
            record("rec-python", &["python"]),
            record("rec-cobol", &["cobol"]),
        ]);
        let analysis = build_requirement_analysis(&conn, "Need a Python engineer.").unwrap();
        let preflight_result = run_preflight_filter(&library_export, &analysis, 0.5, 1).unwrap();
        let build_policy = parse_build_policy_value(&json!({
            "policy_type": "resume_build_policy",
            "include_projects": true,
            "max_bullets_per_role": 5,
            "max_project_bullets": 4,
            "max_projects": 4,
            "preflight": {
                "threshold": 0.5,
                "fallback_min_records": 1
            },
            "assembler_strategy": {
                "max_highlights": 4,
                "bullet_max_chars": 280,
                "highlight_max_chars": 280,
                "profile_max_chars": 420,
                "allow_multi_evidence_sections": ["highlights", "profile"],
                "tag_weight": 0.875,
                "density_weight": 0.125
            }
        }))
        .unwrap();

        let bundle = prepare_resume_bundle(
            &conn,
            &profile,
            &preflight_result.career_library_export,
            &build_policy,
            "Need a Python engineer.",
            &analysis,
            &preflight_result.preflight_report,
        )
        .unwrap();

        assert_eq!(
            bundle
                .career_library_export
                .experience_records
                .iter()
                .map(|record| record.id.as_str())
                .collect::<Vec<_>>(),
            vec!["rec-python"]
        );
        assert!(bundle
            .bundle_semantics
            .tag_sources
            .direct_evidence_tags
            .contains(&"python".to_string()));
        assert!(!bundle
            .bundle_semantics
            .tag_sources
            .direct_evidence_tags
            .contains(&"cobol".to_string()));
    }
}
