use crate::build_policy::AssemblerStrategy;
use crate::bundle_prep::{
    BundleCandidateCertificationEntry, BundleCandidateEducationEntry, BundleCandidateProfile,
    DeliveryToolkitGroup, ResumeBundleInput,
};
use crate::library_export::{CareerLibraryExportEvidenceItem, CareerLibraryExportRecord};
use crate::preflight_filter::f1_tag_score;
use crate::requirement_analysis::{
    extract_surface_terms, normalize_semantic_tag, normalize_whitespace, RequirementAnalysis,
    RequirementAtom, GENERIC_SURFACE_TERMS,
};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::{BTreeSet, HashMap, HashSet};

#[cfg(test)]
use crate::build_policy::BuildPolicy;

const OPEN_ENDED_MARKERS: &[&str] = &["", "present", "current", "ongoing", "now"];
const GENERIC_REQUIREMENT_TAGS: &[&str] = &[
    "analysis",
    "automation",
    "data",
    "documentation",
    "process",
    "project_management",
    "reporting",
    "requirements",
    "support",
    "testing",
    "training",
];
const PARTIAL_SUPPORT_LIMITATION: &str =
    "Selected evidence overlaps only general matched tags; support remains partial.";
const UNSUPPORTED_REASON: &str = "No selected source overlaps the requirement terms or tags.";
const INCOMPLETE_RISK_FLAG: &str =
    "Requirement analysis produced no requirement atoms; gap report may be incomplete.";
