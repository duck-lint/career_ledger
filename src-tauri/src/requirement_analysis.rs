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
    pub normalized_terms: Vec<String>,
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

pub fn extract_surface_terms(text: &str) -> Vec<String> {
    extract_surface_terms_with_max_ngram(text, 3)
}

fn extract_surface_terms_with_max_ngram(text: &str, max_ngram: usize) -> Vec<String> {
    let cleaned_text = normalize_whitespace(text);
    if cleaned_text.is_empty() {
        return Vec::new();
    }

    let mut ordered = Vec::new();
    let mut seen = HashSet::new();
    let lowered = cleaned_text.to_lowercase();

    let mut add_term = |raw_value: &str| {
        let normalized = normalize_surface_term(raw_value);
        if normalized.is_empty() || !seen.insert(normalized.clone()) {
            return;
        }
        ordered.push(normalized);
    };

    for (pattern, terms) in credential_patterns() {
        if pattern.is_match(&lowered) {
            for term in terms {
                add_term(term);
            }
        }
    }

    for capture in title_phrase_regex().find_iter(&cleaned_text) {
        let phrase = capture.as_str();
        if is_member(HEADING_TERMS, &phrase.to_lowercase()) {
            continue;
        }
        add_term(phrase);
    }

    let filtered_words = word_regex()
        .find_iter(&lowered)
        .map(|capture| capture.as_str().to_string())
        .filter(|word| word.len() >= 3 && !is_member(STOPWORDS, word))
        .collect::<Vec<_>>();

    for word in &filtered_words {
        add_term(word);
    }

    for ngram_size in 2..=max_ngram {
        if filtered_words.len() < ngram_size {
            continue;
        }

        for index in 0..=(filtered_words.len() - ngram_size) {
            let phrase_words = &filtered_words[index..index + ngram_size];
            if phrase_words
                .iter()
                .all(|word| is_member(GENERIC_SURFACE_TERMS, word))
            {
                continue;
            }

            let contiguous_phrase = phrase_words.join(" ");
            if !lowered.contains(&contiguous_phrase) {
                continue;
            }

            add_term(&phrase_words.join("_"));
        }
    }

    ordered
}

fn extract_requirement_terms(
    text: &str,
    taxonomy: &RuntimeTaxonomyAnalysisContext,
) -> (Vec<String>, Vec<String>) {
    let surface_terms = extract_surface_terms_with_max_ngram(text, 3);
    let mut matched_tags = Vec::new();
    let mut seen_tags = HashSet::new();

    for surface_term in &surface_terms {
        if taxonomy.canonical_tag_set.contains(surface_term)
            && seen_tags.insert(surface_term.clone())
        {
            matched_tags.push(surface_term.clone());
        }
    }

    let normalized_text = normalize_whitespace(text).to_lowercase();
    let word_set = word_regex()
        .find_iter(&normalized_text)
        .map(|capture| capture.as_str().to_string())
        .collect::<HashSet<_>>();

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
        for value in &atom.normalized_terms {
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

/// Returns true if the first match of `pattern` in `text` is preceded (within
/// a 3-word window) by a negation cue like "not", "no", "without", etc.
/// Expects `text` to already be lowercased.
fn is_negated_signal(text: &str, pattern: &Regex) -> bool {
    let Some(matched) = pattern.find(text) else {
        return false;
    };
    let prefix = &text[..matched.start()];
    let words: Vec<&str> = prefix.split_whitespace().collect();
    let window = &words[words.len().saturating_sub(3)..];
    window.iter().any(|word| NEGATION_CUES.contains(word))
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
            let mut seen_terms = all_terms.iter().cloned().collect::<HashSet<_>>();
            let mut all_tags = survivor.matched_tags.clone();
            let mut seen_tags = all_tags.iter().cloned().collect::<HashSet<_>>();
            let mut merged_texts = Vec::new();

            for other in group.iter().skip(1) {
                merged_texts.push(other.text.clone());
                for term in &other.normalized_terms {
                    if seen_terms.insert(term.clone()) {
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
            .map(|literal| marker_term_matches_for_posting(literal, normalized_text, word_set))
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
                    .all(|term| marker_term_matches_for_posting(term, normalized_text, word_set))
            {
                return false;
            }
            if !any_of.is_empty()
                && !any_of
                    .iter()
                    .any(|term| marker_term_matches_for_posting(term, normalized_text, word_set))
            {
                return false;
            }
            true
        }
        _ => false,
    }
}

fn marker_term_matches_for_posting(
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
    if term_words.len() == 1 {
        return word_set.contains(&term_words[0]);
    }
    normalized_text.contains(&term_text)
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

    fn make_stub_atom(normalized_terms: Vec<&str>) -> RequirementAtom {
        RequirementAtom {
            requirement_id: "req_stub".to_string(),
            cluster_id: "cluster_stub".to_string(),
            text: String::new(),
            kind: "must_have".to_string(),
            priority_rank: 0,
            source_order: 0,
            normalized_terms: normalized_terms.into_iter().map(String::from).collect(),
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
            make_stub_atom(vec!["k8s", "terraform"]),
            make_stub_atom(vec!["k8s", "terraform"]),
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
            make_stub_atom(vec!["docker", "compose", "ansible"]),
            make_stub_atom(vec!["docker", "compose", "ansible"]),
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
            make_stub_atom(vec!["grafana", "prometheus", "loki"]),
            make_stub_atom(vec!["grafana", "prometheus", "loki"]),
        ];
        let taxonomy = make_taxonomy_context(vec![], vec![]);
        let suggestions = collect_unrecognized_notable_terms(&atoms, &taxonomy);
        let terms: Vec<&str> = suggestions.iter().map(|s| s.term.as_str()).collect();
        assert!(terms.contains(&"grafana"));
        assert!(terms.contains(&"prometheus"));
        assert!(terms.contains(&"loki"));
    }
}
