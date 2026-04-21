use crate::taxonomy::{get_all_tag_inference_markers, get_canonical_tags, TagInferenceMarker};
use regex::Regex;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

const REQUIREMENT_ANALYSIS_VERSION: &str = "1.1";
const EXTRACTION_METHOD: &str = "posting_surface_terms_v1";
const REQUIREMENT_KIND_MUST_HAVE: &str = "must_have";
const REQUIREMENT_KIND_SHOULD_HAVE: &str = "should_have";
const REQUIREMENT_KIND_NICE_TO_HAVE: &str = "nice_to_have";
const HEADING_DECAY_THRESHOLD: u32 = 3;

const NEGATION_CUES: &[&str] = &[
    "not", "no", "without", "never",
    "lacks", "lack", "lacking",
    "don't", "don\u{2019}t",
    "doesn't", "doesn\u{2019}t",
    "isn't", "isn\u{2019}t",
    "won't", "won\u{2019}t",
    "aren't", "aren\u{2019}t",
];

const STOPWORDS: &[&str] = &[
    "a", "about", "all", "also", "an", "and", "any", "are", "as", "at", "be", "been", "both",
    "but", "by", "can", "could", "did", "does", "each", "for", "from", "has", "have", "how", "if",
    "in", "into", "is", "it", "its", "just", "may", "more", "most", "not", "of", "on", "only",
    "or", "other", "our", "own", "should", "some", "such", "than", "that", "the", "their", "these",
    "they", "this", "those", "to", "using", "very", "we", "what", "when", "where", "which", "who",
    "will", "with", "would", "you", "your",
];

pub const GENERIC_SURFACE_TERMS: &[&str] = &[
    "ability",
    "advanced",
    "business",
    "capabilities",
    "completed",
    "equivalent",
    "experience",
    "including",
    "intermediate",
    "knowledge",
    "management",
    "minimum",
    "ongoing",
    "position",
    "professional",
    "required",
    "requirements",
    "responsibilities",
    "role",
    "skills",
    "strong",
    "support",
    "systems",
    "technical",
    "understanding",
    "work",
    "years",
];

const HEADING_TERMS: &[&str] = &[
    "position summary",
    "position responsibilities",
    "position qualifications",
    "qualifications",
    "requirements",
    "responsibilities",
    "key responsibilities",
    "experience",
    "education and/or professional designation",
    "experience and technical skills/knowledge",
    "experience and technical skills",
    "other",
];

const MUST_HAVE_HEADINGS: &[&str] = &[
    "requirements",
    "qualifications",
    "experience",
    "position qualifications",
    "experience and technical skills",
    "experience and technical skills/knowledge",
];

const PREAMBLE_HEADINGS: &[&str] = &[
    "about us",
    "about the company",
    "about the organization",
    "about the team",
    "about our",
    "company overview",
    "company description",
    "company profile",
    "who we are",
    "our mission",
    "our values",
    "our culture",
    "our story",
    "what we offer",
    "what we do",
    "what we provide",
    "benefits",
    "compensation",
    "perks",
    "equal opportunity",
    "equal employment",
    "eeo",
    "diversity",
    "diversity and inclusion",
    "diversity & inclusion",
    "how to apply",
    "application process",
    "application instructions",
];

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct UnrecognizedNotableTerm {
    pub term: String,
    pub count: u32,
}

