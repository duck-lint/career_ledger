use rusqlite::{params, Connection, OptionalExtension};

const ACTIVE_REQUIREMENT_REVIEW_SETTINGS_ROW_ID: &str = "active";

fn normalize_noise_terms(noise_terms: &[String]) -> Vec<String> {
    let mut normalized = noise_terms
        .iter()
        .map(|term| term.trim().to_lowercase())
        .filter(|term| !term.is_empty())
        .collect::<Vec<_>>();
    normalized.sort();
    normalized.dedup();
    normalized
}

pub fn ensure_requirement_review_settings_seeded(conn: &Connection) -> Result<(), String> {
    let existing = conn
        .query_row(
            "SELECT noise_terms_json FROM resume_requirement_review_settings WHERE id = ?1 LIMIT 1",
            params![ACTIVE_REQUIREMENT_REVIEW_SETTINGS_ROW_ID],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if existing.is_some() {
        return Ok(());
    }

    conn.execute(
        "INSERT INTO resume_requirement_review_settings (id, noise_terms_json) VALUES (?1, ?2)",
        params![ACTIVE_REQUIREMENT_REVIEW_SETTINGS_ROW_ID, "[]"],
    )
    .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn get_requirement_review_noise_terms(conn: &Connection) -> Result<Vec<String>, String> {
    ensure_requirement_review_settings_seeded(conn)?;

    let raw_terms = conn
        .query_row(
            "SELECT noise_terms_json FROM resume_requirement_review_settings WHERE id = ?1 LIMIT 1",
            params![ACTIVE_REQUIREMENT_REVIEW_SETTINGS_ROW_ID],
            |row| row.get::<_, String>(0),
        )
        .map_err(|error| error.to_string())?;

    let terms = serde_json::from_str::<Vec<String>>(&raw_terms)
        .map_err(|error| format!("Reusable requirement-review noise settings are not valid JSON: {error}"))?;

    Ok(normalize_noise_terms(&terms))
}

pub fn save_requirement_review_noise_terms(
    conn: &Connection,
    noise_terms: Vec<String>,
) -> Result<Vec<String>, String> {
    let normalized_terms = normalize_noise_terms(&noise_terms);
    let noise_terms_json = serde_json::to_string(&normalized_terms).map_err(|error| error.to_string())?;

    conn.execute(
        "INSERT INTO resume_requirement_review_settings (id, noise_terms_json)
         VALUES (?1, ?2)
         ON CONFLICT(id) DO UPDATE SET
            noise_terms_json = excluded.noise_terms_json,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')",
        params![ACTIVE_REQUIREMENT_REVIEW_SETTINGS_ROW_ID, noise_terms_json],
    )
    .map_err(|error| error.to_string())?;

    Ok(normalized_terms)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE resume_requirement_review_settings (
                id TEXT PRIMARY KEY CHECK (id = 'active'),
                noise_terms_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            );",
        )
        .unwrap();
        conn
    }

    #[test]
    fn seeds_empty_requirement_review_noise_terms() {
        let conn = setup_conn();

        let noise_terms = get_requirement_review_noise_terms(&conn).unwrap();

        assert!(noise_terms.is_empty());
    }

    #[test]
    fn saves_normalized_requirement_review_noise_terms() {
        let conn = setup_conn();

        let saved = save_requirement_review_noise_terms(
            &conn,
            vec![
                " Developer Experience ".to_string(),
                "you".to_string(),
                "developer experience".to_string(),
            ],
        )
        .unwrap();
        let reloaded = get_requirement_review_noise_terms(&conn).unwrap();

        assert_eq!(saved, vec!["developer experience".to_string(), "you".to_string()]);
        assert_eq!(reloaded, saved);
    }
}