const PROFILE_MISSING_NOTE: &str = "Profile was omitted because no profile_summary_seed line could be used without violating normalization-only claim projection.";
const TOOLKIT_ONLY_NOTE: &str = "Delivery toolkit is the only rendered tag surface in the assembled artifact; posting_matched_tags stay bundle-internal only.";
const NORMALIZATION_ONLY_NOTE: &str = "Highlights and profile never paraphrase evidence claims; same-record corroboration does not change rendered wording.";
const GAP_REPORT_NOTE: &str = "Gap-report support is limited to selected evidence plus static education and certification sources whose raw terms or tags overlap posting-derived requirement analysis.";

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct MultiEvidenceClaim {
    pub text: String,
    pub evidence_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct SingleEvidenceClaim {
    pub text: String,
    pub evidence_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ResumeHeader {
    pub display_name: String,
    pub location: String,
    pub email: String,
    pub phone: String,
    pub linkedin: String,
    pub github: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ProfileSection {
    pub text: String,
    pub evidence_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ExperienceEntry {
    pub record_id: String,
    pub organization: String,
    pub title: String,
    pub date_range: String,
    pub location: Option<String>,
    pub bullets: Vec<SingleEvidenceClaim>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ProjectEntry {
    pub record_id: String,
    pub organization: String,
    pub title: String,
    pub date_range: String,
    pub bullets: Vec<SingleEvidenceClaim>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct TextSourceItem {
    pub text: String,
    pub source_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ToolkitSection {
    pub label: String,
    pub groups: Vec<DeliveryToolkitGroup>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct StructuredResume {
    pub header: ResumeHeader,
    pub target_role_family: String,
    pub highlights: Vec<MultiEvidenceClaim>,
    pub profile: Option<ProfileSection>,
    pub professional_experience: Vec<ExperienceEntry>,
    pub projects: Vec<ProjectEntry>,
    pub education: Vec<TextSourceItem>,
    pub certifications: Vec<TextSourceItem>,
    pub toolkit: Option<ToolkitSection>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Hash)]
pub struct SupportingSource {
    pub source_type: String,
    pub source_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct SupportedRequirement {
    pub requirement: String,
    pub supporting_sources: Vec<SupportingSource>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct PartiallySupportedRequirement {
    pub requirement: String,
    pub supporting_sources: Vec<SupportingSource>,
    pub limitation: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct UnsupportedRequirement {
    pub requirement: String,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct GapReport {
    pub supported_requirements: Vec<SupportedRequirement>,
    pub partially_supported_requirements: Vec<PartiallySupportedRequirement>,
    pub unsupported_requirements: Vec<UnsupportedRequirement>,
    pub compensation_strategy: Vec<String>,
    pub risk_flags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ClaimToEvidenceMapEntry {
    pub claim_path: String,
    pub evidence_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ConstraintFlag {
    pub rule: String,
    pub status: String,
    pub note: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct Provenance {
    pub target_role_family: String,
    pub selected_record_ids: Vec<String>,
    pub selected_evidence_ids: Vec<String>,
    pub claim_to_evidence_map: Vec<ClaimToEvidenceMapEntry>,
    pub constraint_flags: Vec<ConstraintFlag>,
    pub notes: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct AssembledResumeArtifact {
    pub resume: StructuredResume,
    pub gap_report: GapReport,
    pub provenance: Provenance,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ResumeAssemblyResult {
    pub artifact: AssembledResumeArtifact,
    pub selected_record_ids: Vec<String>,
    pub selected_evidence_ids: Vec<String>,
    pub claim_to_evidence_map: Vec<ClaimToEvidenceMapEntry>,
    pub constraint_flags: Vec<ConstraintFlag>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone)]
struct SelectionContext {
    target_role_family: String,
    target_tags: HashSet<String>,
    requirement_priority_tags: Vec<String>,
    profile_summary_seed: Vec<String>,
    toolkit_groups: Vec<DeliveryToolkitGroup>,
    toolkit_label: String,
    candidate_profile: BundleCandidateProfile,
}

#[derive(Debug, Clone)]
struct RequirementContext {
    target_role_family: String,
    posting_keyword_bank: Vec<String>,
    atoms: Vec<RequirementAtom>,
}

#[derive(Debug, Clone)]
struct RankedEvidence {
    evidence_id: String,
    claim: String,
    tag_score: f64,
    density_score: f64,
    total_score: f64,
    requirement_pressure: f64,
}

#[derive(Debug, Clone)]
struct RankedRecord {
    record_id: String,
    best_score: f64,
    density_score: f64,
    requirement_pressure: f64,
    record_type: String,
    recency: RecordRecency,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct RecordRecency {
    is_open_ended: bool,
    end_ordinal: i32,
    start_ordinal: i32,
}

#[derive(Debug, Clone)]
struct RequirementSourceSupport {
    tags: HashSet<String>,
    terms: HashSet<String>,
}

pub fn assemble_resume(bundle: &ResumeBundleInput) -> Result<ResumeAssemblyResult, String> {
    let strategy = &bundle.build_policy.assembler_strategy;
    let context = build_selection_context(bundle)?;

    let professional_experience = build_professional_experience(bundle, &context, strategy);
    let projects = build_projects(bundle, &context, strategy);
    let suppressed_texts = claim_text_set_from_entries(&professional_experience, &projects);
    let highlights = build_highlights(bundle, &context, strategy, Some(&suppressed_texts));
    let profile = build_profile(bundle, &context, strategy);
    let toolkit = build_toolkit(&context);

    let resume = StructuredResume {
        header: build_header(&context.candidate_profile)?,
        target_role_family: context.target_role_family.clone(),
        highlights,
        profile,
        professional_experience,
        projects,
        education: build_education(&context.candidate_profile),
        certifications: build_certifications(&context.candidate_profile),
        toolkit,
    };

    let claim_to_evidence_map = build_claim_to_evidence_map(&resume);
    let selected_evidence_ids = selected_evidence_ids_from_claim_map(&claim_to_evidence_map);
    let evidence_to_record = evidence_to_record_map(bundle);
    let selected_record_ids = selected_evidence_ids
        .iter()
        .filter_map(|evidence_id| evidence_to_record.get(evidence_id).cloned())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();

    let gap_report = build_gap_report(bundle, &selected_evidence_ids, &context);
    let constraint_flags = build_constraint_flags(bundle, strategy, &resume);
    let notes = build_notes(strategy, &resume);
    let provenance = Provenance {
        target_role_family: context.target_role_family.clone(),
        selected_record_ids: selected_record_ids.clone(),
        selected_evidence_ids: selected_evidence_ids.iter().cloned().collect(),
        claim_to_evidence_map: claim_to_evidence_map.clone(),
        constraint_flags: constraint_flags.clone(),
        notes: notes.clone(),
    };
    let artifact = AssembledResumeArtifact {
        resume,
        gap_report,
        provenance,
    };

    validate_assembled_artifact(&artifact)?;

    Ok(ResumeAssemblyResult {
        artifact,
        selected_record_ids,
        selected_evidence_ids: selected_evidence_ids.into_iter().collect(),
        claim_to_evidence_map,
        constraint_flags,
        notes,
    })
}

fn build_selection_context(bundle: &ResumeBundleInput) -> Result<SelectionContext, String> {
    let requirement_context = build_requirement_context(&bundle.requirement_analysis)?;
    let target_role_family = requirement_context.target_role_family.clone();
    if target_role_family.is_empty() {
        return Err(
            "requirement_analysis.source.target_role_family must be a non-empty string."
                .to_string(),
        );
    }

    Ok(SelectionContext {
        target_role_family,
        target_tags: requirement_context
            .posting_keyword_bank
            .iter()
            .cloned()
            .collect(),
        requirement_priority_tags: requirement_priority_tags(&requirement_context),
        profile_summary_seed: bundle
            .candidate_profile
            .static_sections
            .profile_summary_seed
            .clone(),
        toolkit_groups: bundle.bundle_semantics.delivery_toolkit.groups.clone(),
        toolkit_label: if bundle
            .bundle_semantics
            .delivery_toolkit
            .label
            .trim()
            .is_empty()
        {
            "DELIVERY TOOLKIT".to_string()
        } else {
            bundle.bundle_semantics.delivery_toolkit.label.clone()
        },
        candidate_profile: bundle.candidate_profile.clone(),
    })
}

fn build_requirement_context(
    requirement_analysis: &RequirementAnalysis,
) -> Result<RequirementContext, String> {
    let mut atoms = requirement_analysis.atoms.clone();
    atoms.sort_by(|left, right| {
        left.source_order
            .cmp(&right.source_order)
            .then_with(|| left.requirement_id.cmp(&right.requirement_id))
    });

    Ok(RequirementContext {
        target_role_family: requirement_analysis.source.target_role_family.clone(),
        posting_keyword_bank: requirement_analysis.source.posting_keyword_bank.clone(),
        atoms,
    })
}

fn build_highlights(
    bundle: &ResumeBundleInput,
    context: &SelectionContext,
    strategy: &AssemblerStrategy,
    suppressed_texts: Option<&HashSet<String>>,
) -> Vec<MultiEvidenceClaim> {
    if strategy.max_highlights == 0 {
        return Vec::new();
    }

    let suppressed = suppressed_texts.cloned().unwrap_or_default();
    let requirement_context = if strategy.coverage_first_highlights_enabled() {
        try_build_requirement_context(&bundle.requirement_analysis)
    } else {
        None
    };
    let requirement_atoms = requirement_context
        .map(|context| context.atoms)
        .unwrap_or_default();
    let mut uncovered_atom_ids = ordered_requirement_atoms(&requirement_atoms)
        .into_iter()
        .map(|atom| atom.requirement_id)
        .collect::<HashSet<_>>();
    let mut highlights = Vec::new();
    let mut seen_texts = HashSet::new();

    for (record, ranked_evidence) in iter_ranked_records_with_evidence(bundle, context, strategy) {
        let ranked_candidates = ranked_evidence
            .iter()
            .filter(|item| item.tag_score > 0.0)
            .map(|item| {
                (
                    item.clone(),
                    truncate_text(&item.claim, strategy.highlight_max_chars),
                )
            })
            .collect::<Vec<_>>();
        let (ordered_atoms, support_maps) =
            record_requirement_support_maps(&record, &requirement_atoms);
        let mut selected_evidence_ids = HashSet::new();

        while !uncovered_atom_ids.is_empty() && highlights.len() < strategy.max_highlights as usize
        {
            let excluded_texts = suppressed
                .union(&seen_texts)
                .cloned()
                .collect::<HashSet<_>>();
            let Some((primary, text, covered_atom_ids)) = best_coverage_candidate(
                &ranked_candidates,
                &ordered_atoms,
                &support_maps,
                &uncovered_atom_ids,
                &excluded_texts,
                &selected_evidence_ids,
            ) else {
                break;
            };

            highlights.push(MultiEvidenceClaim {
                text: text.clone(),
                evidence_ids: evidence_ids_for_claim(
                    &ranked_evidence,
                    &primary,
                    strategy,
                    "highlights",
                ),
            });
            seen_texts.insert(text);
            selected_evidence_ids.insert(primary.evidence_id.clone());
            uncovered_atom_ids.retain(|id| !covered_atom_ids.contains(id));
        }

        for (primary, text) in ranked_candidates {
            if highlights.len() >= strategy.max_highlights as usize {
                return highlights;
            }
            if text.is_empty()
                || suppressed.contains(&text)
                || seen_texts.contains(&text)
                || selected_evidence_ids.contains(&primary.evidence_id)
            {
                continue;
            }
            highlights.push(MultiEvidenceClaim {
                text: text.clone(),
                evidence_ids: evidence_ids_for_claim(
                    &ranked_evidence,
                    &primary,
                    strategy,
                    "highlights",
                ),
            });
            seen_texts.insert(text);
            selected_evidence_ids.insert(primary.evidence_id);
        }
    }

    highlights
}

fn build_profile(
    bundle: &ResumeBundleInput,
    context: &SelectionContext,
    strategy: &AssemblerStrategy,
) -> Option<ProfileSection> {
    if strategy.profile_max_chars == 0 {
        return None;
    }

    let normalized_seeds = context
        .profile_summary_seed
        .iter()
        .map(|seed| truncate_text(seed, strategy.profile_max_chars))
        .filter(|seed| !seed.is_empty())
        .collect::<Vec<_>>();
    if normalized_seeds.is_empty() {
        return None;
    }

    let requirement_context = if strategy.coverage_first_profile_tiebreak_enabled() {
        try_build_requirement_context(&bundle.requirement_analysis)
    } else {
        None
    };
    let ordered_atoms = requirement_context
        .as_ref()
        .map(|context| ordered_requirement_atoms(&context.atoms))
        .unwrap_or_default();
    let uncovered_atom_ids = ordered_atoms
        .iter()
        .map(|atom| atom.requirement_id.clone())
        .collect::<HashSet<_>>();

    for seed_text in normalized_seeds {
        let mut matching_candidates = Vec::new();
        for (record, ranked_evidence) in
            iter_ranked_records_with_evidence(bundle, context, strategy)
        {
            for primary in &ranked_evidence {
                if primary.tag_score <= 0.0 {
                    continue;
                }
                if truncate_text(&primary.claim, strategy.profile_max_chars) != seed_text {
                    continue;
                }
                if !strategy.coverage_first_profile_tiebreak_enabled() {
                    return Some(ProfileSection {
                        text: seed_text,
                        evidence_ids: evidence_ids_for_claim(
                            &ranked_evidence,
                            primary,
                            strategy,
                            "profile",
                        ),
                    });
                }
                matching_candidates.push((
                    record.clone(),
                    ranked_evidence.clone(),
                    primary.clone(),
                ));
            }
        }

        if matching_candidates.is_empty() {
            continue;
        }

        let mut selected = matching_candidates[0].clone();
        let mut best_signature: Option<Vec<i32>> = None;

        if !ordered_atoms.is_empty() {
            let mut support_maps_by_record =
                HashMap::<String, HashMap<String, HashMap<String, i32>>>::new();
            for (record, ranked_evidence, primary) in &matching_candidates {
                let record_id = record.id.clone();
                let support_maps = support_maps_by_record
                    .entry(record_id)
                    .or_insert_with(|| record_requirement_support_maps(record, &ordered_atoms).1);
                let support_map = support_maps
                    .get(&primary.evidence_id)
                    .cloned()
                    .unwrap_or_default();
                let coverage_signature = coverage_signature_for_uncovered_atoms(
                    &ordered_atoms,
                    &support_map,
                    &uncovered_atom_ids,
                );
                if coverage_signature.iter().copied().max().unwrap_or(0) <= 0 {
                    continue;
                }
                if best_signature
                    .as_ref()
                    .map(|best| coverage_signature > *best)
                    .unwrap_or(true)
                {
                    selected = (record.clone(), ranked_evidence.clone(), primary.clone());
                    best_signature = Some(coverage_signature);
                }
            }
        }

        return Some(ProfileSection {
            text: seed_text,
            evidence_ids: evidence_ids_for_claim(&selected.1, &selected.2, strategy, "profile"),
        });
    }

    None
}

fn build_professional_experience(
    bundle: &ResumeBundleInput,
    context: &SelectionContext,
    strategy: &AssemblerStrategy,
) -> Vec<ExperienceEntry> {
    if bundle.build_policy.max_bullets_per_role == 0 {
        return Vec::new();
    }
    let requirement_atoms = try_build_requirement_context(&bundle.requirement_analysis)
        .map(|context| context.atoms)
        .unwrap_or_default();

    build_record_section(
        bundle,
        context,
        strategy,
        &rank_employment_records(bundle, context, strategy),
        bundle.build_policy.max_bullets_per_role,
        true,
        &requirement_atoms,
        None,
    )
    .into_iter()
    .map(|entry| ExperienceEntry {
        record_id: entry.record_id,
        organization: entry.organization,
        title: entry.title,
        date_range: entry.date_range,
        location: entry.location,
        bullets: entry.bullets,
    })
    .collect()
}

fn build_projects(
    bundle: &ResumeBundleInput,
    context: &SelectionContext,
    strategy: &AssemblerStrategy,
) -> Vec<ProjectEntry> {
    if !bundle.build_policy.include_projects
        || bundle.build_policy.max_projects == 0
        || bundle.build_policy.max_project_bullets == 0
    {
        return Vec::new();
    }

    let requirement_atoms = try_build_requirement_context(&bundle.requirement_analysis)
        .map(|context| context.atoms)
        .unwrap_or_default();

    build_record_section(
        bundle,
        context,
        strategy,
        &rank_project_records(bundle, context, strategy),
        bundle.build_policy.max_project_bullets,
        false,
        &requirement_atoms,
        Some(bundle.build_policy.max_projects),
    )
    .into_iter()
    .map(|entry| ProjectEntry {
        record_id: entry.record_id,
        organization: entry.organization,
        title: entry.title,
        date_range: entry.date_range,
        bullets: entry.bullets,
    })
    .collect()
}

fn build_toolkit(context: &SelectionContext) -> Option<ToolkitSection> {
    let groups = context
        .toolkit_groups
        .iter()
        .filter_map(|group| {
            if group.group_name.trim().is_empty() {
                return None;
            }
            let items = group
                .items
                .iter()
                .filter(|item| !item.trim().is_empty())
                .cloned()
                .collect::<Vec<_>>();
            if items.is_empty() {
                return None;
            }
            Some(DeliveryToolkitGroup {
                group_name: group.group_name.clone(),
                items,
            })
        })
        .collect::<Vec<_>>();

    if groups.is_empty() {
        return None;
    }

    Some(ToolkitSection {
        label: context.toolkit_label.clone(),
        groups,
    })
}

fn build_gap_report(
    bundle: &ResumeBundleInput,
    selected_evidence_ids: &BTreeSet<String>,
    context: &SelectionContext,
) -> GapReport {
    let Some(requirement_context) = try_build_requirement_context(&bundle.requirement_analysis)
    else {
        return GapReport {
            supported_requirements: Vec::new(),
            partially_supported_requirements: Vec::new(),
            unsupported_requirements: Vec::new(),
            compensation_strategy: Vec::new(),
            risk_flags: vec![
                "Requirement analysis unavailable; gap report is incomplete.".to_string(),
            ],
        };
    };

    build_gap_report_from_requirement_analysis(
        bundle,
        selected_evidence_ids,
        context,
        &requirement_context,
    )
}

fn build_gap_report_from_requirement_analysis(
    bundle: &ResumeBundleInput,
    selected_evidence_ids: &BTreeSet<String>,
    _context: &SelectionContext,
    requirement_context: &RequirementContext,
) -> GapReport {
    let source_lookup = selected_requirement_source_lookup(bundle, selected_evidence_ids);
    let mut supported_requirements = Vec::new();
    let mut partially_supported_requirements = Vec::new();
    let mut unsupported_requirements = Vec::new();
    let mut compensation_strategy = Vec::new();
    let mut risk_flags = Vec::new();
    let mut partial_count = 0;
    let mut unsupported_must_have = 0;

    for atom in &requirement_context.atoms {
        let (supporting_sources, matched_tags, matched_terms) =
            supporting_sources_for_requirement(atom, &source_lookup);
        if !supporting_sources.is_empty()
            && is_strong_requirement_support(&matched_tags, &matched_terms)
        {
            supported_requirements.push(SupportedRequirement {
                requirement: atom.text.clone(),
                supporting_sources,
            });
            continue;
        }
        if !supporting_sources.is_empty() {
            partial_count += 1;
            partially_supported_requirements.push(PartiallySupportedRequirement {
                requirement: atom.text.clone(),
                supporting_sources,
                limitation: PARTIAL_SUPPORT_LIMITATION.to_string(),
            });
            continue;
        }
        if atom.kind == "must_have" {
            unsupported_must_have += 1;
        }
        unsupported_requirements.push(UnsupportedRequirement {
            requirement: atom.text.clone(),
            reason: unsupported_requirement_reason(atom),
        });
    }

    if partial_count > 0 {
        compensation_strategy.push("Use partially supported requirements only as bounded coverage notes; do not imply complete support.".to_string());
    }
    if !unsupported_requirements.is_empty() {
        compensation_strategy.push("Keep unsupported requirements explicit in the gap report rather than inferring support from unrelated evidence.".to_string());
    }
    if requirement_context.atoms.is_empty() {
        risk_flags.push(INCOMPLETE_RISK_FLAG.to_string());
    }
    if partial_count > 0 {
        risk_flags.push(
            "Some requirements are only partially supported through general matched tags."
                .to_string(),
        );
    }
    if unsupported_must_have > 0 {
        risk_flags.push(
            "One or more must-have requirements remain unsupported by selected sources."
                .to_string(),
        );
    }

    GapReport {
        supported_requirements,
        partially_supported_requirements,
        unsupported_requirements,
        compensation_strategy,
        risk_flags,
    }
}

fn build_header(candidate_profile: &BundleCandidateProfile) -> Result<ResumeHeader, String> {
    let display_name = normalize_whitespace(&candidate_profile.candidate_identity.display_name);
    if display_name.is_empty() {
        return Err(
            "candidate_profile.candidate_identity.display_name must be a non-empty string."
                .to_string(),
        );
    }
    let contact = &candidate_profile.candidate_identity.contact;
    Ok(ResumeHeader {
        display_name,
        location: normalize_whitespace(&candidate_profile.candidate_identity.location),
        email: normalize_optional_string(&contact.email),
        phone: normalize_optional_string(&contact.phone),
        linkedin: normalize_optional_string(&contact.linkedin),
        github: normalize_optional_string(&contact.github),
    })
}

fn build_education(candidate_profile: &BundleCandidateProfile) -> Vec<TextSourceItem> {
    candidate_profile
        .static_sections
        .education
        .iter()
        .filter_map(|item| build_education_item(item))
        .collect()
}

fn build_certifications(candidate_profile: &BundleCandidateProfile) -> Vec<TextSourceItem> {
    candidate_profile
        .static_sections
        .certifications
        .iter()
        .filter_map(|item| build_certification_item(item))
        .collect()
}

fn build_education_item(item: &BundleCandidateEducationEntry) -> Option<TextSourceItem> {
    let credential = normalize_whitespace(&item.credential);
    let institution = normalize_whitespace(&item.institution);
    let mut extras = Vec::new();
    let major = normalize_optional_string(&item.field_notes.major);
    let minor = normalize_optional_string(&item.field_notes.minor);
    if !major.is_empty() {
        extras.push(format!("Major: {major}"));
    }
    if !minor.is_empty() {
        extras.push(format!("Minor: {minor}"));
    }

    let mut text = [credential, institution]
        .into_iter()
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join(", ");
    if !extras.is_empty() {
        text = format!("{text} ({})", extras.join("; "));
    }
    let source_id = normalize_whitespace(&item.id);
    if text.is_empty() || source_id.is_empty() {
        return None;
    }

    Some(TextSourceItem { text, source_id })
}

fn build_certification_item(item: &BundleCandidateCertificationEntry) -> Option<TextSourceItem> {
    let text = [
        normalize_whitespace(&item.name),
        normalize_whitespace(&item.issuer),
        normalize_whitespace(&item.credential_detail),
    ]
    .into_iter()
    .filter(|part| !part.is_empty())
    .collect::<Vec<_>>()
    .join(" | ");
    let source_id = normalize_whitespace(&item.id);
    if text.is_empty() || source_id.is_empty() {
        return None;
    }

    Some(TextSourceItem { text, source_id })
}

fn rank_employment_records(
    bundle: &ResumeBundleInput,
    context: &SelectionContext,
    strategy: &AssemblerStrategy,
) -> Vec<RankedRecord> {
    rank_records(bundle, context, strategy, "employment")
}

fn rank_project_records(
    bundle: &ResumeBundleInput,
    context: &SelectionContext,
    strategy: &AssemblerStrategy,
) -> Vec<RankedRecord> {
    rank_records(bundle, context, strategy, "project")
}

fn rank_records(
    bundle: &ResumeBundleInput,
    context: &SelectionContext,
    strategy: &AssemblerStrategy,
    record_type: &str,
) -> Vec<RankedRecord> {
    let mut ranked_records = bundle
        .career_library_export
        .experience_records
        .iter()
        .filter(|record| record.record_type == record_type)
        .map(|record| {
            let ranked_evidence = rank_evidence_for_record(record, context, strategy);
            let best_score = ranked_evidence
                .iter()
                .map(|item| item.total_score)
                .fold(0.0, f64::max);
            let density_score = ranked_evidence
                .first()
                .map(|item| item.density_score)
                .unwrap_or(0.0);
            let requirement_pressure = record
                .evidence
                .iter()
                .map(|evidence| {
                    requirement_match_score(evidence, &context.requirement_priority_tags)
                })
                .fold(0.0, f64::max);

            RankedRecord {
                record_id: record.id.clone(),
                best_score,
                density_score,
                requirement_pressure,
                record_type: record.record_type.clone(),
                recency: record_recency(record),
            }
        })
        .collect::<Vec<_>>();

    ranked_records.sort_by(compare_ranked_record);
    ranked_records
}

fn rank_evidence_for_record(
    record: &CareerLibraryExportRecord,
    context: &SelectionContext,
    strategy: &AssemblerStrategy,
) -> Vec<RankedEvidence> {
    let context_tags = record_context_tags(record);
    let mut tag_scores = HashMap::new();
    let mut supported_count = 0usize;

    for evidence in &record.evidence {
        let effective_tags = evidence_support_tags(evidence, &context_tags);
        let tag_score = if effective_tags.is_empty() || context.target_tags.is_empty() {
            0.0
        } else {
            f1_tag_score(&effective_tags, &context.target_tags)
        };
        if tag_score > 0.0 {
            supported_count += 1;
        }
        tag_scores.insert(evidence.id.clone(), tag_score);
    }

    let density_score = supported_count as f64 / record.evidence.len().max(1) as f64;
    let mut ranked = record
        .evidence
        .iter()
        .map(|evidence| {
            let tag_score = tag_scores.get(&evidence.id).copied().unwrap_or(0.0);
            RankedEvidence {
                evidence_id: evidence.id.clone(),
                claim: evidence.claim.clone(),
                tag_score,
                density_score,
                total_score: (strategy.tag_weight * tag_score)
                    + (strategy.density_weight * density_score),
                requirement_pressure: requirement_match_score(
                    evidence,
                    &context.requirement_priority_tags,
                ),
            }
        })
        .collect::<Vec<_>>();

    ranked.sort_by(compare_ranked_evidence);
    ranked
}

fn iter_ranked_records_with_evidence(
    bundle: &ResumeBundleInput,
    context: &SelectionContext,
    strategy: &AssemblerStrategy,
) -> Vec<(CareerLibraryExportRecord, Vec<RankedEvidence>)> {
    let record_by_id = bundle
        .career_library_export
        .experience_records
        .iter()
        .map(|record| (record.id.clone(), record.clone()))
        .collect::<HashMap<_, _>>();
    let ordered_records = rank_employment_records(bundle, context, strategy)
        .into_iter()
        .chain(rank_project_records(bundle, context, strategy))
        .collect::<Vec<_>>();

    ordered_records
        .into_iter()
        .filter_map(|ranked_record| {
            let record = record_by_id.get(&ranked_record.record_id)?.clone();
            let ranked_evidence = rank_evidence_for_record(&record, context, strategy);
            Some((record, ranked_evidence))
        })
        .collect()
}

#[derive(Debug, Clone)]
struct RecordSectionEntry {
    record_id: String,
    organization: String,
    title: String,
    date_range: String,
    location: Option<String>,
    bullets: Vec<SingleEvidenceClaim>,
}

fn build_record_section(
    bundle: &ResumeBundleInput,
    context: &SelectionContext,
    strategy: &AssemblerStrategy,
    ranked_records: &[RankedRecord],
    max_bullets: u32,
    include_location: bool,
    requirement_atoms: &[RequirementAtom],
    max_entries: Option<u32>,
) -> Vec<RecordSectionEntry> {
    let record_by_id = bundle
        .career_library_export
        .experience_records
        .iter()
        .map(|record| (record.id.clone(), record))
        .collect::<HashMap<_, _>>();
    let mut entries = Vec::new();

    for ranked_record in ranked_records {
        if max_entries
            .map(|limit| entries.len() >= limit as usize)
            .unwrap_or(false)
        {
            break;
        }

        let Some(record) = record_by_id.get(&ranked_record.record_id).copied() else {
            continue;
        };
        let bullets = build_single_evidence_bullets(
            record,
            &rank_evidence_for_record(record, context, strategy),
            max_bullets,
            strategy.bullet_max_chars,
            requirement_atoms,
        );
        if bullets.is_empty() {
            continue;
        }

        entries.push(RecordSectionEntry {
            record_id: record.id.clone(),
            organization: record.organization.clone(),
            title: record.title.clone(),
            date_range: display_date_range(record),
            location: if include_location {
                record.location.clone()
            } else {
                None
            },
            bullets,
        });
    }

    entries
}

fn build_single_evidence_bullets(
    record: &CareerLibraryExportRecord,
    ranked_evidence: &[RankedEvidence],
    max_bullets: u32,
    max_chars: u32,
    requirement_atoms: &[RequirementAtom],
) -> Vec<SingleEvidenceClaim> {
    if max_bullets == 0 {
        return Vec::new();
    }

    let (ordered_atoms, support_maps) = record_requirement_support_maps(record, requirement_atoms);
    let mut uncovered_atom_ids = ordered_atoms
        .iter()
        .map(|atom| atom.requirement_id.clone())
        .collect::<HashSet<_>>();
    let ranked_candidates = ranked_evidence
        .iter()
        .map(|item| (item.clone(), truncate_text(&item.claim, max_chars)))
        .collect::<Vec<_>>();
    let mut bullets = Vec::new();
    let mut seen_texts = HashSet::new();
    let mut selected_evidence_ids = HashSet::new();

    while !uncovered_atom_ids.is_empty() && bullets.len() < max_bullets as usize {
        let Some((ranked_item, text, covered_ids)) = best_coverage_candidate(
            &ranked_candidates,
            &ordered_atoms,
            &support_maps,
            &uncovered_atom_ids,
            &seen_texts,
            &selected_evidence_ids,
        ) else {
            break;
        };

        bullets.push(SingleEvidenceClaim {
            text: text.clone(),
            evidence_ids: vec![ranked_item.evidence_id.clone()],
        });
        seen_texts.insert(text);
        selected_evidence_ids.insert(ranked_item.evidence_id);
        uncovered_atom_ids.retain(|id| !covered_ids.contains(id));
    }

    for (ranked_item, text) in ranked_candidates {
        if bullets.len() >= max_bullets as usize {
            break;
        }
        if text.is_empty()
            || seen_texts.contains(&text)
            || selected_evidence_ids.contains(&ranked_item.evidence_id)
        {
            continue;
        }
        bullets.push(SingleEvidenceClaim {
            text: text.clone(),
            evidence_ids: vec![ranked_item.evidence_id.clone()],
        });
        seen_texts.insert(text);
        selected_evidence_ids.insert(ranked_item.evidence_id);
    }

    bullets
}

fn record_requirement_support_maps(
    record: &CareerLibraryExportRecord,
    requirement_atoms: &[RequirementAtom],
) -> (Vec<RequirementAtom>, HashMap<String, HashMap<String, i32>>) {
    let ordered_atoms = ordered_requirement_atoms(requirement_atoms);
    if ordered_atoms.is_empty() {
        return (Vec::new(), HashMap::new());
    }
    let record_context_tags = record_context_tags(record);
    let support_maps = record
        .evidence
        .iter()
        .map(|evidence| {
            (
                evidence.id.clone(),
                evidence_requirement_support(evidence, &record_context_tags, &ordered_atoms),
            )
        })
        .collect::<HashMap<_, _>>();

    (ordered_atoms, support_maps)
}

fn ordered_requirement_atoms(requirement_atoms: &[RequirementAtom]) -> Vec<RequirementAtom> {
    let mut atoms = requirement_atoms
        .iter()
        .filter(|atom| !atom.requirement_id.trim().is_empty())
        .cloned()
        .collect::<Vec<_>>();
    atoms.sort_by(|left, right| {
        left.priority_rank
            .cmp(&right.priority_rank)
            .then_with(|| left.source_order.cmp(&right.source_order))
            .then_with(|| left.requirement_id.cmp(&right.requirement_id))
    });
    atoms
}

fn best_coverage_candidate(
    ranked_candidates: &[(RankedEvidence, String)],
    ordered_atoms: &[RequirementAtom],
    support_maps: &HashMap<String, HashMap<String, i32>>,
    uncovered_atom_ids: &HashSet<String>,
    excluded_texts: &HashSet<String>,
    selected_evidence_ids: &HashSet<String>,
) -> Option<(RankedEvidence, String, HashSet<String>)> {
    let mut best_candidate: Option<(RankedEvidence, String)> = None;
    let mut best_signature: Option<Vec<i32>> = None;
    let mut best_covered_ids = HashSet::new();

    for (ranked_item, text) in ranked_candidates {
        if text.is_empty()
            || excluded_texts.contains(text)
            || selected_evidence_ids.contains(&ranked_item.evidence_id)
        {
            continue;
        }

        let support_map = support_maps
            .get(&ranked_item.evidence_id)
            .cloned()
            .unwrap_or_default();
        let coverage_signature =
            coverage_signature_for_uncovered_atoms(ordered_atoms, &support_map, uncovered_atom_ids);
        if coverage_signature.iter().copied().max().unwrap_or(0) <= 0 {
            continue;
        }

        let covered_ids = ordered_atoms
            .iter()
            .filter(|atom| {
                uncovered_atom_ids.contains(&atom.requirement_id)
                    && support_map.get(&atom.requirement_id).copied().unwrap_or(0) > 0
            })
            .map(|atom| atom.requirement_id.clone())
            .collect::<HashSet<_>>();

        if best_signature
            .as_ref()
            .map(|best| coverage_signature > *best)
            .unwrap_or(true)
        {
            best_candidate = Some((ranked_item.clone(), text.clone()));
            best_signature = Some(coverage_signature);
            best_covered_ids = covered_ids;
        }
    }

    best_candidate.map(|(item, text)| (item, text, best_covered_ids))
}

fn coverage_signature_for_uncovered_atoms(
    ordered_atoms: &[RequirementAtom],
    support_map: &HashMap<String, i32>,
    uncovered_atom_ids: &HashSet<String>,
) -> Vec<i32> {
    ordered_atoms
        .iter()
        .filter(|atom| uncovered_atom_ids.contains(&atom.requirement_id))
        .map(|atom| support_map.get(&atom.requirement_id).copied().unwrap_or(0))
        .collect()
}

fn try_build_requirement_context(
    requirement_analysis: &RequirementAnalysis,
) -> Option<RequirementContext> {
    build_requirement_context(requirement_analysis).ok()
}

fn selected_requirement_source_lookup(
    bundle: &ResumeBundleInput,
    selected_evidence_ids: &BTreeSet<String>,
) -> HashMap<(String, String), RequirementSourceSupport> {
    let mut lookup = HashMap::new();

    for record in &bundle.career_library_export.experience_records {
        let record_terms = extract_surface_terms(&record.title)
            .into_iter()
            .collect::<HashSet<_>>();
        for evidence in &record.evidence {
            if !selected_evidence_ids.contains(&evidence.id) {
                continue;
            }
            let tags = evidence
                .tags
                .iter()
                .map(|value| normalize_semantic_tag(value))
                .filter(|value| !value.is_empty())
                .collect::<HashSet<_>>();
            let mut terms = record_terms.clone();
            terms.extend(extract_surface_terms(&evidence.claim));
            lookup.insert(
                ("evidence".to_string(), evidence.id.clone()),
                RequirementSourceSupport { tags, terms },
            );
        }
    }

    let education_text_by_id = build_education(&bundle.candidate_profile)
        .into_iter()
        .map(|item| (item.source_id, item.text))
        .collect::<HashMap<_, _>>();
    let certification_text_by_id = build_certifications(&bundle.candidate_profile)
        .into_iter()
        .map(|item| (item.source_id, item.text))
        .collect::<HashMap<_, _>>();

    for (composite_key, raw_tags) in &bundle.bundle_semantics.static_source_tags {
        let Some((source_type, source_id)) = composite_key.split_once(':') else {
            continue;
        };
        if !matches!(source_type, "education" | "certification") || source_id.is_empty() {
            continue;
        }
        let tags = raw_tags
            .iter()
            .map(|value| normalize_semantic_tag(value))
            .filter(|value| !value.is_empty())
            .collect::<HashSet<_>>();
        let source_text = if source_type == "education" {
            education_text_by_id.get(source_id)
        } else {
            certification_text_by_id.get(source_id)
        }
        .cloned()
        .unwrap_or_default();
        let terms = extract_surface_terms(&source_text)
            .into_iter()
            .collect::<HashSet<_>>();
        if tags.is_empty() && terms.is_empty() {
            continue;
        }
        lookup.insert(
            (source_type.to_string(), source_id.to_string()),
            RequirementSourceSupport { tags, terms },
        );
    }

    lookup
}

fn supporting_sources_for_requirement(
    atom: &RequirementAtom,
    source_lookup: &HashMap<(String, String), RequirementSourceSupport>,
) -> (Vec<SupportingSource>, HashSet<String>, HashSet<String>) {
    let atom_tags = atom
        .matched_tags
        .iter()
        .filter(|tag| !tag.is_empty())
        .cloned()
        .collect::<HashSet<_>>();
    let atom_terms = atom
        .normalized_terms
        .iter()
        .filter(|entry| !entry.is_negated && !entry.term.is_empty())
        .map(|entry| entry.term.clone())
        .collect::<HashSet<_>>();
    if atom_tags.is_empty() && atom_terms.is_empty() {
        return (Vec::new(), HashSet::new(), HashSet::new());
    }

    let mut matched_tags = HashSet::new();
    let mut matched_terms = HashSet::new();
    let mut supporting_sources = Vec::new();
    let mut ordered_keys = source_lookup.keys().cloned().collect::<Vec<_>>();
    ordered_keys.sort();

    for (source_type, source_id) in ordered_keys {
        let source_support = &source_lookup[&(source_type.clone(), source_id.clone())];
        let tag_overlap = source_support
            .tags
            .intersection(&atom_tags)
            .cloned()
            .collect::<HashSet<_>>();
        let term_overlap = source_support
            .terms
            .intersection(&atom_terms)
            .cloned()
            .collect::<HashSet<_>>();
        if tag_overlap.is_empty() && term_overlap.is_empty() {
            continue;
        }
        supporting_sources.push(SupportingSource {
            source_type,
            source_id,
        });
        matched_tags.extend(tag_overlap);
        matched_terms.extend(term_overlap);
    }

    (supporting_sources, matched_tags, matched_terms)
}

fn is_strong_requirement_support(
    matched_tags: &HashSet<String>,
    matched_terms: &HashSet<String>,
) -> bool {
    if matched_tags
        .iter()
        .any(|tag| !GENERIC_REQUIREMENT_TAGS.contains(&tag.as_str()))
    {
        return true;
    }

    matched_terms
        .iter()
        .any(|term| !GENERIC_SURFACE_TERMS.contains(&term.as_str()))
}

fn unsupported_requirement_reason(atom: &RequirementAtom) -> String {
    // A requirement has traceable signal if it has any matched tag or any
    // asserted (non-negated) surface term. Negated-only terms must not count
    // as support — "no VBA experience" gives us nothing to match against.
    let has_asserted_term = atom.normalized_terms.iter().any(|entry| !entry.is_negated);
    if !atom.matched_tags.is_empty() || has_asserted_term {
        return UNSUPPORTED_REASON.to_string();
    }
    "Requirement analysis did not identify traceable keyword overlap for this requirement."
        .to_string()
}

fn requirement_priority_tags(requirement_context: &RequirementContext) -> Vec<String> {
    let mut ordered = Vec::new();
    let mut seen = HashSet::new();
    let mut atoms = requirement_context.atoms.clone();
    atoms.sort_by(|left, right| {
        left.priority_rank
            .cmp(&right.priority_rank)
            .then_with(|| left.source_order.cmp(&right.source_order))
            .then_with(|| left.requirement_id.cmp(&right.requirement_id))
    });

    for atom in atoms {
        for tag in atom.matched_tags {
            if seen.insert(tag.clone()) {
                ordered.push(tag);
            }
        }
    }

    ordered
}

fn requirement_match_score(
    evidence: &CareerLibraryExportEvidenceItem,
    requirement_priority_tags: &[String],
) -> f64 {
    if requirement_priority_tags.is_empty() {
        return 0.0;
    }
    let evidence_tags = evidence
        .tags
        .iter()
        .map(|value| normalize_semantic_tag(value))
        .filter(|value| !value.is_empty())
        .collect::<HashSet<_>>();
    if evidence_tags.is_empty() {
        return 0.0;
    }
    let matched_positions = requirement_priority_tags
        .iter()
        .enumerate()
        .filter_map(|(index, tag)| evidence_tags.contains(tag).then_some(index))
        .collect::<Vec<_>>();
    if matched_positions.is_empty() {
        return 0.0;
    }
    matched_positions.len() as f64 + (1.0 / (matched_positions[0] as f64 + 1.0))
}

fn record_context_tags(record: &CareerLibraryExportRecord) -> HashSet<String> {
    record
        .context_tags
        .iter()
        .map(|value| normalize_semantic_tag(value))
        .filter(|value| !value.is_empty())
        .collect()
}

fn evidence_support_tags(
    evidence: &CareerLibraryExportEvidenceItem,
    record_context_tags: &HashSet<String>,
) -> HashSet<String> {
    let evidence_tags = evidence
        .tags
        .iter()
        .map(|value| normalize_semantic_tag(value))
        .filter(|value| !value.is_empty())
        .collect::<HashSet<_>>();
    if evidence_tags.is_empty() {
        return record_context_tags.clone();
    }
    evidence_tags
}

fn informative_requirement_terms(atom: &RequirementAtom) -> HashSet<String> {
    atom.normalized_terms
        .iter()
        .filter(|entry| {
            !entry.is_negated
                && !entry.term.is_empty()
                && !GENERIC_SURFACE_TERMS.contains(&entry.term.as_str())
        })
        .map(|entry| entry.term.clone())
        .collect()
}

fn evidence_support_terms(evidence: &CareerLibraryExportEvidenceItem) -> HashSet<String> {
    extract_surface_terms(&evidence.claim).into_iter().collect()
}

fn requirement_support_tier(
    atom: &RequirementAtom,
    evidence_tags: &HashSet<String>,
    evidence_terms: &HashSet<String>,
) -> i32 {
    let atom_tags = atom.matched_tags.iter().cloned().collect::<HashSet<_>>();
    let informative_terms = informative_requirement_terms(atom);
    let tag_overlap = evidence_tags.intersection(&atom_tags).count();
    let term_overlap = evidence_terms.intersection(&informative_terms).count();
    if tag_overlap > 0 && term_overlap > 0 {
        return 3;
    }
    if tag_overlap > 0 {
        return 2;
    }
    if term_overlap > 0 {
        return 1;
    }
    0
}

fn evidence_requirement_support(
    evidence: &CareerLibraryExportEvidenceItem,
    record_context_tags: &HashSet<String>,
    requirement_atoms: &[RequirementAtom],
) -> HashMap<String, i32> {
    let evidence_tags = evidence_support_tags(evidence, record_context_tags);
    let evidence_terms = evidence_support_terms(evidence);
    let mut support = HashMap::new();
    for atom in requirement_atoms {
        let tier = requirement_support_tier(atom, &evidence_tags, &evidence_terms);
        if tier > 0 {
            support.insert(atom.requirement_id.clone(), tier);
        }
    }
    support
}

fn display_date_range(record: &CareerLibraryExportRecord) -> String {
    let start_date = normalize_optional_string(&record.start_date);
    let end_date = normalize_optional_string(&record.end_date);
    if is_open_ended(&end_date) {
        return [start_date, "Present".to_string()]
            .into_iter()
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>()
            .join(" - ");
    }
    if !start_date.is_empty() && !end_date.is_empty() {
        return format!("{start_date} - {end_date}");
    }
    if !start_date.is_empty() {
        return start_date;
    }
    if !end_date.is_empty() {
        return end_date;
    }
    "Unknown".to_string()
}

fn claim_text_set_from_entries(
    professional_experience: &[ExperienceEntry],
    projects: &[ProjectEntry],
) -> HashSet<String> {
    professional_experience
        .iter()
        .flat_map(|entry| entry.bullets.iter().map(|bullet| bullet.text.clone()))
        .chain(
            projects
                .iter()
                .flat_map(|entry| entry.bullets.iter().map(|bullet| bullet.text.clone())),
        )
        .filter(|text| !text.is_empty())
        .collect()
}

fn evidence_ids_for_claim(
    ranked_evidence: &[RankedEvidence],
    primary: &RankedEvidence,
    strategy: &AssemblerStrategy,
    section_name: &str,
) -> Vec<String> {
    if !strategy
        .allow_multi_evidence_sections
        .iter()
        .any(|name| name == section_name)
    {
        return vec![primary.evidence_id.clone()];
    }

    let mut evidence_ids = ranked_evidence
        .iter()
        .filter(|item| item.evidence_id != primary.evidence_id && item.tag_score > 0.0)
        .map(|item| item.evidence_id.clone())
        .collect::<BTreeSet<_>>();
    evidence_ids.insert(primary.evidence_id.clone());
    evidence_ids.into_iter().collect()
}

fn build_claim_to_evidence_map(resume: &StructuredResume) -> Vec<ClaimToEvidenceMapEntry> {
    let mut claim_map = Vec::new();

    if let Some(profile) = &resume.profile {
        claim_map.push(ClaimToEvidenceMapEntry {
            claim_path: make_claim_path("profile", 0, None).expect("valid profile path"),
            evidence_ids: sorted_unique_strings(profile.evidence_ids.clone()),
        });
    }

    for (index, item) in resume.highlights.iter().enumerate() {
        claim_map.push(ClaimToEvidenceMapEntry {
            claim_path: make_claim_path("highlights", index, None).expect("valid highlight path"),
            evidence_ids: sorted_unique_strings(item.evidence_ids.clone()),
        });
    }

    for (item_index, item) in resume.professional_experience.iter().enumerate() {
        for (bullet_index, bullet) in item.bullets.iter().enumerate() {
            claim_map.push(ClaimToEvidenceMapEntry {
                claim_path: make_claim_path(
                    "professional_experience",
                    item_index,
                    Some(bullet_index),
                )
                .expect("valid professional experience path"),
                evidence_ids: sorted_unique_strings(bullet.evidence_ids.clone()),
            });
        }
    }

    for (item_index, item) in resume.projects.iter().enumerate() {
        for (bullet_index, bullet) in item.bullets.iter().enumerate() {
            claim_map.push(ClaimToEvidenceMapEntry {
                claim_path: make_claim_path("projects", item_index, Some(bullet_index))
                    .expect("valid project path"),
                evidence_ids: sorted_unique_strings(bullet.evidence_ids.clone()),
            });
        }
    }

    claim_map
}

fn selected_evidence_ids_from_claim_map(
    claim_to_evidence_map: &[ClaimToEvidenceMapEntry],
) -> BTreeSet<String> {
    claim_to_evidence_map
        .iter()
        .flat_map(|entry| entry.evidence_ids.iter().cloned())
        .collect()
}

fn evidence_to_record_map(bundle: &ResumeBundleInput) -> HashMap<String, String> {
    let mut mapping = HashMap::new();
    for record in &bundle.career_library_export.experience_records {
        for evidence in &record.evidence {
            mapping.insert(evidence.id.clone(), record.id.clone());
        }
    }
    mapping
}

fn build_constraint_flags(
    bundle: &ResumeBundleInput,
    strategy: &AssemblerStrategy,
    resume: &StructuredResume,
) -> Vec<ConstraintFlag> {
    let profile_status = if resume.profile.is_some() {
        "passed"
    } else {
        "warning"
    };
    let projects_status =
        if bundle.build_policy.include_projects && bundle.build_policy.max_projects > 0 {
            "passed"
        } else {
            "warning"
        };
    let multi_evidence_sections = if strategy.allow_multi_evidence_sections.is_empty() {
        "none".to_string()
    } else {
        strategy.allow_multi_evidence_sections.join(", ")
    };

    vec![
        ConstraintFlag {
            rule: "claim_text_projection".to_string(),
            status: "passed".to_string(),
            note: "Rendered claim text is limited to normalization and deterministic truncation of evidence.claim.".to_string(),
        },
        ConstraintFlag {
            rule: "multi_evidence_sections".to_string(),
            status: "passed".to_string(),
            note: format!("Only same-record corroboration is allowed in: {multi_evidence_sections}."),
        },
        ConstraintFlag {
            rule: "profile_generation".to_string(),
            status: profile_status.to_string(),
            note: if profile_status == "passed" {
                "Profile emitted only when a profile_summary_seed line exactly matched a supported primary evidence claim.".to_string()
            } else {
                "Profile omitted because no seed line safely matched a supported primary evidence claim.".to_string()
            },
        },
        ConstraintFlag {
            rule: "projects_section".to_string(),
            status: projects_status.to_string(),
            note: if bundle.build_policy.include_projects && bundle.build_policy.max_projects > 0 {
                format!(
                    "Projects are enabled by build policy, capped at {} rendered entries, and still require single-evidence bullets.",
                    bundle.build_policy.max_projects
                )
            } else if bundle.build_policy.include_projects {
                "Projects are enabled by build policy but capped to zero rendered entries.".to_string()
            } else {
                "Projects are disabled by build policy.".to_string()
            },
        },
    ]
}

fn build_notes(strategy: &AssemblerStrategy, resume: &StructuredResume) -> Vec<String> {
    let mut notes = vec![
        TOOLKIT_ONLY_NOTE.to_string(),
        NORMALIZATION_ONLY_NOTE.to_string(),
        GAP_REPORT_NOTE.to_string(),
    ];
    if resume.profile.is_none() {
        notes.push(PROFILE_MISSING_NOTE.to_string());
    }
    if !strategy
        .allow_multi_evidence_sections
        .iter()
        .any(|section| section == "highlights")
    {
        notes.push(
            "Highlights are restricted to single-evidence claims by assembler_strategy."
                .to_string(),
        );
    }
    notes
}

fn validate_assembled_artifact(artifact: &AssembledResumeArtifact) -> Result<(), String> {
    if artifact.resume.header.display_name.trim().is_empty() {
        return Err("resume.header.display_name must be a non-empty string.".to_string());
    }
    if artifact.resume.target_role_family.trim().is_empty() {
        return Err("resume.target_role_family must be a non-empty string.".to_string());
    }
    for claim in &artifact.resume.highlights {
        validate_multi_evidence_claim(claim, "resume.highlights")?;
    }
    if let Some(profile) = &artifact.resume.profile {
        validate_profile_section(profile)?;
    }
    for entry in &artifact.resume.professional_experience {
        validate_experience_entry(entry)?;
    }
    for entry in &artifact.resume.projects {
        validate_project_entry(entry)?;
    }
    for entry in &artifact.resume.education {
        validate_text_source_item(entry, "resume.education")?;
    }
    for entry in &artifact.resume.certifications {
        validate_text_source_item(entry, "resume.certifications")?;
    }
    if let Some(toolkit) = &artifact.resume.toolkit {
        validate_toolkit_section(toolkit)?;
    }
    validate_gap_report(&artifact.gap_report)?;
    validate_provenance(&artifact.provenance)?;
    Ok(())
}

fn validate_multi_evidence_claim(claim: &MultiEvidenceClaim, path: &str) -> Result<(), String> {
    if claim.text.trim().is_empty() {
        return Err(format!("{path}.text must be a non-empty string."));
    }
    validate_non_empty_unique_strings(&claim.evidence_ids, &format!("{path}.evidence_ids"))
}

fn validate_single_evidence_claim(claim: &SingleEvidenceClaim, path: &str) -> Result<(), String> {
    if claim.text.trim().is_empty() {
        return Err(format!("{path}.text must be a non-empty string."));
    }
    validate_non_empty_unique_strings(&claim.evidence_ids, &format!("{path}.evidence_ids"))?;
    if claim.evidence_ids.len() != 1 {
        return Err(format!(
            "{path}.evidence_ids must contain exactly one evidence id."
        ));
    }
    Ok(())
}

fn validate_profile_section(profile: &ProfileSection) -> Result<(), String> {
    if profile.text.trim().is_empty() {
        return Err("resume.profile.text must be a non-empty string.".to_string());
    }
    validate_non_empty_unique_strings(&profile.evidence_ids, "resume.profile.evidence_ids")
}

fn validate_experience_entry(entry: &ExperienceEntry) -> Result<(), String> {
    if entry.record_id.trim().is_empty()
        || entry.organization.trim().is_empty()
        || entry.title.trim().is_empty()
        || entry.date_range.trim().is_empty()
    {
        return Err("resume.professional_experience entries must have non-empty record_id, organization, title, and date_range.".to_string());
    }
    for (index, bullet) in entry.bullets.iter().enumerate() {
        validate_single_evidence_claim(
            bullet,
            &format!("resume.professional_experience.bullets[{index}]"),
        )?;
    }
    Ok(())
}

fn validate_project_entry(entry: &ProjectEntry) -> Result<(), String> {
    if entry.record_id.trim().is_empty()
        || entry.organization.trim().is_empty()
        || entry.title.trim().is_empty()
        || entry.date_range.trim().is_empty()
    {
        return Err("resume.projects entries must have non-empty record_id, organization, title, and date_range.".to_string());
    }
    for (index, bullet) in entry.bullets.iter().enumerate() {
        validate_single_evidence_claim(bullet, &format!("resume.projects.bullets[{index}]"))?;
    }
    Ok(())
}

fn validate_text_source_item(item: &TextSourceItem, path: &str) -> Result<(), String> {
    if item.text.trim().is_empty() || item.source_id.trim().is_empty() {
        return Err(format!(
            "{path} entries must have non-empty text and source_id."
        ));
    }
    Ok(())
}

fn validate_toolkit_section(toolkit: &ToolkitSection) -> Result<(), String> {
    if toolkit.label.trim().is_empty() {
        return Err("resume.toolkit.label must be a non-empty string.".to_string());
    }
    for group in &toolkit.groups {
        if group.group_name.trim().is_empty() {
            return Err(
                "resume.toolkit.groups[].group_name must be a non-empty string.".to_string(),
            );
        }
        validate_non_empty_unique_strings(&group.items, "resume.toolkit.groups[].items")?;
    }
    Ok(())
}

fn validate_gap_report(gap_report: &GapReport) -> Result<(), String> {
    for item in &gap_report.supported_requirements {
        if item.requirement.trim().is_empty() || item.supporting_sources.is_empty() {
            return Err("gap_report.supported_requirements entries must have non-empty requirement and supporting_sources.".to_string());
        }
    }
    for item in &gap_report.partially_supported_requirements {
        if item.requirement.trim().is_empty()
            || item.supporting_sources.is_empty()
            || item.limitation.trim().is_empty()
        {
            return Err("gap_report.partially_supported_requirements entries must have non-empty requirement, supporting_sources, and limitation.".to_string());
        }
    }
    for item in &gap_report.unsupported_requirements {
        if item.requirement.trim().is_empty() || item.reason.trim().is_empty() {
            return Err("gap_report.unsupported_requirements entries must have non-empty requirement and reason.".to_string());
        }
    }
    Ok(())
}

fn validate_provenance(provenance: &Provenance) -> Result<(), String> {
    if provenance.target_role_family.trim().is_empty() {
        return Err("provenance.target_role_family must be a non-empty string.".to_string());
    }
    validate_non_empty_unique_strings(
        &provenance.selected_record_ids,
        "provenance.selected_record_ids",
    )?;
    validate_non_empty_unique_strings(
        &provenance.selected_evidence_ids,
        "provenance.selected_evidence_ids",
    )?;
    for entry in &provenance.claim_to_evidence_map {
        if entry.claim_path.trim().is_empty() {
            return Err(
                "provenance.claim_to_evidence_map[].claim_path must be a non-empty string."
                    .to_string(),
            );
        }
        validate_non_empty_unique_strings(
            &entry.evidence_ids,
            "provenance.claim_to_evidence_map[].evidence_ids",
        )?;
    }
    for flag in &provenance.constraint_flags {
        if flag.rule.trim().is_empty() || flag.note.trim().is_empty() {
            return Err(
                "provenance.constraint_flags entries must have non-empty rule and note."
                    .to_string(),
            );
        }
        if !matches!(flag.status.as_str(), "passed" | "warning" | "failed") {
            return Err(
                "provenance.constraint_flags[].status must be one of passed, warning, or failed."
                    .to_string(),
            );
        }
    }
    validate_non_empty_unique_strings(&provenance.notes, "provenance.notes")?;
    Ok(())
}

fn validate_non_empty_unique_strings(values: &[String], path: &str) -> Result<(), String> {
    if values.is_empty() {
        return Err(format!("{path} must not be empty."));
    }
    let mut seen = HashSet::new();
    for value in values {
        if value.trim().is_empty() {
            return Err(format!("{path} must not contain blank values."));
        }
        if !seen.insert(value.clone()) {
            return Err(format!("{path} must not contain duplicates."));
        }
    }
    Ok(())
}

fn make_claim_path(
    section: &str,
    item_index: usize,
    bullet_index: Option<usize>,
) -> Result<String, String> {
    match (section, bullet_index) {
        ("profile", None) => Ok("resume.profile".to_string()),
        ("highlights", None) => Ok(format!("resume.highlights[{item_index}]")),
        ("professional_experience", Some(bullet_index)) => Ok(format!(
            "resume.professional_experience[{item_index}].bullets[{bullet_index}]"
        )),
        ("projects", Some(bullet_index)) => Ok(format!(
            "resume.projects[{item_index}].bullets[{bullet_index}]"
        )),
        _ => Err(format!(
            "Unsupported claim path target: section={section:?}, bullet_index={bullet_index:?}"
        )),
    }
}

fn compare_ranked_evidence(left: &RankedEvidence, right: &RankedEvidence) -> Ordering {
    right
        .total_score
        .total_cmp(&left.total_score)
        .then_with(|| right.tag_score.total_cmp(&left.tag_score))
        .then_with(|| right.density_score.total_cmp(&left.density_score))
        .then_with(|| {
            right
                .requirement_pressure
                .total_cmp(&left.requirement_pressure)
        })
        .then_with(|| left.evidence_id.cmp(&right.evidence_id))
}

fn compare_ranked_record(left: &RankedRecord, right: &RankedRecord) -> Ordering {
    let left_bucket = section_bucket_rank(&left.record_type);
    let right_bucket = section_bucket_rank(&right.record_type);
    left_bucket
        .cmp(&right_bucket)
        .then_with(|| right.best_score.total_cmp(&left.best_score))
        .then_with(|| compare_record_recency(&left.recency, &right.recency))
        .then_with(|| right.density_score.total_cmp(&left.density_score))
        .then_with(|| {
            right
                .requirement_pressure
                .total_cmp(&left.requirement_pressure)
        })
        .then_with(|| left.record_id.cmp(&right.record_id))
}

fn compare_record_recency(left: &RecordRecency, right: &RecordRecency) -> Ordering {
    right
        .is_open_ended
        .cmp(&left.is_open_ended)
        .then_with(|| right.end_ordinal.cmp(&left.end_ordinal))
        .then_with(|| right.start_ordinal.cmp(&left.start_ordinal))
}

fn section_bucket_rank(record_type: &str) -> i32 {
    if record_type == "employment" {
        0
    } else {
        1
    }
}

fn record_recency(record: &CareerLibraryExportRecord) -> RecordRecency {
    let end_date = normalize_optional_string(&record.end_date);
    let start_date = normalize_optional_string(&record.start_date);
    RecordRecency {
        is_open_ended: is_open_ended(&end_date),
        end_ordinal: if is_open_ended(&end_date) {
            0
        } else {
            latest_date_ordinal(&end_date)
        },
        start_ordinal: latest_date_ordinal(&start_date),
    }
}

fn is_open_ended(value: &str) -> bool {
    OPEN_ENDED_MARKERS.contains(&value.trim().to_lowercase().as_str())
}

fn latest_date_ordinal(value: &str) -> i32 {
    let trimmed = value.trim();
    if trimmed.is_empty() || is_open_ended(trimmed) {
        return 0;
    }
    let parts = trimmed.split('-').collect::<Vec<_>>();
    if parts.is_empty() || parts.len() > 3 || parts.iter().any(|part| part.parse::<i32>().is_err())
    {
        return 0;
    }
    let year = parts[0].parse::<i32>().unwrap_or(0);
    let month = if parts.len() >= 2 {
        parts[1].parse::<i32>().unwrap_or(12)
    } else {
        12
    };
    if !(1..=12).contains(&month) {
        return 0;
    }
    let day = if parts.len() == 3 {
        parts[2].parse::<i32>().unwrap_or(31)
    } else {
        days_in_month(year, month)
    };
    if day < 1 || day > days_in_month(year, month) {
        return 0;
    }
    year * 10_000 + month * 100 + day
}

fn days_in_month(year: i32, month: i32) -> i32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if is_leap_year(year) {
                29
            } else {
                28
            }
        }
        _ => 0,
    }
}

fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

fn normalize_claim_text(text: &str) -> String {
    normalize_whitespace(text)
        .trim_matches(|char: char| char == ' ' || char == ';')
        .to_string()
}

fn truncate_text(text: &str, max_chars: u32) -> String {
    let text = normalize_claim_text(text);
    if max_chars == 0 || text.is_empty() {
        return String::new();
    }

    let max_chars = max_chars as usize;
    if text.chars().count() <= max_chars {
        return text;
    }

    let mut cutoff = text.chars().take(max_chars).collect::<String>();
    cutoff = cutoff.trim_end().to_string();
    if let Some(index) = cutoff.rfind(' ') {
        cutoff.truncate(index);
    }
    let mut trimmed = cutoff
        .trim_end_matches(|char: char| matches!(char, ' ' | ',' | ';' | ':' | '.'))
        .to_string();
    if trimmed.is_empty() {
        trimmed = text
            .chars()
            .take(max_chars)
            .collect::<String>()
            .trim_end_matches(|char: char| matches!(char, ' ' | ',' | ';' | ':' | '.'))
            .to_string();
    }
    if trimmed.is_empty() {
        return String::new();
    }
    format!("{trimmed}.")
}

fn normalize_optional_string(value: &Option<String>) -> String {
    value
        .as_deref()
        .map(normalize_whitespace)
        .unwrap_or_default()
}

fn sorted_unique_strings(values: Vec<String>) -> Vec<String> {
    values
        .into_iter()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::build_policy::parse_build_policy_value;
    use crate::bundle_prep::prepare_resume_bundle;
    use crate::candidate_profile::{
        CandidateCertificationEntry, CandidateContact, CandidateEducationEntry,
        CandidateEducationFieldNotes, CandidateIdentity, CandidateProfile, CandidateStaticSections,
    };
    use crate::library_export::{
        CareerLibraryExport, CareerLibraryExportEvidenceItem, CareerLibraryExportMeta,
        CareerLibraryExportRecord,
    };
    use crate::preflight_filter::run_preflight_filter;
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

    fn evidence(
        evidence_id: &str,
        record_id: &str,
        claim: &str,
        tags: &[&str],
    ) -> CareerLibraryExportEvidenceItem {
        CareerLibraryExportEvidenceItem {
            id: evidence_id.to_string(),
            experience_record_id: record_id.to_string(),
            claim: claim.to_string(),
            date_range: None,
            tags: tags.iter().map(|tag| tag.to_string()).collect(),
            scope_context: Some(serde_json::json!({})),
            evidence_note: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
        }
    }

    fn record(
        record_id: &str,
        record_type: &str,
        title: &str,
        start_date: &str,
        end_date: &str,
        context_tags: &[&str],
        evidence_items: Vec<CareerLibraryExportEvidenceItem>,
    ) -> CareerLibraryExportRecord {
        CareerLibraryExportRecord {
            id: record_id.to_string(),
            slug: format!("slug-{record_id}"),
            record_type: record_type.to_string(),
            organization: format!("Org {record_id}"),
            title: title.to_string(),
            start_date: Some(start_date.to_string()),
            end_date: Some(end_date.to_string()),
            location: if record_type == "employment" {
                Some("Remote".to_string())
            } else {
                None
            },
            employment_type: None,
            context_tags: context_tags.iter().map(|tag| tag.to_string()).collect(),
            canonical_scope_summary: None,
            common_context: Some(serde_json::json!({})),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            evidence: evidence_items,
        }
    }

    fn export(records: Vec<CareerLibraryExportRecord>) -> CareerLibraryExport {
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

    fn candidate_profile() -> CandidateProfile {
        CandidateProfile {
            version: "1.0".to_string(),
            config_type: "candidate_profile".to_string(),
            candidate_identity: CandidateIdentity {
                display_name: "Test User".to_string(),
                location: "Remote".to_string(),
                contact: CandidateContact {
                    email: Some("test@example.com".to_string()),
                    phone: Some("555-0100".to_string()),
                    linkedin: Some("linkedin/test".to_string()),
                    github: Some("github/test".to_string()),
                },
            },
            static_sections: CandidateStaticSections {
                education: vec![CandidateEducationEntry {
                    id: "edu-1".to_string(),
                    institution: "School".to_string(),
                    credential: "BBA".to_string(),
                    signal_tags: vec!["degree".to_string()],
                    field_notes: CandidateEducationFieldNotes::default(),
                }],
                certifications: vec![CandidateCertificationEntry {
                    id: "cert-1".to_string(),
                    name: "Cert".to_string(),
                    issuer: "Issuer".to_string(),
                    credential_detail: "Detail".to_string(),
                    signal_tags: vec!["python".to_string()],
                }],
                profile_summary_seed: vec![
                    "Built CLI tooling for deterministic exports.".to_string()
                ],
            },
        }
    }

    fn build_policy(threshold: f64) -> BuildPolicy {
        parse_build_policy_value(&json!({
            "policy_type": "resume_build_policy",
            "include_projects": true,
            "max_bullets_per_role": 2,
            "max_project_bullets": 2,
            "max_projects": 4,
            "preflight": {
                "threshold": threshold,
                "fallback_min_records": 1
            },
            "assembler_strategy": {
                "max_highlights": 4,
                "bullet_max_chars": 80,
                "highlight_max_chars": 80,
                "profile_max_chars": 80,
                "coverage_first_highlights": true,
                "coverage_first_profile_tiebreak": true,
                "allow_multi_evidence_sections": ["highlights", "profile"],
                "tag_weight": 0.875,
                "density_weight": 0.125
            }
        }))
        .unwrap()
    }

    fn base_bundle() -> ResumeBundleInput {
        let conn = setup_conn();
        let job_posting_text = [
            "Requirements:",
            "- Build deterministic Python automation workflows.",
            "- Maintain automation support documentation.",
            "- Own enterprise architecture strategy.",
        ]
        .join("\n");
        let library_export = export(vec![
            record(
                "rec-current",
                "employment",
                "Analyst",
                "2024-01",
                "present",
                &["python", "automation"],
                vec![
                    evidence(
                        "ev-2",
                        "rec-current",
                        "Automated the release checklist across teams.",
                        &["python"],
                    ),
                    evidence(
                        "ev-1",
                        "rec-current",
                        "Built CLI tooling for deterministic exports.",
                        &["python", "automation"],
                    ),
                ],
            ),
            record(
                "rec-older",
                "employment",
                "Coordinator",
                "2021-01",
                "2023-12",
                &["python"],
                vec![evidence(
                    "ev-3",
                    "rec-older",
                    "Documented rollout procedures for system changes.",
                    &["python"],
                )],
            ),
            record(
                "rec-project",
                "project",
                "Project",
                "2025-01",
                "present",
                &["json", "traceability"],
                vec![
                    evidence(
                        "ev-4",
                        "rec-project",
                        "Built traceability tooling for claim audits.",
                        &["json", "traceability"],
                    ),
                    evidence(
                        "ev-5",
                        "rec-project",
                        "Created test fixtures for deterministic outputs.",
                        &["json"],
                    ),
                ],
            ),
        ]);
        let profile = candidate_profile();
        let analysis = build_requirement_analysis(&conn, &job_posting_text).unwrap();
        let preflight = run_preflight_filter(&library_export, &analysis, 0.0, 1).unwrap();

        prepare_resume_bundle(
            &conn,
            &profile,
            &preflight.career_library_export,
            &build_policy(0.0),
            &job_posting_text,
            &analysis,
            &preflight.preflight_report,
        )
        .unwrap()
    }

    #[test]
    fn rank_evidence_uses_score_then_id_tie_break() {
        let bundle = base_bundle();
        let context = build_selection_context(&bundle).unwrap();
        let strategy = &bundle.build_policy.assembler_strategy;
        let record = CareerLibraryExportRecord {
            id: "rec-tie".to_string(),
            slug: "slug-rec-tie".to_string(),
            record_type: "employment".to_string(),
            organization: "Org".to_string(),
            title: "Tie".to_string(),
            start_date: Some("2024-01".to_string()),
            end_date: Some("present".to_string()),
            location: Some("Remote".to_string()),
            employment_type: None,
            context_tags: vec!["python".to_string()],
            canonical_scope_summary: None,
            common_context: Some(serde_json::json!({})),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            evidence: vec![
                evidence(
                    "ev-2",
                    "rec-tie",
                    "Built deterministic tooling.",
                    &["python"],
                ),
                evidence(
                    "ev-1",
                    "rec-tie",
                    "Built deterministic tooling.",
                    &["python"],
                ),
            ],
        };

        let ranked = rank_evidence_for_record(&record, &context, strategy);
        assert_eq!(
            ranked
                .iter()
                .map(|item| item.evidence_id.as_str())
                .collect::<Vec<_>>(),
            vec!["ev-1", "ev-2"]
        );
    }

    #[test]
    fn profile_returns_supported_seed_when_exact_claim_matches() {
        let bundle = base_bundle();
        let context = build_selection_context(&bundle).unwrap();

        let profile =
            build_profile(&bundle, &context, &bundle.build_policy.assembler_strategy).unwrap();

        assert_eq!(profile.text, "Built CLI tooling for deterministic exports.");
        assert_eq!(profile.evidence_ids, vec!["ev-1", "ev-2"]);
    }

    #[test]
    fn highlights_prefer_requirement_breadth_when_flag_enabled() {
        let conn = setup_conn();
        let job_posting_text = [
            "Requirements:",
            "- Build Python automation workflows.",
            "- Maintain release documentation.",
        ]
        .join("\n");
        let library_export = export(vec![record(
            "rec-highlights",
            "employment",
            "Analyst",
            "2024-01",
            "present",
            &["python", "automation", "documentation"],
            vec![
                evidence(
                    "ev-1",
                    "rec-highlights",
                    "Built Python automation workflows for payroll controls.",
                    &["python", "automation"],
                ),
                evidence(
                    "ev-2",
                    "rec-highlights",
                    "Automated Python workflow handoffs across teams.",
                    &["python", "automation"],
                ),
                evidence(
                    "ev-3",
                    "rec-highlights",
                    "Maintain release documentation for automation cutovers.",
                    &["documentation"],
                ),
            ],
        )]);
        let analysis = build_requirement_analysis(&conn, &job_posting_text).unwrap();
        let preflight = run_preflight_filter(&library_export, &analysis, 0.0, 1).unwrap();
        let mut build_policy = build_policy(0.0);
        build_policy.assembler_strategy.max_highlights = 2;
        let bundle = prepare_resume_bundle(
            &conn,
            &candidate_profile(),
            &preflight.career_library_export,
            &build_policy,
            &job_posting_text,
            &analysis,
            &preflight.preflight_report,
        )
        .unwrap();
        let context = build_selection_context(&bundle).unwrap();

        let highlights = build_highlights(
            &bundle,
            &context,
            &bundle.build_policy.assembler_strategy,
            None,
        );

        assert_eq!(
            highlights
                .iter()
                .map(|item| item.text.as_str())
                .collect::<Vec<_>>(),
            vec![
                "Built Python automation workflows for payroll controls.",
                "Maintain release documentation for automation cutovers.",
            ]
        );
    }

    #[test]
    fn projects_bullets_always_use_single_evidence_id() {
        let bundle = base_bundle();
        let context = build_selection_context(&bundle).unwrap();

        let projects = build_projects(&bundle, &context, &bundle.build_policy.assembler_strategy);

        assert!(!projects.is_empty());
        for bullet in &projects[0].bullets {
            assert_eq!(bullet.evidence_ids.len(), 1);
        }
    }

    #[test]
    fn gap_report_supports_education_sources_without_evidence() {
        let conn = setup_conn();
        let job_posting_text = "Requirements:\n- Completed relevant degree.";
        let library_export = export(vec![]);
        let analysis = build_requirement_analysis(&conn, job_posting_text).unwrap();
        let preflight = run_preflight_filter(&library_export, &analysis, 0.0, 1).unwrap();
        let mut build_policy = build_policy(0.0);
        build_policy.assembler_strategy.max_highlights = 2;
        let bundle = prepare_resume_bundle(
            &conn,
            &candidate_profile(),
            &preflight.career_library_export,
            &build_policy,
            job_posting_text,
            &analysis,
            &preflight.preflight_report,
        )
        .unwrap();
        let context = build_selection_context(&bundle).unwrap();

        let gap_report = build_gap_report(&bundle, &BTreeSet::new(), &context);

        assert_eq!(
            gap_report.supported_requirements,
            vec![SupportedRequirement {
                requirement: "Completed relevant degree.".to_string(),
                supporting_sources: vec![SupportingSource {
                    source_type: "education".to_string(),
                    source_id: "edu-1".to_string(),
                }],
            }]
        );
    }

    #[test]
    fn assemble_resume_selected_ids_match_provenance() {
        let bundle = base_bundle();

        let result = assemble_resume(&bundle).unwrap();

        assert_eq!(
            result.artifact.provenance.selected_record_ids,
            result.selected_record_ids
        );
        assert_eq!(
            result.artifact.provenance.selected_evidence_ids,
            result.selected_evidence_ids
        );
        assert_eq!(
            result.artifact.resume.toolkit.as_ref().unwrap().label,
            "DELIVERY TOOLKIT"
        );
        assert!(result
            .artifact
            .gap_report
            .partially_supported_requirements
            .iter()
            .any(|item| item.limitation == PARTIAL_SUPPORT_LIMITATION));
    }
}