/// A surface term extracted from requirement text, tagged with whether it
/// appeared inside a local negation window. Polarity is determined per
/// occurrence using the same 3-word lookbehind as `is_negated_signal`; when
/// the same normalized term appears multiple times within one extraction,
/// any asserted (non-negated) occurrence wins (`is_negated = false`).
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ExtractedTerm {
    pub term: String,
    #[serde(default)]
    pub is_negated: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct RequirementAnalysisSource {
    pub job_posting_sha256: String,
    pub job_posting_length: usize,
    pub target_role_family: String,
    pub posting_keyword_bank: Vec<String>,
    pub unrecognized_notable_terms: Vec<UnrecognizedNotableTerm>,
    pub extraction_method: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct RequirementCluster {
    pub cluster_id: String,
    pub label: String,
    pub kind: String,
    pub priority_rank: u32,
    pub atom_ids: Vec<String>,
    #[serde(default)]
    pub matched_tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ExperienceYears {
    pub min_years: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_years: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct RequirementAtom {
    pub requirement_id: String,
    pub cluster_id: String,
    pub text: String,
    pub kind: String,
    pub priority_rank: u32,
    pub source_order: u32,
    #[serde(default)]
    pub normalized_terms: Vec<ExtractedTerm>,
    #[serde(default)]
    pub matched_tags: Vec<String>,
    pub experience_years: Option<ExperienceYears>,
    pub has_quantifier: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub merged_from: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct RequirementAnalysis {
    pub analysis_version: String,
    pub source: RequirementAnalysisSource,
    pub clusters: Vec<RequirementCluster>,
    pub atoms: Vec<RequirementAtom>,
}

#[derive(Debug, Clone)]
struct RuntimeTaxonomyAnalysisContext {
    canonical_tag_set: HashSet<String>,
    markers_by_tag: Vec<(String, Vec<TagInferenceMarker>)>,
    /// Normalized surface forms of all inference marker terms (literal values
    /// and compound all_of/any_of terms). Used to suppress suggested-term
    /// prompts for surface strings already captured by the marker inventory.
    marker_term_set: HashSet<String>,
}

#[derive(Debug, Clone)]
struct RequirementUnit {
    source_order: u32,
    heading: String,
    text: String,
}

pub fn build_requirement_analysis(
    conn: &Connection,
    job_posting_text: &str,
) -> Result<RequirementAnalysis, String> {
    let taxonomy = load_runtime_taxonomy_analysis_context(conn)?;
    let cleaned_posting_text = job_posting_text.to_string();
    let requirement_units = split_posting_into_requirement_units(&cleaned_posting_text);
    let (clusters, atoms) = cluster_requirement_atoms(&requirement_units, &taxonomy);
    let (clusters, atoms) = deduplicate_atoms(clusters, atoms);
    let role_family = derive_role_family(&cleaned_posting_text);
    let posting_keyword_bank = build_posting_keyword_bank(&atoms);
    let unrecognized_notable_terms = collect_unrecognized_notable_terms(&atoms, &taxonomy);

    Ok(RequirementAnalysis {
        analysis_version: REQUIREMENT_ANALYSIS_VERSION.to_string(),
        source: RequirementAnalysisSource {
            job_posting_sha256: stable_sha256_text(&cleaned_posting_text),
            job_posting_length: cleaned_posting_text.len(),
            target_role_family: role_family,
            posting_keyword_bank,
            unrecognized_notable_terms,
            extraction_method: EXTRACTION_METHOD.to_string(),
        },
        clusters,
        atoms,
    })
}

pub fn normalize_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub fn normalize_surface_term(value: &str) -> String {
    word_regex()
        .find_iter(&normalize_whitespace(value).to_lowercase())
        .map(|capture| capture.as_str())
        .collect::<Vec<_>>()
        .join("_")
}

pub fn normalize_semantic_tag(value: &str) -> String {
    let normalized = normalize_whitespace(value).to_lowercase();
    if normalized.is_empty() {
        return String::new();
    }
    non_word_regex()
        .split(&normalized.replace('_', " "))
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("_")
}

fn load_runtime_taxonomy_analysis_context(
    conn: &Connection,
) -> Result<RuntimeTaxonomyAnalysisContext, String> {
    let canonical_tags = get_canonical_tags(conn)?;
    let mut canonical_tag_set = HashSet::new();
    let mut markers_by_tag = Vec::new();
    let mut marker_term_set = HashSet::new();
    let markers = get_all_tag_inference_markers(conn)?;
    let mut grouped_markers: HashMap<String, Vec<TagInferenceMarker>> = HashMap::new();
    for marker in markers {
        // Collect normalized surface forms of every marker term so we can
        // suppress them from the "suggested taxonomy terms" list later.
        match marker.marker_kind.as_str() {
            "literal" => {
                if let Some(literal) = &marker.literal_value {
                    let normalized = normalize_surface_term(literal);
                    if !normalized.is_empty() {
                        marker_term_set.insert(normalized);
                    }
                }
            }
            "compound" => {
                for term in &marker.terms {
                    let normalized = normalize_surface_term(&term.term_value);
                    if !normalized.is_empty() {
                        marker_term_set.insert(normalized);
                    }
                }
            }
            _ => {}
        }
        grouped_markers
            .entry(marker.canonical_tag.clone())
            .or_default()
            .push(marker);
    }

    for canonical_tag in canonical_tags {
        canonical_tag_set.insert(canonical_tag.tag.clone());
        if let Some(tag_markers) = grouped_markers.remove(&canonical_tag.tag) {
            markers_by_tag.push((canonical_tag.tag, tag_markers));
        }
    }

    Ok(RuntimeTaxonomyAnalysisContext {
        canonical_tag_set,
        markers_by_tag,
        marker_term_set,
    })
}

/// Public surface-term extractor. Used by callers (e.g. evidence text in
/// `resume_assembler`) that have no negation context worth preserving;
/// returns bare term strings by stripping polarity.
pub fn extract_surface_terms(text: &str) -> Vec<String> {
    extract_surface_terms_with_max_ngram(text, 3)
        .into_iter()
        .map(|et| et.term)
        .collect()
}

fn extract_surface_terms_with_max_ngram(text: &str, max_ngram: usize) -> Vec<ExtractedTerm> {
    let cleaned_text = normalize_whitespace(text);
    if cleaned_text.is_empty() {
        return Vec::new();
    }

    let lowered = cleaned_text.to_lowercase();
    let mut index_by_normalized: HashMap<String, usize> = HashMap::new();
    let mut ordered: Vec<ExtractedTerm> = Vec::new();

    // Insert (or relax polarity of) a normalized term anchored at byte
    // `anchor` within `source_text`. Asserted-occurrence-wins: if any
    // emission of a given normalized term is non-negated, the stored entry
    // becomes non-negated. Implemented as a free fn (not closure) to avoid
    // borrow-checker headaches around the shared mutable state.
    fn record_term(
        raw_value: &str,
        source_text: &str,
        anchor: usize,
        ordered: &mut Vec<ExtractedTerm>,
        index_by_normalized: &mut HashMap<String, usize>,
    ) {
        let normalized = normalize_surface_term(raw_value);
        if normalized.is_empty() {
            return;
        }
        let is_neg = has_negation_cue_before(&source_text[..anchor]);
        if let Some(&idx) = index_by_normalized.get(&normalized) {
            if !is_neg {
                ordered[idx].is_negated = false;
            }
        } else {
            index_by_normalized.insert(normalized.clone(), ordered.len());
            ordered.push(ExtractedTerm {
                term: normalized,
                is_negated: is_neg,
            });
        }
    }

    // Credential patterns: each match site synthesizes one or more canonical
    // terms. Anchor all synthesized terms at the match start so they share
    // the same negation context.
    for (pattern, terms) in credential_patterns() {
        if let Some(matched) = pattern.find(&lowered) {
            for term in terms {
                record_term(
                    term,
                    &lowered,
                    matched.start(),
                    &mut ordered,
                    &mut index_by_normalized,
                );
            }
        }
    }

    // Title phrases: anchored in the original (mixed-case) cleaned text so
    // their byte offsets are valid for that string. `has_negation_cue_before`
    // lowercases the prefix internally, so case here doesn't matter.
    for capture in title_phrase_regex().find_iter(&cleaned_text) {
        let phrase = capture.as_str();
        if is_member(HEADING_TERMS, &phrase.to_lowercase()) {
            continue;
        }
        record_term(
            phrase,
            &cleaned_text,
            capture.start(),
            &mut ordered,
            &mut index_by_normalized,
        );
    }

    // Single words and n-grams: collect (word, byte_offset_in_lowered) so we
    // can compute negation per occurrence and per n-gram start position.
    let filtered_word_matches: Vec<(String, usize)> = word_regex()
        .find_iter(&lowered)
        .map(|m| (m.as_str().to_string(), m.start()))
        .filter(|(word, _)| word.len() >= 3 && !is_member(STOPWORDS, word))
        .collect();

    for (word, anchor) in &filtered_word_matches {
        record_term(
            word,
            &lowered,
            *anchor,
            &mut ordered,
            &mut index_by_normalized,
        );
    }

    for ngram_size in 2..=max_ngram {
        if filtered_word_matches.len() < ngram_size {
            continue;
        }

        for index in 0..=(filtered_word_matches.len() - ngram_size) {
            let phrase_window = &filtered_word_matches[index..index + ngram_size];
            if phrase_window
                .iter()
                .all(|(word, _)| is_member(GENERIC_SURFACE_TERMS, word))
            {
                continue;
            }

            let contiguous_phrase = phrase_window
                .iter()
                .map(|(word, _)| word.as_str())
                .collect::<Vec<_>>()
                .join(" ");
            if !lowered.contains(&contiguous_phrase) {
                continue;
            }

            // Anchor the n-gram at its first word's offset; the negation
            // lookbehind then scans the same window the phrase actually
            // occupies in the source.
            let anchor = phrase_window[0].1;
            let joined = phrase_window
                .iter()
                .map(|(word, _)| word.as_str())
                .collect::<Vec<_>>()
                .join("_");
            record_term(
                &joined,
                &lowered,
                anchor,
                &mut ordered,
                &mut index_by_normalized,
            );
        }
    }

    ordered
}

fn extract_requirement_terms(
    text: &str,
    taxonomy: &RuntimeTaxonomyAnalysisContext,
) -> (Vec<ExtractedTerm>, Vec<String>) {
    let mut surface_terms = extract_surface_terms_with_max_ngram(text, 3);
    let mut matched_tags = Vec::new();
    let mut seen_tags = HashSet::new();

    let normalized_text = normalize_whitespace(text).to_lowercase();

    // Atom-level negation fallback: per-occurrence lookbehind cannot see
    // trailing negation cues like "Python experience not required" (where
    // "not" comes after the term). If the requirement's own classification
    // signal word (strong-modal or nice-to-have) is itself negated by the
    // existing `is_negated_signal` rule, the whole atom is a negative
    // requirement: flip every surface term and skip tag inference entirely.
    // No positive tag (canonical or marker-driven) should fire from a
    // requirement that says "X is not required" / "no X needed".
    let atom_negated = is_negated_signal(&normalized_text, requirement_strong_modal_regex())
        || is_negated_signal(&normalized_text, requirement_nice_to_have_regex());
    if atom_negated {
        for entry in &mut surface_terms {
            entry.is_negated = true;
        }
        return (surface_terms, matched_tags);
    }

    // Surface-term-driven canonical tag matching: skip negated occurrences so
    // that "lacks Python experience" does not light up the `python` tag.
    for surface_term in &surface_terms {
        if surface_term.is_negated {
            continue;
        }
        if taxonomy.canonical_tag_set.contains(&surface_term.term)
            && seen_tags.insert(surface_term.term.clone())
        {
            matched_tags.push(surface_term.term.clone());
        }
    }

    let word_set = word_regex()
        .find_iter(&normalized_text)
        .map(|capture| capture.as_str().to_string())
        .collect::<HashSet<_>>();

    // Marker-driven canonical tag matching: each marker term must occur in a
    // non-negated context (3-word lookbehind) for the marker to fire. This
    // keeps polarity consistent with the surface-term loop above; without it,
    // "no kubernetes experience" would still infer `kubernetes` via a
    // `k8s|kubernetes` literal marker.
    for (canonical_tag, markers) in &taxonomy.markers_by_tag {
        if markers
            .iter()
            .any(|marker| tag_marker_matches_for_posting(marker, &normalized_text, &word_set))
            && seen_tags.insert(canonical_tag.clone())
        {
            matched_tags.push(canonical_tag.clone());
        }
    }

    (surface_terms, matched_tags)
}

fn build_posting_keyword_bank(atoms: &[RequirementAtom]) -> Vec<String> {
    let mut ordered = Vec::new();
    let mut seen = HashSet::new();

    for atom in atoms {
        for matched_tag in &atom.matched_tags {
            if seen.insert(matched_tag.clone()) {
                ordered.push(matched_tag.clone());
            }
        }
    }

    ordered
}

fn collect_unrecognized_notable_terms(
    atoms: &[RequirementAtom],
    taxonomy: &RuntimeTaxonomyAnalysisContext,
) -> Vec<UnrecognizedNotableTerm> {
    let mut counts: HashMap<String, u32> = HashMap::new();

    for atom in atoms {
        for entry in &atom.normalized_terms {
            // Negated terms are not positive signals — they must never
            // surface in the suggested-taxonomy-terms UI.
            if entry.is_negated {
                continue;
            }
            let value = &entry.term;
            if value.is_empty()
                || taxonomy.canonical_tag_set.contains(value)
                || taxonomy.marker_term_set.contains(value)
                || is_member(GENERIC_SURFACE_TERMS, value)
            {
                continue;
            }
            *counts.entry(value.clone()).or_insert(0) += 1;
        }
    }

    let mut entries = counts
        .into_iter()
        .filter(|(_, count)| *count >= 2)
        .map(|(term, count)| UnrecognizedNotableTerm { term, count })
        .collect::<Vec<_>>();

    entries.sort_by(|left, right| {
        right
            .count
            .cmp(&left.count)
            .then_with(|| left.term.cmp(&right.term))
    });
    entries
}

fn derive_role_family(job_posting_text: &str) -> String {
    let cleaned_text = normalize_whitespace(job_posting_text);
    if cleaned_text.is_empty() {
        return "Role From Posting".to_string();
    }

    if let Some(candidate) = extract_labeled_role(&cleaned_text, "title") {
        return truncate_chars(&candidate, 120);
    }
    if let Some(candidate) = extract_labeled_role(&cleaned_text, "position") {
        return truncate_chars(&candidate, 120);
    }

    for pattern in role_family_patterns() {
        if let Some(captures) = pattern.captures(&cleaned_text) {
            if let Some(matched) = captures.get(1) {
                let candidate = trim_role_candidate(matched.as_str());
                if !candidate.is_empty() {
                    return truncate_chars(&candidate, 120);
                }
            }
        }
    }

    let normalized_lines = job_posting_text.replace("\r\n", "\n").replace('\r', "\n");
    let mut candidate_lines = 0;
    for raw_line in normalized_lines.split('\n') {
        let line = normalize_whitespace(raw_line);
        let lowered = line.to_lowercase();
        let heading_key = lowered.trim_end_matches(':').to_string();
        if line.is_empty() || is_member(HEADING_TERMS, &heading_key) {
            continue;
        }
        candidate_lines += 1;
        if candidate_lines > 10 {
            break;
        }
        if role_suffix_regex().is_match(&line) {
            return truncate_chars(&trim_role_candidate(&line), 120);
        }
    }

    for raw_line in normalized_lines.split('\n') {
        let line = normalize_whitespace(raw_line);
        let lowered = line.to_lowercase();
        let heading_key = lowered.trim_end_matches(':').to_string();
        if line.is_empty() || is_member(HEADING_TERMS, &heading_key) {
            continue;
        }
        if line.split_whitespace().count() > 10 || is_preamble_line(&line) {
            continue;
        }
        return truncate_chars(&trim_role_candidate(&line), 120);
    }

    "Role From Posting".to_string()
}

fn split_posting_into_requirement_units(job_posting_text: &str) -> Vec<RequirementUnit> {
    let mut units = Vec::new();
    let mut current_heading = String::new();
    let mut source_order: u32 = 1;
    let mut in_preamble = false;

    let normalized_text = job_posting_text.replace("\r\n", "\n").replace('\r', "\n");
    for raw_line in normalized_text.split('\n') {
        let line = normalize_whitespace(raw_line);
        if line.is_empty() {
            continue;
        }
        if is_preamble_heading(&line) {
            in_preamble = true;
            continue;
        }
        if is_requirement_heading(&line) {
            in_preamble = false;
            current_heading = line.trim_end_matches(':').to_string();
            continue;
        }
        if in_preamble || line.trim_end().ends_with('?') {
            continue;
        }

        let candidate_fragments = if requirement_bullet_prefix_regex().is_match(&line) {
            vec![requirement_bullet_prefix_regex()
                .replace(&line, "")
                .trim()
                .to_string()]
        } else if line.len() > 120 {
            split_requirement_fragments(&line)
        } else {
            vec![line.clone()]
        };

        for fragment in candidate_fragments.into_iter().flat_map(|f| split_mixed_modality(&f)) {
            let cleaned = normalize_whitespace(&fragment)
                .trim_matches(|character: char| matches!(character, ' ' | '-' | ':' | ';'))
                .to_string();
            if cleaned.is_empty() || cleaned.split_whitespace().count() < 3 {
                continue;
            }
            if is_requirement_heading(&cleaned) {
                current_heading = cleaned.trim_end_matches(':').to_string();
                continue;
            }
            units.push(RequirementUnit {
                source_order,
                heading: current_heading.clone(),
                text: cleaned,
            });
            source_order += 1;
        }
    }

    units
}

/// Returns true if the 3-word window ending at the end of `prefix` contains
/// a negation cue. Lowercases internally so callers may pass mixed-case text.
fn has_negation_cue_before(prefix: &str) -> bool {
    let lowered = prefix.to_lowercase();
    let words: Vec<&str> = lowered.split_whitespace().collect();
    let window = &words[words.len().saturating_sub(3)..];
    window.iter().any(|word| NEGATION_CUES.contains(word))
}

/// Returns true if the first match of `pattern` in `text` is preceded (within
/// a 3-word window) by a negation cue like "not", "no", "without", etc.
/// Expects `text` to already be lowercased.
fn is_negated_signal(text: &str, pattern: &Regex) -> bool {
    let Some(matched) = pattern.find(text) else {
        return false;
    };
    has_negation_cue_before(&text[..matched.start()])
}

fn classify_requirement_kind(text: &str, heading: &str) -> String {
    let normalized_text = normalize_whitespace(text).to_lowercase();
    let normalized_heading = normalize_whitespace(heading)
        .trim_end_matches(':')
        .to_lowercase();

    // Nice-to-have: skip if the signal word is negated
    // ("not a nice to have" should fall through, not classify as nice_to_have)
    if requirement_nice_to_have_regex().is_match(&normalized_text)
        && !is_negated_signal(&normalized_text, requirement_nice_to_have_regex())
    {
        return REQUIREMENT_KIND_NICE_TO_HAVE.to_string();
    }

    // Must-have from heading: section context is not affected by per-line negation
    if is_member(MUST_HAVE_HEADINGS, &normalized_heading) {
        return REQUIREMENT_KIND_MUST_HAVE.to_string();
    }

    // Must-have from regex: skip if the signal word is negated
    // ("degree not required" → should_have, not must_have)
    if requirement_strong_modal_regex().is_match(&normalized_text)
        && !is_negated_signal(&normalized_text, requirement_strong_modal_regex())
    {
        return REQUIREMENT_KIND_MUST_HAVE.to_string();
    }

    REQUIREMENT_KIND_SHOULD_HAVE.to_string()
}

fn cluster_requirement_atoms(
    requirement_units: &[RequirementUnit],
    taxonomy: &RuntimeTaxonomyAnalysisContext,
) -> (Vec<RequirementCluster>, Vec<RequirementAtom>) {
    let mut clusters = Vec::new();
    let mut atoms = Vec::new();
    let mut cluster_index_by_key = HashMap::new();
    let mut heading_soft_streak: HashMap<String, u32> = HashMap::new();
    let mut heading_decayed: HashMap<String, bool> = HashMap::new();

    for (unit_index, unit) in requirement_units.iter().enumerate() {
        let text = normalize_whitespace(&unit.text);
        let heading = normalize_whitespace(&unit.heading);
        let source_order = if unit.source_order > 0 {
            unit.source_order
        } else {
            (unit_index + 1) as u32
        };
        let (normalized_terms, matched_tags) = extract_requirement_terms(&text, taxonomy);

        // Heading decay: suppress heading boost when consecutive lines carry
        // un-negated soft signals (preferred/bonus/etc), indicating the section
        // has drifted away from must-have territory. A hard-signal line (e.g.
        // "required") resets the decay; a no-signal line preserves the current state.
        let normalized_heading_lower = normalize_whitespace(&heading)
            .trim_end_matches(':')
            .to_lowercase();
        let is_must_have_heading = is_member(MUST_HAVE_HEADINGS, &normalized_heading_lower);
        let effective_heading = if is_must_have_heading {
            let text_lower = text.to_lowercase();
            let line_has_soft_signal =
                requirement_nice_to_have_regex().is_match(&text_lower)
                    && !is_negated_signal(&text_lower, requirement_nice_to_have_regex());
            let line_has_hard_signal =
                requirement_strong_modal_regex().is_match(&text_lower)
                    && !is_negated_signal(&text_lower, requirement_strong_modal_regex());

            let streak = heading_soft_streak.entry(heading.clone()).or_insert(0);
            let decayed = heading_decayed.entry(heading.clone()).or_insert(false);

            if line_has_soft_signal {
                *streak += 1;
                if *streak >= HEADING_DECAY_THRESHOLD {
                    *decayed = true;
                }
            } else if line_has_hard_signal {
                // Hard signal resets the decay — this line clearly belongs to the heading
                *streak = 0;
                *decayed = false;
            }
            // No-signal lines: leave streak and decayed unchanged

            if *decayed {
                String::new()
            } else {
                heading.clone()
            }
        } else {
            heading.clone()
        };

        let kind = classify_requirement_kind(&text, &effective_heading);
        let kind_priority_rank = priority_rank(&kind);

        let (cluster_key, cluster_label) = if !heading.is_empty() {
            let normalized = normalize_semantic_tag(&heading);
            let key = if normalized.is_empty() {
                "general_requirements".to_string()
            } else {
                normalized
            };
            (key, heading.clone())
        } else if let Some(first_tag) = matched_tags.first() {
            (first_tag.clone(), humanize_requirement_tag(first_tag))
        } else {
            (
                "general_requirements".to_string(),
                "General Requirements".to_string(),
            )
        };

        let cluster_index = if let Some(existing_index) = cluster_index_by_key.get(&cluster_key) {
            *existing_index
        } else {
            let new_index = clusters.len();
            cluster_index_by_key.insert(cluster_key.clone(), new_index);
            clusters.push(RequirementCluster {
                cluster_id: format!("cluster_{:03}", new_index + 1),
                label: cluster_label,
                kind: kind.clone(),
                priority_rank: kind_priority_rank,
                atom_ids: Vec::new(),
                matched_tags: matched_tags.clone(),
            });
            new_index
        };

        {
            let cluster = &mut clusters[cluster_index];
            if priority_rank(&cluster.kind) > kind_priority_rank {
                cluster.kind = kind.clone();
            }
            cluster.priority_rank = cluster.priority_rank.min(kind_priority_rank);
            for matched_tag in &matched_tags {
                if !cluster.matched_tags.contains(matched_tag) {
                    cluster.matched_tags.push(matched_tag.clone());
                }
            }
        }

        let requirement_id = format!("req_{:03}", atoms.len() + 1);
        let atom = RequirementAtom {
            requirement_id: requirement_id.clone(),
            cluster_id: clusters[cluster_index].cluster_id.clone(),
            text: text.clone(),
            kind: kind.clone(),
            priority_rank: kind_priority_rank,
            source_order,
            normalized_terms,
            matched_tags,
            experience_years: extract_experience_years(&text),
            has_quantifier: has_quantifier(&text),
            subject: extract_requirement_subject(&text),
            merged_from: None,
        };
        atoms.push(atom);
        clusters[cluster_index].atom_ids.push(requirement_id);
    }

    (clusters, atoms)
}

fn deduplicate_atoms(
    mut clusters: Vec<RequirementCluster>,
    atoms: Vec<RequirementAtom>,
) -> (Vec<RequirementCluster>, Vec<RequirementAtom>) {
    if atoms.is_empty() {
        return (clusters, atoms);
    }

    let mut groups: Vec<Vec<RequirementAtom>> = Vec::new();
    let mut group_index_by_key: HashMap<String, usize> = HashMap::new();
    for atom in atoms {
        let key = dedup_key(&atom);
        if let Some(index) = group_index_by_key.get(&key) {
            groups[*index].push(atom);
        } else {
            let new_index = groups.len();
            group_index_by_key.insert(key, new_index);
            groups.push(vec![atom]);
        }
    }

    let mut merged_atoms = Vec::new();
    let mut old_to_new_id = HashMap::new();

    for mut group in groups {
        group.sort_by(|left, right| {
            left.priority_rank
                .cmp(&right.priority_rank)
                .then_with(|| left.source_order.cmp(&right.source_order))
        });

        let mut survivor = group[0].clone();
        if group.len() > 1 {
            let mut all_terms = survivor.normalized_terms.clone();
            // Dedup by (term, is_negated) so polarity is preserved across
            // merged atoms: an asserted `python` and a negated `python` from
            // two sibling lines remain as two distinct entries.
            let mut seen_terms = all_terms
                .iter()
                .map(|et| (et.term.clone(), et.is_negated))
                .collect::<HashSet<_>>();
            let mut all_tags = survivor.matched_tags.clone();
            let mut seen_tags = all_tags.iter().cloned().collect::<HashSet<_>>();
            let mut merged_texts = Vec::new();

            for other in group.iter().skip(1) {
                merged_texts.push(other.text.clone());
                for term in &other.normalized_terms {
                    if seen_terms.insert((term.term.clone(), term.is_negated)) {
                        all_terms.push(term.clone());
                    }
                }
                for tag in &other.matched_tags {
                    if seen_tags.insert(tag.clone()) {
                        all_tags.push(tag.clone());
                    }
                }
                if priority_rank(&other.kind) < priority_rank(&survivor.kind) {
                    survivor.kind = other.kind.clone();
                    survivor.priority_rank = other.priority_rank;
                }
                if let Some(other_experience) = &other.experience_years {
                    match &survivor.experience_years {
                        Some(current) if current.min_years <= other_experience.min_years => {}
                        _ => survivor.experience_years = Some(other_experience.clone()),
                    }
                }
                if other.has_quantifier {
                    survivor.has_quantifier = true;
                }
                // Preserve subject from a merged atom if the survivor lacks one
                if survivor.subject.is_none() {
                    if let Some(ref subject) = other.subject {
                        survivor.subject = Some(subject.clone());
                    }
                }
            }

            survivor.normalized_terms = all_terms;
            survivor.matched_tags = all_tags;
            survivor.merged_from = Some(merged_texts);
        }

        let new_id = format!("req_{:03}", merged_atoms.len() + 1);
        for original in &group {
            old_to_new_id.insert(original.requirement_id.clone(), new_id.clone());
        }
        survivor.requirement_id = new_id;
        merged_atoms.push(survivor);
    }

    for cluster in &mut clusters {
        let mut new_ids = Vec::new();
        let mut seen = HashSet::new();
        for atom_id in &cluster.atom_ids {
            let new_id = old_to_new_id
                .get(atom_id)
                .cloned()
                .unwrap_or_else(|| atom_id.clone());
            if seen.insert(new_id.clone()) {
                new_ids.push(new_id);
            }
        }
        cluster.atom_ids = new_ids;
    }

    (clusters, merged_atoms)
}

fn extract_experience_years(text: &str) -> Option<ExperienceYears> {
    let captures = experience_years_regex().captures(text)?;
    let min_years = captures.get(1)?.as_str().parse::<u32>().ok()?;
    let max_years = captures
        .get(3)
        .and_then(|capture| capture.as_str().parse::<u32>().ok());
    Some(ExperienceYears {
        min_years,
        max_years,
    })
}

fn has_quantifier(text: &str) -> bool {
    quantifier_regex().is_match(text)
}

/// Extracts the noun-phrase subject of a requirement line by looking for
/// trailing signals ("Python experience is required") or leading signals
/// ("Must have 3+ years of AWS experience"). Returns a lowercased, trimmed
/// subject capped at 80 chars, or None if no recognizable pattern is found.
fn extract_requirement_subject(text: &str) -> Option<String> {
    static TRAILING_RE: OnceLock<Regex> = OnceLock::new();
    static LEADING_RE: OnceLock<Regex> = OnceLock::new();

    let trailing = TRAILING_RE.get_or_init(|| {
        Regex::new(
            r"(?i)(.+?)\s+(?:(?:is|are|would\s+be)\s+)?(?:required|preferred|needed|a\s+must|a\s+plus|an\s+asset)\b",
        )
        .unwrap()
    });
    let leading = LEADING_RE.get_or_init(|| {
        Regex::new(
            r"(?i)(?:must\s+have\s+|minimum\s+of\s+|at\s+least\s+|required\s*:\s*)(.+?)(?:[.,;]|$)",
        )
        .unwrap()
    });

    // Try trailing pattern first ("Python experience is required")
    if let Some(captures) = trailing.captures(text) {
        if let Some(subject) = captures.get(1) {
            let trimmed = subject.as_str().trim();
            if !trimmed.is_empty() && trimmed.split_whitespace().count() <= 12 {
                return Some(truncate_chars(&trimmed.to_lowercase(), 80));
            }
        }
    }

    // Try leading pattern ("Must have 3+ years of Python")
    if let Some(captures) = leading.captures(text) {
        if let Some(subject) = captures.get(1) {
            let trimmed = subject.as_str().trim();
            if !trimmed.is_empty() && trimmed.split_whitespace().count() <= 12 {
                return Some(truncate_chars(&trimmed.to_lowercase(), 80));
            }
        }
    }

    None
}

fn stable_sha256_text(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn humanize_requirement_tag(tag: &str) -> String {
    if tag.is_empty() {
        return "General Requirements".to_string();
    }
    tag.split('_')
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_requirement_heading(line: &str) -> bool {
    let cleaned = normalize_whitespace(line)
        .trim_end_matches(':')
        .to_lowercase();
    if cleaned.is_empty() {
        return false;
    }
    if is_member(HEADING_TERMS, &cleaned) {
        return true;
    }
    let stripped = normalize_whitespace(line);
    stripped.ends_with(':') && cleaned.split_whitespace().count() <= 6
}

fn is_preamble_heading(line: &str) -> bool {
    let cleaned = normalize_whitespace(line)
        .trim_end_matches(':')
        .trim()
        .to_lowercase();
    if cleaned.is_empty() {
        return false;
    }
    PREAMBLE_HEADINGS
        .iter()
        .any(|heading| cleaned == *heading || cleaned.starts_with(&format!("{} ", heading)))
}

fn is_preamble_line(line: &str) -> bool {
    let lowered = normalize_whitespace(line).to_lowercase();
    lowered.starts_with("about ")
        || lowered.starts_with("we are ")
        || lowered.starts_with("our team")
        || lowered.starts_with("our company")
        || lowered.starts_with("our organization")
        || lowered.starts_with("join us")
        || lowered.starts_with("company overview")
}

fn dedup_key(atom: &RequirementAtom) -> String {
    if atom.matched_tags.is_empty() {
        return format!("{}|{}", atom.cluster_id, atom.requirement_id);
    }
    let mut tags = atom.matched_tags.clone();
    tags.sort();
    format!("{}|{}", atom.cluster_id, tags.join("|"))
}

fn priority_rank(kind: &str) -> u32 {
    match kind {
        REQUIREMENT_KIND_MUST_HAVE => 1,
        REQUIREMENT_KIND_SHOULD_HAVE => 2,
        REQUIREMENT_KIND_NICE_TO_HAVE => 3,
        _ => 99,
    }
}

fn tag_marker_matches_for_posting(
    marker: &TagInferenceMarker,
    normalized_text: &str,
    word_set: &HashSet<String>,
) -> bool {
    match marker.marker_kind.as_str() {
        "literal" => marker
            .literal_value
            .as_deref()
            .map(|literal| non_negated_marker_term_match(literal, normalized_text, word_set))
            .unwrap_or(false),
        "compound" => {
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
            if !all_of.is_empty()
                && !all_of
                    .iter()
                    .all(|term| non_negated_marker_term_match(term, normalized_text, word_set))
            {
                return false;
            }
            if !any_of.is_empty()
                && !any_of
                    .iter()
                    .any(|term| non_negated_marker_term_match(term, normalized_text, word_set))
            {
                return false;
            }
            true
        }
        _ => false,
    }
}

/// Returns true if `term` occurs in `normalized_text` at a whole-word boundary
/// AND is not preceded (within the 3-word lookbehind window) by a negation
/// cue. This is the marker-loop counterpart to the per-occurrence polarity
/// check applied during surface-term extraction. Without it, a posting saying
/// "no kubernetes experience" would still infer the `kubernetes` tag through
/// its `k8s|kubernetes` literal marker even though the surface-term loop
/// correctly skips the negated `kubernetes` mention.
///
/// Cheap pre-check: if the term's first word isn't in `word_set`, we know
/// there is no occurrence — skip the substring scan entirely. This preserves
/// the perf shape of the previous `marker_term_matches_for_posting`.
fn non_negated_marker_term_match(
    term: &str,
    normalized_text: &str,
    word_set: &HashSet<String>,
) -> bool {
    let term_text = normalize_whitespace(term).to_lowercase();
    let term_words = word_regex()
        .find_iter(&term_text)
        .map(|capture| capture.as_str().to_string())
        .collect::<Vec<_>>();
    if term_words.is_empty() {
        return false;
    }
    // First-word absence pre-check: if the first word of the term doesn't
    // appear anywhere in the posting, no occurrence is possible.
    if !word_set.contains(&term_words[0]) {
        return false;
    }

    // Scan every occurrence of `term_text` and require BOTH whole-word
    // boundaries AND a non-negated lookbehind. We can't short-circuit on the
    // first match (it might be negated while a later one is asserted).
    let bytes = normalized_text.as_bytes();
    let term_len = term_text.len();
    let mut search_from = 0usize;
    while let Some(rel) = normalized_text[search_from..].find(&term_text) {
        let start = search_from + rel;
        let end = start + term_len;

        // Whole-word boundary check: char on either side must not be a word
        // char (`[a-z0-9_]`). UTF-8 continuation bytes happen to fall through
        // as non-word, which is conservative and matches the prior
        // `word_set`-only behavior on multi-word terms.
        let left_ok = start == 0 || !is_word_byte(bytes[start - 1]);
        let right_ok = end == bytes.len() || !is_word_byte(bytes[end]);
        if left_ok && right_ok && !has_negation_cue_before(&normalized_text[..start]) {
            return true;
        }
        // Advance past this occurrence (overlapping matches don't matter for
        // single-word marker terms; for multi-word, advancing by 1 is safe
        // and preserves the "any non-negated occurrence wins" semantics).
        search_from = start + 1;
    }
    false
}

#[inline]
fn is_word_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_'
}

fn truncate_chars(value: &str, limit: usize) -> String {
    value.chars().take(limit).collect()
}

fn trim_role_candidate(raw_value: &str) -> String {
    let normalized = normalize_whitespace(raw_value);
    if normalized.is_empty() {
        return String::new();
    }

    let lowered = normalized.to_lowercase();
    let mut cut_index = normalized.len();
    for keyword in [
        " requirements",
        " qualifications",
        " responsibilities",
        " experience",
        " about",
    ] {
        if let Some(index) = lowered.find(keyword) {
            cut_index = cut_index.min(index);
        }
    }
    for punctuation in ['.', ';', ','] {
        if let Some(index) = normalized.find(punctuation) {
            cut_index = cut_index.min(index);
        }
    }

    normalized[..cut_index]
        .trim_matches(|character: char| matches!(character, ' ' | '-' | ':' | ';' | ',' | '.'))
        .to_string()
}

fn extract_labeled_role(cleaned_text: &str, label: &str) -> Option<String> {
    let lowered = cleaned_text.to_lowercase();
    let mut search_values = vec![format!("{}:", label)];
    if label == "title" {
        search_values.insert(0, format!("job {}:", label));
    }

    for search_value in search_values {
        if let Some(index) = lowered.find(&search_value) {
            let start = index + search_value.len();
            let candidate = trim_role_candidate(&cleaned_text[start..]);
            if !candidate.is_empty() {
                return Some(candidate);
            }
        }
    }

    None
}

fn split_requirement_fragments(line: &str) -> Vec<String> {
    let characters = line.chars().collect::<Vec<_>>();
    let mut fragments = Vec::new();
    let mut start = 0;
    let mut index = 0;

    while index < characters.len() {
        if matches!(characters[index], '.' | '!' | '?') {
            let mut next_index = index + 1;
            while next_index < characters.len() && characters[next_index].is_whitespace() {
                next_index += 1;
            }
            if next_index < characters.len()
                && (characters[next_index].is_ascii_uppercase()
                    || characters[next_index].is_ascii_digit())
            {
                let fragment = characters[start..=index].iter().collect::<String>();
                if !fragment.trim().is_empty() {
                    fragments.push(fragment.trim().to_string());
                }
                start = next_index;
                index = next_index;
                continue;
            }
        }
        index += 1;
    }

    let trailing = characters[start..].iter().collect::<String>();
    if !trailing.trim().is_empty() {
        fragments.push(trailing.trim().to_string());
    }
    fragments
}

/// Splits a fragment on compound conjunctions (`;`, ` while `, ` whereas `,
/// ` though `) when both halves carry a classification signal word.
/// Returns the original fragment unchanged if no valid split is found.
fn split_mixed_modality(fragment: &str) -> Vec<String> {
    let lowered = fragment.to_lowercase();

    let has_classification_signal = |text: &str| {
        let lowered = text.to_lowercase();
        requirement_strong_modal_regex().is_match(&lowered)
            || requirement_nice_to_have_regex().is_match(&lowered)
    };

    // Semicolon: most common compound separator in job postings
    if let Some(pos) = lowered.find(';') {
        let left = fragment[..pos].trim();
        let right = fragment[pos + 1..].trim();
        if has_classification_signal(left) && has_classification_signal(right) {
            return vec![left.to_string(), right.to_string()];
        }
    }

    // Word-based clause connectors (space-padded to avoid mid-word matches)
    for splitter in [" while ", " whereas ", " though "] {
        if let Some(pos) = lowered.find(splitter) {
            let left = fragment[..pos].trim();
            let right = fragment[pos + splitter.len()..].trim();
            if has_classification_signal(left) && has_classification_signal(right) {
                return vec![left.to_string(), right.to_string()];
            }
        }
    }

    vec![fragment.to_string()]
}

fn is_member(values: &[&str], candidate: &str) -> bool {
    values.contains(&candidate)
}

fn credential_patterns() -> &'static [(Regex, Vec<&'static str>)] {
    static PATTERNS: OnceLock<Vec<(Regex, Vec<&'static str>)>> = OnceLock::new();
    PATTERNS.get_or_init(|| vec![
        (
            Regex::new(r"\bundergraduate\s+degree\b").unwrap(),
            vec!["undergraduate_degree", "degree"],
        ),
        (
            Regex::new(r"\bbachelor(?:['\u{2019}]s)?\b").unwrap(),
            vec!["bachelor", "degree"],
        ),
        (
            Regex::new(r"\bmaster(?:['\u{2019}]s)?\b").unwrap(),
            vec!["master", "degree"],
        ),
        (
            Regex::new(r"\b(?:ph\.?d|doctorate|doctoral)\b").unwrap(),
            vec!["phd", "degree"],
        ),
        (Regex::new(r"\bdiploma\b").unwrap(), vec!["diploma"]),
        (
            Regex::new(r"\b(?:certification|certificate)\b").unwrap(),
            vec!["certification"],
        ),
        (
            Regex::new(r"\bprofessional\s+designation\b").unwrap(),
            vec!["professional_designation"],
        ),
        (
            Regex::new(r"\bpost[- ]secondary\b").unwrap(),
            vec!["post_secondary", "degree"],
        ),
    ])
}

fn role_family_patterns() -> &'static [Regex] {
    static PATTERNS: OnceLock<Vec<Regex>> = OnceLock::new();
    PATTERNS.get_or_init(|| vec![
        Regex::new(r"(?i)(?:we(?:['\u{2019}]re|\s+are)?\s+)?seeking\s+(?:an?|the)\s+(.+?)(?:\s+to\b|\s+who\b|[.,;]|$)").unwrap(),
        Regex::new(r"(?i)(?:hiring|looking\s+for)\s+(?:an?|the)\s+(.+?)(?:\s+to\b|\s+who\b|[.,;]|$)").unwrap(),
        Regex::new(r"(?i)join(?:\s+\w+){0,5}\s+as\s+(?:an?|the)\s+(.+?)(?:\s+to\b|\s+who\b|[.,;]|$)").unwrap(),
        Regex::new(r"(?i)need\s+(?:an?|the)\s+(.+?)(?:\s+to\b|\s+who\b|[.,;]|$)").unwrap(),
    ])
}

fn title_phrase_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\b(?:[A-Z]{2,}|[A-Z][a-z0-9]+(?:/[A-Z][a-z0-9]+)?)(?:\s+(?:[A-Z]{2,}|[A-Z][a-z0-9]+(?:/[A-Z][a-z0-9]+)?)){0,3}\b").unwrap())
}

fn role_suffix_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)\b(analyst|architect|administrator|advisor|consultant|coordinator|designer|developer|director|engineer|lead|manager|officer|partner|planner|scientist|specialist|strategist|technician)\b").unwrap())
}

fn requirement_bullet_prefix_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^(?:[-*•·]+|\d+[.)])\s+").unwrap())
}

