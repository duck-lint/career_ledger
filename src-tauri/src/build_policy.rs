use crate::preflight_filter::PreflightConfig;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;

const MULTI_EVIDENCE_SECTIONS: &[&str] = &["highlights", "profile"];
const WEIGHT_SUM_TOLERANCE: f64 = 1e-6;
const ACTIVE_BUILD_POLICY_ROW_ID: &str = "active";
pub const BUILD_POLICY_SOURCE_URI: &str = "db://resume_build_policy_settings";

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct BuildPolicyPreflight {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub threshold: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fallback_min_records: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct AssemblerStrategy {
    pub max_highlights: u32,
    pub bullet_max_chars: u32,
    pub highlight_max_chars: u32,
    pub profile_max_chars: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coverage_first_highlights: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coverage_first_profile_tiebreak: Option<bool>,
    pub allow_multi_evidence_sections: Vec<String>,
    pub tag_weight: f64,
    pub density_weight: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct BuildPolicy {
    pub policy_type: String,
    pub include_projects: bool,
    pub max_bullets_per_role: u32,
    pub max_project_bullets: u32,
    pub max_projects: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preflight: Option<BuildPolicyPreflight>,
    pub assembler_strategy: AssemblerStrategy,
}

impl BuildPolicy {
    pub fn effective_preflight_config(&self) -> PreflightConfig {
        PreflightConfig {
            threshold: self
                .preflight
                .as_ref()
                .and_then(|preflight| preflight.threshold)
                .unwrap_or(0.0),
            fallback_min_records: self
                .preflight
                .as_ref()
                .and_then(|preflight| preflight.fallback_min_records)
                .unwrap_or(3),
        }
    }
}

impl AssemblerStrategy {
    pub fn coverage_first_highlights_enabled(&self) -> bool {
        self.coverage_first_highlights.unwrap_or(true)
    }

    pub fn coverage_first_profile_tiebreak_enabled(&self) -> bool {
        self.coverage_first_profile_tiebreak.unwrap_or(true)
    }
}

pub fn parse_build_policy_json_str(raw_text: &str) -> Result<BuildPolicy, String> {
    let payload: Value = serde_json::from_str(raw_text)
        .map_err(|error| format!("Build policy is not valid JSON: {error}"))?;
    parse_build_policy_value(&payload)
}

pub fn default_build_policy() -> Result<BuildPolicy, String> {
    parse_build_policy_json_str(crate::embedded_assets::DEFAULT_BUILD_POLICY_JSON)
}

pub fn serialize_build_policy(build_policy: &BuildPolicy) -> Result<String, String> {
    serde_json::to_string(build_policy).map_err(|error| error.to_string())
}

pub fn ensure_build_policy_seeded(conn: &Connection) -> Result<(), String> {
    let existing = conn
        .query_row(
            "SELECT policy_json FROM resume_build_policy_settings WHERE id = ?1 LIMIT 1",
            params![ACTIVE_BUILD_POLICY_ROW_ID],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if existing.is_some() {
        return Ok(());
    }

    let policy_json = serialize_build_policy(&default_build_policy()?)?;
    conn.execute(
        "INSERT INTO resume_build_policy_settings (id, policy_json) VALUES (?1, ?2)",
        params![ACTIVE_BUILD_POLICY_ROW_ID, policy_json],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn get_build_policy(conn: &Connection) -> Result<BuildPolicy, String> {
    ensure_build_policy_seeded(conn)?;
    let raw_text = conn
        .query_row(
            "SELECT policy_json FROM resume_build_policy_settings WHERE id = ?1 LIMIT 1",
            params![ACTIVE_BUILD_POLICY_ROW_ID],
            |row| row.get::<_, String>(0),
        )
        .map_err(|error| error.to_string())?;
    parse_build_policy_json_str(&raw_text)
}

pub fn get_build_policy_snapshot(conn: &Connection) -> Result<(BuildPolicy, String), String> {
    let build_policy = get_build_policy(conn)?;
    let snapshot_json = serialize_build_policy(&build_policy)?;
    Ok((build_policy, snapshot_json))
}

pub fn save_build_policy(
    conn: &Connection,
    build_policy: BuildPolicy,
) -> Result<BuildPolicy, String> {
    let payload = serde_json::to_value(&build_policy).map_err(|error| error.to_string())?;
    let validated = parse_build_policy_value(&payload)?;
    let policy_json = serialize_build_policy(&validated)?;

    conn.execute(
        "INSERT INTO resume_build_policy_settings (id, policy_json)
         VALUES (?1, ?2)
         ON CONFLICT(id) DO UPDATE SET
            policy_json = excluded.policy_json,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')",
        params![ACTIVE_BUILD_POLICY_ROW_ID, policy_json],
    )
    .map_err(|error| error.to_string())?;

    Ok(validated)
}

pub fn parse_build_policy_value(build_policy: &Value) -> Result<BuildPolicy, String> {
    let Some(object) = build_policy.as_object() else {
        return Err("build_policy must be an object.".to_string());
    };

    let mut errors = Vec::new();
    validate_additional_properties(
        object
            .keys()
            .map(String::as_str)
            .collect::<Vec<_>>()
            .as_slice(),
        &[
            "policy_type",
            "include_projects",
            "max_bullets_per_role",
            "max_project_bullets",
            "max_projects",
            "preflight",
            "assembler_strategy",
        ],
        "build_policy",
        &mut errors,
    );

    let policy_type = validate_required_string(
        object.get("policy_type"),
        "build_policy.policy_type",
        Some("resume_build_policy"),
        &mut errors,
    );
    let include_projects = validate_required_bool(
        object.get("include_projects"),
        "build_policy.include_projects",
        &mut errors,
    );
    let max_bullets_per_role = validate_required_u32(
        object.get("max_bullets_per_role"),
        "build_policy.max_bullets_per_role",
        None,
        None,
        &mut errors,
    );
    let max_project_bullets = validate_required_u32(
        object.get("max_project_bullets"),
        "build_policy.max_project_bullets",
        None,
        None,
        &mut errors,
    );
    let max_projects = validate_required_u32(
        object.get("max_projects"),
        "build_policy.max_projects",
        None,
        None,
        &mut errors,
    );

    let preflight = object
        .get("preflight")
        .and_then(|value| parse_preflight(value, &mut errors));
    let assembler_strategy =
        parse_assembler_strategy(object.get("assembler_strategy"), &mut errors);

    if !errors.is_empty() {
        return Err(format!("Build policy invalid:\n{}", errors.join("\n")));
    }

    Ok(BuildPolicy {
        policy_type: policy_type.expect("validated policy_type"),
        include_projects: include_projects.expect("validated include_projects"),
        max_bullets_per_role: max_bullets_per_role.expect("validated max_bullets_per_role"),
        max_project_bullets: max_project_bullets.expect("validated max_project_bullets"),
        max_projects: max_projects.expect("validated max_projects"),
        preflight,
        assembler_strategy: assembler_strategy.expect("validated assembler_strategy"),
    })
}

fn parse_preflight(value: &Value, errors: &mut Vec<String>) -> Option<BuildPolicyPreflight> {
    let Some(object) = value.as_object() else {
        errors.push("build_policy.preflight must be an object.".to_string());
        return None;
    };

    validate_additional_properties(
        object
            .keys()
            .map(String::as_str)
            .collect::<Vec<_>>()
            .as_slice(),
        &["threshold", "fallback_min_records"],
        "build_policy.preflight",
        errors,
    );

    let threshold = validate_optional_f64(
        object.get("threshold"),
        "build_policy.preflight.threshold",
        Some(0.0),
        Some(1.0),
        errors,
    );
    let fallback_min_records = validate_optional_u32(
        object.get("fallback_min_records"),
        "build_policy.preflight.fallback_min_records",
        None,
        None,
        errors,
    );

    Some(BuildPolicyPreflight {
        threshold,
        fallback_min_records,
    })
}

fn parse_assembler_strategy(
    value: Option<&Value>,
    errors: &mut Vec<String>,
) -> Option<AssemblerStrategy> {
    let Some(value) = value else {
        errors.push("build_policy.assembler_strategy is required.".to_string());
        return None;
    };
    let Some(object) = value.as_object() else {
        errors.push("build_policy.assembler_strategy must be an object.".to_string());
        return None;
    };

    validate_additional_properties(
        object
            .keys()
            .map(String::as_str)
            .collect::<Vec<_>>()
            .as_slice(),
        &[
            "max_highlights",
            "bullet_max_chars",
            "highlight_max_chars",
            "profile_max_chars",
            "coverage_first_highlights",
            "coverage_first_profile_tiebreak",
            "allow_multi_evidence_sections",
            "tag_weight",
            "density_weight",
        ],
        "build_policy.assembler_strategy",
        errors,
    );

    let max_highlights = validate_required_u32(
        object.get("max_highlights"),
        "build_policy.assembler_strategy.max_highlights",
        Some(0),
        Some(8),
        errors,
    );
    let bullet_max_chars = validate_required_u32(
        object.get("bullet_max_chars"),
        "build_policy.assembler_strategy.bullet_max_chars",
        Some(80),
        Some(400),
        errors,
    );
    let highlight_max_chars = validate_required_u32(
        object.get("highlight_max_chars"),
        "build_policy.assembler_strategy.highlight_max_chars",
        Some(80),
        Some(400),
        errors,
    );
    let profile_max_chars = validate_required_u32(
        object.get("profile_max_chars"),
        "build_policy.assembler_strategy.profile_max_chars",
        Some(0),
        Some(500),
        errors,
    );
    let coverage_first_highlights = validate_optional_bool(
        object.get("coverage_first_highlights"),
        "build_policy.assembler_strategy.coverage_first_highlights",
        errors,
    );
    let coverage_first_profile_tiebreak = validate_optional_bool(
        object.get("coverage_first_profile_tiebreak"),
        "build_policy.assembler_strategy.coverage_first_profile_tiebreak",
        errors,
    );
    let allow_multi_evidence_sections =
        validate_multi_evidence_sections(object.get("allow_multi_evidence_sections"), errors);
    let tag_weight = validate_required_f64(
        object.get("tag_weight"),
        "build_policy.assembler_strategy.tag_weight",
        Some(0.0),
        Some(1.0),
        errors,
    );
    let density_weight = validate_required_f64(
        object.get("density_weight"),
        "build_policy.assembler_strategy.density_weight",
        Some(0.0),
        Some(1.0),
        errors,
    );

    if let (Some(tag_weight), Some(density_weight)) = (tag_weight, density_weight) {
        if ((tag_weight + density_weight) - 1.0).abs() > WEIGHT_SUM_TOLERANCE {
            errors.push(
                "build_policy.assembler_strategy.tag_weight and build_policy.assembler_strategy.density_weight must sum to 1.0."
                    .to_string(),
            );
        }
    }

    Some(AssemblerStrategy {
        max_highlights: max_highlights.unwrap_or_default(),
        bullet_max_chars: bullet_max_chars.unwrap_or_default(),
        highlight_max_chars: highlight_max_chars.unwrap_or_default(),
        profile_max_chars: profile_max_chars.unwrap_or_default(),
        coverage_first_highlights,
        coverage_first_profile_tiebreak,
        allow_multi_evidence_sections: allow_multi_evidence_sections.unwrap_or_default(),
        tag_weight: tag_weight.unwrap_or_default(),
        density_weight: density_weight.unwrap_or_default(),
    })
}

fn validate_additional_properties(
    keys: &[&str],
    allowed: &[&str],
    path: &str,
    errors: &mut Vec<String>,
) {
    for key in keys {
        if !allowed.contains(key) {
            errors.push(format!("{path}.{key} is not allowed."));
        }
    }
}

fn validate_required_string(
    value: Option<&Value>,
    path: &str,
    expected: Option<&str>,
    errors: &mut Vec<String>,
) -> Option<String> {
    let Some(value) = value else {
        errors.push(format!("{path} is required."));
        return None;
    };
    let Some(text) = value.as_str() else {
        errors.push(format!("{path} must be a string."));
        return None;
    };
    if let Some(expected_text) = expected {
        if text != expected_text {
            errors.push(format!("{path} must equal '{expected_text}'."));
        }
    }
    Some(text.to_string())
}

fn validate_required_bool(
    value: Option<&Value>,
    path: &str,
    errors: &mut Vec<String>,
) -> Option<bool> {
    let Some(value) = value else {
        errors.push(format!("{path} is required."));
        return None;
    };
    let Some(flag) = value.as_bool() else {
        errors.push(format!("{path} must be a boolean."));
        return None;
    };
    Some(flag)
}

fn validate_optional_bool(
    value: Option<&Value>,
    path: &str,
    errors: &mut Vec<String>,
) -> Option<bool> {
    let Some(value) = value else {
        return None;
    };
    let Some(flag) = value.as_bool() else {
        errors.push(format!("{path} must be a boolean."));
        return None;
    };
    Some(flag)
}

fn validate_required_u32(
    value: Option<&Value>,
    path: &str,
    min: Option<u32>,
    max: Option<u32>,
    errors: &mut Vec<String>,
) -> Option<u32> {
    let Some(value) = value else {
        errors.push(format!("{path} is required."));
        return None;
    };
    validate_u32(value, path, min, max, errors)
}

fn validate_optional_u32(
    value: Option<&Value>,
    path: &str,
    min: Option<u32>,
    max: Option<u32>,
    errors: &mut Vec<String>,
) -> Option<u32> {
    let Some(value) = value else {
        return None;
    };
    validate_u32(value, path, min, max, errors)
}

fn validate_u32(
    value: &Value,
    path: &str,
    min: Option<u32>,
    max: Option<u32>,
    errors: &mut Vec<String>,
) -> Option<u32> {
    let Some(number) = value.as_u64() else {
        errors.push(format!("{path} must be a non-negative integer."));
        return None;
    };
    let number = number as u32;
    if let Some(minimum) = min {
        if number < minimum {
            errors.push(format!("{path} must be greater than or equal to {minimum}."));
        }
    }
    if let Some(maximum) = max {
        if number > maximum {
            errors.push(format!("{path} must be less than or equal to {maximum}."));
        }
    }
    Some(number)
}

fn validate_required_f64(
    value: Option<&Value>,
    path: &str,
    min: Option<f64>,
    max: Option<f64>,
    errors: &mut Vec<String>,
) -> Option<f64> {
    let Some(value) = value else {
        errors.push(format!("{path} is required."));
        return None;
    };
    validate_f64(value, path, min, max, errors)
}

fn validate_optional_f64(
    value: Option<&Value>,
    path: &str,
    min: Option<f64>,
    max: Option<f64>,
    errors: &mut Vec<String>,
) -> Option<f64> {
    let Some(value) = value else {
        return None;
    };
    validate_f64(value, path, min, max, errors)
}

fn validate_f64(
    value: &Value,
    path: &str,
    min: Option<f64>,
    max: Option<f64>,
    errors: &mut Vec<String>,
) -> Option<f64> {
    let Some(number) = value.as_f64() else {
        errors.push(format!("{path} must be a number."));
        return None;
    };
    if let Some(minimum) = min {
        if number < minimum {
            errors.push(format!("{path} must be greater than or equal to {minimum}."));
        }
    }
    if let Some(maximum) = max {
        if number > maximum {
            errors.push(format!("{path} must be less than or equal to {maximum}."));
        }
    }
    Some(number)
}

fn validate_multi_evidence_sections(
    value: Option<&Value>,
    errors: &mut Vec<String>,
) -> Option<Vec<String>> {
    let Some(value) = value else {
        errors.push(
            "build_policy.assembler_strategy.allow_multi_evidence_sections is required."
                .to_string(),
        );
        return None;
    };
    let Some(items) = value.as_array() else {
        errors.push(
            "build_policy.assembler_strategy.allow_multi_evidence_sections must be an array."
                .to_string(),
        );
        return None;
    };

    let mut normalized = Vec::new();
    let mut seen = HashSet::new();
    for (index, item) in items.iter().enumerate() {
        let Some(section_name) = item.as_str() else {
            errors.push(format!(
                "build_policy.assembler_strategy.allow_multi_evidence_sections[{index}] must be a string.",
            ));
            continue;
        };
        if !MULTI_EVIDENCE_SECTIONS.contains(&section_name) {
            errors.push(format!(
                "build_policy.assembler_strategy.allow_multi_evidence_sections[{index}] must be one of: highlights, profile.",
            ));
            continue;
        }
        if !seen.insert(section_name.to_string()) {
            errors.push(
                "build_policy.assembler_strategy.allow_multi_evidence_sections must not contain duplicates."
                    .to_string(),
            );
            continue;
        }
        normalized.push(section_name.to_string());
    }

    Some(normalized)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use serde_json::json;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE resume_build_policy_settings (
                id TEXT PRIMARY KEY CHECK (id = 'active'),
                policy_json TEXT NOT NULL,
                created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            );",
        )
        .unwrap();
        conn
    }

    #[test]
    fn loads_embedded_default_build_policy() {
        let policy = default_build_policy().unwrap();

        assert_eq!(policy.policy_type, "resume_build_policy");
        assert!(policy.include_projects);
        assert_eq!(policy.effective_preflight_config().threshold, 0.5);
        assert_eq!(policy.effective_preflight_config().fallback_min_records, 3);
    }

    #[test]
    fn invalid_missing_required_property_reports_path() {
        let error = parse_build_policy_value(&json!({
            "policy_type": "resume_build_policy",
            "max_bullets_per_role": 5,
            "max_project_bullets": 4,
            "max_projects": 4,
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
        .unwrap_err();

        assert!(error.contains("build_policy.include_projects"));
    }

    #[test]
    fn preserves_optional_fields_while_exposing_effective_defaults() {
        let policy = parse_build_policy_value(&json!({
            "policy_type": "resume_build_policy",
            "include_projects": true,
            "max_bullets_per_role": 5,
            "max_project_bullets": 4,
            "max_projects": 4,
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

        assert!(policy.preflight.is_none());
        assert!(policy
            .assembler_strategy
            .coverage_first_highlights
            .is_none());
        assert!(policy
            .assembler_strategy
            .coverage_first_highlights_enabled());
        assert!(policy
            .assembler_strategy
            .coverage_first_profile_tiebreak_enabled());
        assert_eq!(policy.effective_preflight_config().threshold, 0.0);
        assert_eq!(policy.effective_preflight_config().fallback_min_records, 3);
    }

    #[test]
    fn rejects_invalid_weight_sum() {
        let error = parse_build_policy_value(&json!({
            "policy_type": "resume_build_policy",
            "include_projects": true,
            "max_bullets_per_role": 5,
            "max_project_bullets": 4,
            "max_projects": 4,
            "assembler_strategy": {
                "max_highlights": 4,
                "bullet_max_chars": 280,
                "highlight_max_chars": 280,
                "profile_max_chars": 420,
                "allow_multi_evidence_sections": ["highlights", "profile"],
                "tag_weight": 0.5,
                "density_weight": 0.6
            }
        }))
        .unwrap_err();

        assert!(error.contains("tag_weight"));
        assert!(error.contains("density_weight"));
    }

    #[test]
    fn seeds_and_reads_build_policy_from_database() {
        let conn = setup_conn();

        let policy = get_build_policy(&conn).unwrap();
        let stored_row_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM resume_build_policy_settings WHERE id = 'active'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(stored_row_count, 1);
        assert_eq!(policy.policy_type, "resume_build_policy");
    }

    #[test]
    fn save_build_policy_round_trips_validated_snapshot() {
        let conn = setup_conn();
        let mut policy = default_build_policy().unwrap();
        policy.max_projects = 2;
        policy.assembler_strategy.max_highlights = 4;

        let saved = save_build_policy(&conn, policy.clone()).unwrap();
        let reloaded = get_build_policy(&conn).unwrap();
        let (_, snapshot_json) = get_build_policy_snapshot(&conn).unwrap();

        assert_eq!(saved, policy);
        assert_eq!(reloaded, policy);
        assert!(snapshot_json.contains("resume_build_policy"));
    }
}
