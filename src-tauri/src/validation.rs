use std::collections::HashSet;

pub const RECORD_TYPE_OPTIONS: [&str; 2] = ["employment", "project"];

pub fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    let raw = value?;
    let mut parts = raw.split_whitespace();
    let first = parts.next()?;
    let mut normalized = String::from(first);
    for part in parts {
        normalized.push(' ');
        normalized.push_str(part);
    }
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

pub fn normalize_optional_owned(value: Option<String>) -> Option<String> {
    normalize_optional_text(value.as_deref())
}

pub fn normalize_required_text(value: Option<&str>, label: &str) -> Result<String, String> {
    normalize_optional_text(value).ok_or_else(|| format!("{label} is required."))
}

pub fn normalize_required_record_type(value: Option<&str>, label: &str) -> Result<String, String> {
    let record_type = normalize_required_text(value, label)?.to_lowercase();
    if RECORD_TYPE_OPTIONS.contains(&record_type.as_str()) {
        return Ok(record_type);
    }

    Err(format!(
        "{label} must be one of: {}.",
        RECORD_TYPE_OPTIONS.join(", ")
    ))
}

pub fn slugify_lower_snake(value: &str) -> String {
    let mut normalized = String::new();
    let mut last_was_separator = false;

    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            normalized.push(ch.to_ascii_lowercase());
            last_was_separator = false;
        } else if !normalized.is_empty() && !last_was_separator {
            normalized.push('_');
            last_was_separator = true;
        }
    }

    normalized.trim_matches('_').to_string()
}

pub fn normalize_lower_snake_case(value: &str, label: &str) -> Result<String, String> {
    let normalized = slugify_lower_snake(value);
    if normalized.is_empty() {
        return Err(format!(
            "{label} must contain at least one letter or number."
        ));
    }
    Ok(normalized)
}

pub fn slugify_record_slug(value: &str) -> String {
    let mut normalized = String::new();
    let mut last_was_separator = false;

    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            normalized.push(ch.to_ascii_lowercase());
            last_was_separator = false;
        } else if !normalized.is_empty() && !last_was_separator {
            normalized.push('-');
            last_was_separator = true;
        }
    }

    normalized.trim_matches('-').to_string()
}

pub fn normalize_text_list(items: &[String], label: &str) -> Result<Vec<String>, String> {
    let mut normalized = Vec::new();
    let mut seen = HashSet::new();

    for (index, item) in items.iter().enumerate() {
        let cleaned = normalize_optional_text(Some(item.as_str()))
            .ok_or_else(|| format!("{label}[{}] must be a non-empty string.", index + 1))?;
        if seen.insert(cleaned.clone()) {
            normalized.push(cleaned);
        }
    }

    Ok(normalized)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_lower_snake_case_values() {
        assert_eq!(slugify_lower_snake("CLI Tools"), "cli_tools");
        assert_eq!(slugify_lower_snake(" already__clean "), "already_clean");
    }

    #[test]
    fn rejects_invalid_record_type() {
        let error = normalize_required_record_type(Some("other"), "record_type").unwrap_err();
        assert!(error.contains("record_type must be one of"));
    }

    #[test]
    fn slugifies_record_slugs_with_dashes() {
        assert_eq!(
            slugify_record_slug("Example Org - Senior Analyst"),
            "example-org-senior-analyst"
        );
    }
}