fn requirement_strong_modal_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)\b(required|required to|must|need|needs|minimum|at least|\d+\+?\s+years?)\b").unwrap())
}

fn requirement_nice_to_have_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)\b(preferred|nice to have|bonus|asset|plus)\b").unwrap())
}

fn experience_years_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)(?:(?:at\s+least|minimum|min\.?)\s+)?(\d{1,2})\s*(?:(\+)|(?:to|-)\s*(\d{1,2})\s*\+?)?\s+years?").unwrap())
}

fn quantifier_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)(?:\$[\d,]+(?:\.\d+)?[KkMmBb]?|[\d,]+(?:\.\d+)?\s*%|\b\d{2,}(?:,\d{3})+\b|\b\d+\s*(?:x|×)\b|\b(?:1[0-9]{2,}|[2-9]\d{2,})\b)").unwrap())
}

fn word_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"[a-z0-9]+").unwrap())
}

fn non_word_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\W+").unwrap())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::taxonomy::ensure_runtime_taxonomy_seeded;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(crate::embedded_assets::CAREER_SCHEMA_SQL)
            .unwrap();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();
        conn
    }

    #[test]
    fn builds_requirement_analysis_with_expected_contract_shape() {
        let conn = setup_conn();
        let analysis = build_requirement_analysis(
            &conn,
            "Position: Python engineer\nRequirements:\n- Build Python automation workflows.\n- Document release support processes.",
        )
        .unwrap();

        assert_eq!(analysis.analysis_version, "1.1");
        assert_eq!(analysis.source.target_role_family, "Python engineer");
        assert_eq!(
            analysis.source.extraction_method,
            "posting_surface_terms_v1"
        );
        assert!(analysis
            .source
            .posting_keyword_bank
            .contains(&"python".to_string()));
        assert_eq!(analysis.clusters[0].cluster_id, "cluster_001");
        assert_eq!(analysis.atoms[0].requirement_id, "req_001");
        assert!(matches!(
            analysis.atoms[0].kind.as_str(),
            "must_have" | "should_have" | "nice_to_have"
        ));
    }

    #[test]
    fn derives_role_family_from_need_statement() {
        assert_eq!(
            derive_role_family("Need a Python engineer."),
            "Python engineer"
        );
    }

    #[test]
    fn requirement_analysis_is_stable_for_identical_inputs() {
        let conn = setup_conn();
        let first = build_requirement_analysis(
            &conn,
            "Requirements:\n- Build Python automation workflows.\n- Document release support processes.",
        )
        .unwrap();
        let second = build_requirement_analysis(
            &conn,
            "Requirements:\n- Build Python automation workflows.\n- Document release support processes.",
        )
        .unwrap();

        assert_eq!(first, second);
    }

    #[test]
    fn negation_downgrades_required_to_should_have() {
        // "not required" should suppress the must_have signal from "required"
        let kind = classify_requirement_kind("A degree is not required for this role", "");
        assert_eq!(kind, REQUIREMENT_KIND_SHOULD_HAVE);
    }

    #[test]
    fn negation_downgrades_nice_to_have() {
        // "not a nice to have" should suppress the nice_to_have signal,
        // and with no un-negated must_have signal it falls through to should_have
        let kind = classify_requirement_kind("This is not a nice to have", "");
        assert_eq!(kind, REQUIREMENT_KIND_SHOULD_HAVE);
    }

    #[test]
    fn non_negated_still_classifies_correctly() {
        // Regression guard: plain "required" without negation still → must_have
        let kind = classify_requirement_kind("Python experience required", "");
        assert_eq!(kind, REQUIREMENT_KIND_MUST_HAVE);

        // Plain "preferred" without negation still → nice_to_have
        let kind = classify_requirement_kind("Experience with Rust preferred", "");
        assert_eq!(kind, REQUIREMENT_KIND_NICE_TO_HAVE);
    }

    #[test]
    fn splits_semicolon_mixed_modality() {
        // Both halves carry a signal word → split into 2 fragments
        let parts = split_mixed_modality("Bachelor's degree required; Master's preferred");
        assert_eq!(parts.len(), 2);
        assert!(parts[0].contains("required"));
        assert!(parts[1].contains("preferred"));
    }

    #[test]
    fn does_not_split_when_only_one_signal() {
        // "strong communication" has no classification signal word
        let parts = split_mixed_modality("Python experience required; strong communication skills");
        assert_eq!(parts.len(), 1);
    }

    #[test]
    fn does_not_split_plain_semicolons() {
        // Neither half has a signal word
        let parts = split_mixed_modality("Python; AWS; Docker experience");
        assert_eq!(parts.len(), 1);
    }

    #[test]
    fn heading_decay_suppresses_after_streak() {
        let conn = setup_conn();
        // "Requirements:" is a must_have heading. Bullets 2-4 contain "preferred"
        // (soft signal). After 3 consecutive soft lines, the heading boost should
        // be suppressed: bullet 5 (no signal word) → should_have instead of must_have.
        let analysis = build_requirement_analysis(
            &conn,
            "Requirements:\n\
             - Python experience in automation workflows\n\
             - AWS cloud services experience preferred\n\
             - Docker container experience preferred\n\
             - Kubernetes orchestration preferred\n\
             - Good communication and teamwork abilities",
        )
        .unwrap();

        // Bullet 1: no soft signal, heading boost → must_have
        assert_eq!(analysis.atoms[0].kind, "must_have");
        // Bullets 2-4: "preferred" → nice_to_have (classify checks nice_to_have first)
        assert_eq!(analysis.atoms[1].kind, "nice_to_have");
        assert_eq!(analysis.atoms[2].kind, "nice_to_have");
        assert_eq!(analysis.atoms[3].kind, "nice_to_have");
        // Bullet 5: no signal, streak == 3, heading suppressed → should_have
        assert_eq!(analysis.atoms[4].kind, "should_have");
    }

    #[test]
    fn heading_decay_resets_on_hard_line() {
        let conn = setup_conn();
        // After a streak of soft lines, a hard-signal line resets the streak.
        let analysis = build_requirement_analysis(
            &conn,
            "Requirements:\n\
             - AWS cloud services experience preferred\n\
             - Docker container experience preferred\n\
             - Kubernetes orchestration preferred\n\
             - Python scripting experience required\n\
             - Terraform infrastructure preferred\n\
             - Ansible automation preferred\n\
             - Chef configuration preferred\n\
             - Strong troubleshooting and debugging abilities",
        )
        .unwrap();

        // Bullet 4: "required" (hard signal), resets streak → must_have
        assert_eq!(analysis.atoms[3].kind, "must_have");
        // Bullets 5-7: soft signal, streak rebuilds (1, 2, 3)
        assert_eq!(analysis.atoms[4].kind, "nice_to_have");
        assert_eq!(analysis.atoms[5].kind, "nice_to_have");
        assert_eq!(analysis.atoms[6].kind, "nice_to_have");
        // Bullet 8: no signal, streak == 3, heading suppressed → should_have
        assert_eq!(analysis.atoms[7].kind, "should_have");
    }

    #[test]
    fn extracts_trailing_subject() {
        assert_eq!(
            extract_requirement_subject("Python experience required"),
            Some("python experience".to_string()),
        );
        assert_eq!(
            extract_requirement_subject("A bachelor's degree is preferred"),
            Some("a bachelor's degree".to_string()),
        );
    }

    #[test]
    fn extracts_leading_subject() {
        assert_eq!(
            extract_requirement_subject("Must have 3+ years of AWS experience"),
            Some("3+ years of aws experience".to_string()),
        );
    }

    #[test]
    fn subject_is_none_for_no_signal() {
        assert_eq!(
            extract_requirement_subject("Build automation workflows"),
            None,
        );
    }

    #[test]
    fn subject_survives_dedup() {
        let conn = setup_conn();
        // Two atoms with the same tags should merge; the survivor keeps the subject
        let analysis = build_requirement_analysis(
            &conn,
            "Requirements:\n\
             - Python scripting experience required\n\
             - Strong Python skills for automation tasks",
        )
        .unwrap();

        // Both lines mention "python" so they may share tags and merge.
        // The surviving atom should have a subject from the "required" line.
        let python_atom = analysis.atoms.iter().find(|a| {
            a.matched_tags.contains(&"python".to_string())
        });
        if let Some(atom) = python_atom {
            // If atoms merged, subject should be preserved from the higher-priority atom.
            // If they didn't merge (different cluster keys), the first still has a subject.
            assert!(atom.subject.is_some(), "expected subject to be present");
        }
    }

    // --- marker_term_set filtering tests ---

    fn make_stub_atom(normalized_terms: Vec<(&str, bool)>) -> RequirementAtom {
        RequirementAtom {
            requirement_id: "req_stub".to_string(),
            cluster_id: "cluster_stub".to_string(),
            text: String::new(),
            kind: "must_have".to_string(),
            priority_rank: 0,
            source_order: 0,
            normalized_terms: normalized_terms
                .into_iter()
                .map(|(term, is_negated)| ExtractedTerm {
                    term: term.to_string(),
                    is_negated,
                })
                .collect(),
            matched_tags: Vec::new(),
            experience_years: None,
            has_quantifier: false,
            subject: None,
            merged_from: None,
        }
    }

    fn make_taxonomy_context(
        canonical_tags: Vec<&str>,
        marker_terms: Vec<&str>,
    ) -> RuntimeTaxonomyAnalysisContext {
        RuntimeTaxonomyAnalysisContext {
            canonical_tag_set: canonical_tags.into_iter().map(String::from).collect(),
            markers_by_tag: Vec::new(),
            marker_term_set: marker_terms.into_iter().map(String::from).collect(),
        }
    }

    #[test]
    fn literal_marker_term_excluded_from_suggested_terms() {
        // "k8s" is a literal inference marker for "kubernetes" — should not
        // appear as a suggested term even though it isn't a canonical tag.
        let atoms = vec![
            make_stub_atom(vec![("k8s", false), ("terraform", false)]),
            make_stub_atom(vec![("k8s", false), ("terraform", false)]),
        ];
        let taxonomy = make_taxonomy_context(vec!["kubernetes"], vec!["k8s"]);
        let suggestions = collect_unrecognized_notable_terms(&atoms, &taxonomy);
        let terms: Vec<&str> = suggestions.iter().map(|s| s.term.as_str()).collect();
        assert!(
            !terms.contains(&"k8s"),
            "k8s should be excluded (covered by inference marker)"
        );
        assert!(
            terms.contains(&"terraform"),
            "terraform should still appear (not in markers or tags)"
        );
    }

    #[test]
    fn compound_marker_terms_excluded_from_suggested_terms() {
        // A compound marker for "docker_compose" has all_of terms "docker"
        // and "compose" — both should be suppressed from suggestions.
        let atoms = vec![
            make_stub_atom(vec![("docker", false), ("compose", false), ("ansible", false)]),
            make_stub_atom(vec![("docker", false), ("compose", false), ("ansible", false)]),
        ];
        let taxonomy = make_taxonomy_context(vec![], vec!["docker", "compose"]);
        let suggestions = collect_unrecognized_notable_terms(&atoms, &taxonomy);
        let terms: Vec<&str> = suggestions.iter().map(|s| s.term.as_str()).collect();
        assert!(!terms.contains(&"docker"), "docker should be excluded");
        assert!(!terms.contains(&"compose"), "compose should be excluded");
        assert!(
            terms.contains(&"ansible"),
            "ansible should still appear (not in markers or tags)"
        );
    }

    #[test]
    fn terms_not_in_markers_still_surfaced() {
        // Ensure the filter does not over-suppress: terms with no marker or
        // tag coverage should still appear when they meet the count threshold.
        let atoms = vec![
            make_stub_atom(vec![("grafana", false), ("prometheus", false), ("loki", false)]),
            make_stub_atom(vec![("grafana", false), ("prometheus", false), ("loki", false)]),
        ];
        let taxonomy = make_taxonomy_context(vec![], vec![]);
        let suggestions = collect_unrecognized_notable_terms(&atoms, &taxonomy);
        let terms: Vec<&str> = suggestions.iter().map(|s| s.term.as_str()).collect();
        assert!(terms.contains(&"grafana"));
        assert!(terms.contains(&"prometheus"));
        assert!(terms.contains(&"loki"));
    }

    // --- negation polarity tests ---

    #[test]
    fn negated_terms_excluded_from_suggested_terms() {
        // Atoms carrying explicitly-negated surface terms must not count
        // toward the unrecognized-notable-terms UI even when they meet the
        // >=2 occurrence threshold.
        let atoms = vec![
            make_stub_atom(vec![("python", true), ("grafana", false)]),
            make_stub_atom(vec![("python", true), ("grafana", false)]),
        ];
        let taxonomy = make_taxonomy_context(vec![], vec![]);
        let suggestions = collect_unrecognized_notable_terms(&atoms, &taxonomy);
        let terms: Vec<&str> = suggestions.iter().map(|s| s.term.as_str()).collect();
        assert!(
            !terms.contains(&"python"),
            "negated python should not surface as a positive signal"
        );
        assert!(
            terms.contains(&"grafana"),
            "non-negated grafana should still surface"
        );
    }

    #[test]
    fn not_required_clause_marks_term_as_negated() {
        // End-to-end: extraction should flag `python` as negated when the
        // requirement's classification signal ("required") is itself negated.
        // This exercises the atom-level fallback since the per-term lookbehind
        // cannot see "not" when it appears *after* "python".
        let taxonomy = make_taxonomy_context(vec![], vec![]);
        let (extracted, _) =
            extract_requirement_terms("Python experience is not required for this role.", &taxonomy);
        let python = extracted
            .iter()
            .find(|et| et.term == "python")
            .expect("python term should be extracted");
        assert!(
            python.is_negated,
            "python should be flagged is_negated after 'not required' cue"
        );
    }

    #[test]
    fn lacks_phrase_marks_term_as_negated() {
        let extracted =
            extract_surface_terms_with_max_ngram("Candidate lacks leadership experience.", 3);
        let leadership = extracted
            .iter()
            .find(|et| et.term == "leadership")
            .expect("leadership term should be extracted");
        assert!(
            leadership.is_negated,
            "leadership should be flagged is_negated after 'lacks' cue"
        );
    }

    #[test]
    fn without_phrase_marks_term_as_negated() {
        let extracted =
            extract_surface_terms_with_max_ngram("Ability to work without VBA scripting.", 3);
        let vba = extracted
            .iter()
            .find(|et| et.term == "vba")
            .expect("vba term should be extracted");
        assert!(
            vba.is_negated,
            "vba should be flagged is_negated after 'without' cue"
        );
    }

    #[test]
    fn non_negated_term_not_flagged() {
        // Regression guard for the happy path.
        let extracted =
            extract_surface_terms_with_max_ngram("Python is required for this role.", 3);
        let python = extracted
            .iter()
            .find(|et| et.term == "python")
            .expect("python term should be extracted");
        assert!(
            !python.is_negated,
            "non-negated python must not be flagged"
        );
    }

    #[test]
    fn asserted_occurrence_wins_within_atom() {
        // "Python not required" (negated) + "Python experience preferred"
        // (asserted) in one line — the asserted occurrence should relax the
        // polarity flag back to false.
        let extracted = extract_surface_terms_with_max_ngram(
            "Python not required. Python experience preferred.",
            3,
        );
        let python = extracted
            .iter()
            .find(|et| et.term == "python")
            .expect("python term should be extracted");
        assert!(
            !python.is_negated,
            "asserted occurrence should win over earlier negated occurrence"
        );
    }

    // --- marker-loop polarity tests (Phase 5) ---

    /// Build a `TagInferenceMarker` of kind "literal" for testing.
    fn make_literal_marker(canonical_tag: &str, literal: &str) -> TagInferenceMarker {
        TagInferenceMarker {
            id: format!("marker-{}-{}", canonical_tag, literal),
            canonical_tag: canonical_tag.to_string(),
            marker_kind: "literal".to_string(),
            literal_value: Some(literal.to_string()),
            terms: Vec::new(),
            created_at: String::new(),
        }
    }

    /// Build a `TagInferenceMarker` of kind "compound" with `all_of` terms.
    fn make_compound_all_of_marker(
        canonical_tag: &str,
        all_of: &[&str],
    ) -> TagInferenceMarker {
        TagInferenceMarker {
            id: format!("marker-{}-compound", canonical_tag),
            canonical_tag: canonical_tag.to_string(),
            marker_kind: "compound".to_string(),
            literal_value: None,
            terms: all_of
                .iter()
                .enumerate()
                .map(|(idx, term)| crate::taxonomy::TagInferenceMarkerTerm {
                    id: format!("term-{}-{}", canonical_tag, idx),
                    term_group: "all_of".to_string(),
                    term_value: term.to_string(),
                    sort_order: idx as i64,
                })
                .collect(),
            created_at: String::new(),
        }
    }

    /// Build a taxonomy context with explicit `markers_by_tag` entries. Used
    /// by Phase 5 tests to drive `extract_requirement_terms` through the
    /// marker-matching loop.
    fn make_taxonomy_context_with_markers(
        canonical_tags: Vec<&str>,
        markers_by_tag: Vec<(&str, Vec<TagInferenceMarker>)>,
    ) -> RuntimeTaxonomyAnalysisContext {
        let mut marker_term_set = HashSet::new();
        for (_, markers) in &markers_by_tag {
            for marker in markers {
                if let Some(literal) = &marker.literal_value {
                    marker_term_set.insert(literal.to_lowercase());
                }
                for term in &marker.terms {
                    marker_term_set.insert(term.term_value.to_lowercase());
                }
            }
        }
        RuntimeTaxonomyAnalysisContext {
            canonical_tag_set: canonical_tags.into_iter().map(String::from).collect(),
            markers_by_tag: markers_by_tag
                .into_iter()
                .map(|(tag, markers)| (tag.to_string(), markers))
                .collect(),
            marker_term_set,
        }
    }

    #[test]
    fn negated_literal_marker_does_not_infer_tag() {
        // Literal marker `k8s` for canonical tag `kubernetes`. A posting
        // saying "no k8s experience" must NOT infer the `kubernetes` tag,
        // and the `k8s` surface term must carry is_negated = true.
        let taxonomy = make_taxonomy_context_with_markers(
            vec!["kubernetes"],
            vec![("kubernetes", vec![make_literal_marker("kubernetes", "k8s")])],
        );
        let (extracted, matched_tags) =
            extract_requirement_terms("No k8s experience needed for this role.", &taxonomy);
        assert!(
            !matched_tags.contains(&"kubernetes".to_string()),
            "kubernetes tag must not fire for negated k8s marker; got {:?}",
            matched_tags
        );
        let k8s = extracted
            .iter()
            .find(|et| et.term == "k8s")
            .expect("k8s term should be extracted");
        assert!(
            k8s.is_negated,
            "k8s surface term should be flagged is_negated"
        );
    }

    #[test]
    fn negated_compound_marker_does_not_infer_tag() {
        // Compound marker for `docker_compose` requires both `docker` and
        // `compose`. A posting saying "lacks docker and compose familiarity"
        // must NOT infer `docker_compose`.
        let taxonomy = make_taxonomy_context_with_markers(
            vec!["docker_compose"],
            vec![(
                "docker_compose",
                vec![make_compound_all_of_marker(
                    "docker_compose",
                    &["docker", "compose"],
                )],
            )],
        );
        let (_extracted, matched_tags) = extract_requirement_terms(
            "Candidate lacks docker and compose familiarity.",
            &taxonomy,
        );
        assert!(
            !matched_tags.contains(&"docker_compose".to_string()),
            "docker_compose must not fire when both compound terms are negated; got {:?}",
            matched_tags
        );
    }

    #[test]
    fn non_negated_marker_still_fires_after_polarity_check() {
        // Regression guard: the `k8s` literal marker MUST still infer
        // `kubernetes` in the asserted case.
        let taxonomy = make_taxonomy_context_with_markers(
            vec!["kubernetes"],
            vec![("kubernetes", vec![make_literal_marker("kubernetes", "k8s")])],
        );
        let (_extracted, matched_tags) =
            extract_requirement_terms("k8s experience required for this role.", &taxonomy);
        assert!(
            matched_tags.contains(&"kubernetes".to_string()),
            "kubernetes should fire for asserted k8s marker; got {:?}",
            matched_tags
        );
    }

    #[test]
    fn atom_with_negated_classification_signal_yields_no_matched_tags() {
        // When the requirement's own classification signal ("required") is
        // itself negated, the atom-level early return should suppress all
        // tag inference — including canonical-tag matches that would
        // otherwise fire from the surface-term loop.
        let taxonomy = make_taxonomy_context_with_markers(vec!["python"], vec![]);
        let (extracted, matched_tags) =
            extract_requirement_terms("Python is not required for this role.", &taxonomy);
        assert!(
            matched_tags.is_empty(),
            "atom-level negation must yield empty matched_tags; got {:?}",
            matched_tags
        );
        let python = extracted
            .iter()
            .find(|et| et.term == "python")
            .expect("python term should be extracted");
        assert!(
            python.is_negated,
            "python surface term should be flagged is_negated"
        );
    }
}
