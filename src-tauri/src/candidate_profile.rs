use crate::taxonomy::{self, with_transaction};
use crate::validation::{normalize_optional_owned, normalize_required_text, normalize_text_list};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
const ACTIVE_PROFILE_ID: &str = "active";

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct CandidateContact {
    pub email: Option<String>,
    pub phone: Option<String>,
    pub linkedin: Option<String>,
    pub github: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CandidateIdentity {
    pub display_name: String,
    pub location: String,
    #[serde(default)]
    pub contact: CandidateContact,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct CandidateEducationFieldNotes {
    pub major: Option<String>,
    pub minor: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CandidateEducationEntry {
    pub id: String,
    pub institution: String,
    pub credential: String,
    #[serde(default)]
    pub signal_tags: Vec<String>,
    #[serde(default)]
    pub field_notes: CandidateEducationFieldNotes,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CandidateCertificationEntry {
    pub id: String,
    pub name: String,
    pub issuer: String,
    pub credential_detail: String,
    #[serde(default)]
    pub signal_tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct CandidateStaticSections {
    #[serde(default)]
    pub education: Vec<CandidateEducationEntry>,
    #[serde(default)]
    pub certifications: Vec<CandidateCertificationEntry>,
    #[serde(default)]
    pub profile_summary_seed: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CandidateProfile {
    pub version: String,
    pub config_type: String,
    pub candidate_identity: CandidateIdentity,
    pub static_sections: CandidateStaticSections,
}

fn tags_to_json(tags: &[String]) -> String {
    serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string())
}

fn parse_tags(raw: Option<String>) -> Vec<String> {
    raw.and_then(|value| serde_json::from_str::<Vec<String>>(&value).ok())
        .unwrap_or_default()
}

fn normalize_signal_tags(
    conn: &Connection,
    tags: Vec<String>,
    label: &str,
) -> Result<Vec<String>, String> {
    if tags.is_empty() {
        return Ok(Vec::new());
    }

    taxonomy::canonicalize_tags(conn, &tags)
        .map_err(|error| format!("{label} contains invalid signal tags: {error}"))
}

fn normalize_profile(
    conn: &Connection,
    profile: CandidateProfile,
) -> Result<CandidateProfile, String> {
    let version =
        normalize_required_text(Some(profile.version.as_str()), "candidate_profile.version")?;
    let config_type = normalize_required_text(
        Some(profile.config_type.as_str()),
        "candidate_profile.config_type",
    )?;
    if config_type != "candidate_profile" {
        return Err("candidate_profile.config_type must equal 'candidate_profile'.".to_string());
    }

    let display_name = normalize_required_text(
        Some(profile.candidate_identity.display_name.as_str()),
        "candidate_profile.candidate_identity.display_name",
    )?;
    let location = normalize_required_text(
        Some(profile.candidate_identity.location.as_str()),
        "candidate_profile.candidate_identity.location",
    )?;
    let contact = CandidateContact {
        email: normalize_optional_owned(profile.candidate_identity.contact.email),
        phone: normalize_optional_owned(profile.candidate_identity.contact.phone),
        linkedin: normalize_optional_owned(profile.candidate_identity.contact.linkedin),
        github: normalize_optional_owned(profile.candidate_identity.contact.github),
    };

    let mut seen_education_ids = HashSet::new();
    let mut education = Vec::new();
    for (index, entry) in profile.static_sections.education.into_iter().enumerate() {
        let label_prefix = format!("candidate_profile.static_sections.education[{}]", index + 1);
        let id = normalize_required_text(Some(entry.id.as_str()), &format!("{label_prefix}.id"))?;
        if !seen_education_ids.insert(id.clone()) {
            return Err(format!(
                "{label_prefix}.id must be unique within education rows."
            ));
        }
        let institution = normalize_required_text(
            Some(entry.institution.as_str()),
            &format!("{label_prefix}.institution"),
        )?;
        let credential = normalize_required_text(
            Some(entry.credential.as_str()),
            &format!("{label_prefix}.credential"),
        )?;
        let signal_tags = normalize_signal_tags(
            conn,
            entry.signal_tags,
            &format!("{label_prefix}.signal_tags"),
        )?;

        education.push(CandidateEducationEntry {
            id,
            institution,
            credential,
            signal_tags,
            field_notes: CandidateEducationFieldNotes {
                major: normalize_optional_owned(entry.field_notes.major),
                minor: normalize_optional_owned(entry.field_notes.minor),
            },
        });
    }

    let mut seen_certification_ids = HashSet::new();
    let mut certifications = Vec::new();
    for (index, entry) in profile
        .static_sections
        .certifications
        .into_iter()
        .enumerate()
    {
        let label_prefix = format!(
            "candidate_profile.static_sections.certifications[{}]",
            index + 1
        );
        let id = normalize_required_text(Some(entry.id.as_str()), &format!("{label_prefix}.id"))?;
        if !seen_certification_ids.insert(id.clone()) {
            return Err(format!(
                "{label_prefix}.id must be unique within certification rows."
            ));
        }
        let name =
            normalize_required_text(Some(entry.name.as_str()), &format!("{label_prefix}.name"))?;
        let issuer = normalize_required_text(
            Some(entry.issuer.as_str()),
            &format!("{label_prefix}.issuer"),
        )?;
        let credential_detail = normalize_required_text(
            Some(entry.credential_detail.as_str()),
            &format!("{label_prefix}.credential_detail"),
        )?;
        let signal_tags = normalize_signal_tags(
            conn,
            entry.signal_tags,
            &format!("{label_prefix}.signal_tags"),
        )?;

        certifications.push(CandidateCertificationEntry {
            id,
            name,
            issuer,
            credential_detail,
            signal_tags,
        });
    }

    let profile_summary_seed = normalize_text_list(
        &profile.static_sections.profile_summary_seed,
        "candidate_profile.static_sections.profile_summary_seed",
    )?;

    Ok(CandidateProfile {
        version,
        config_type,
        candidate_identity: CandidateIdentity {
            display_name,
            location,
            contact,
        },
        static_sections: CandidateStaticSections {
            education,
            certifications,
            profile_summary_seed,
        },
    })
}

pub fn get_candidate_profile(conn: &Connection) -> Result<Option<CandidateProfile>, String> {
    let row = conn
        .query_row(
            "SELECT version, config_type, display_name, location, email, phone, linkedin, github
             FROM candidate_profiles
             WHERE id = ?1",
            params![ACTIVE_PROFILE_ID],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, Option<String>>(6)?,
                    row.get::<_, Option<String>>(7)?,
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;

    let Some((version, config_type, display_name, location, email, phone, linkedin, github)) = row
    else {
        return Ok(None);
    };

    let mut education_stmt = conn
        .prepare(
            "SELECT id, institution, credential, signal_tags_json, major, minor
             FROM candidate_profile_education
             WHERE profile_id = ?1
             ORDER BY sort_order ASC, id ASC",
        )
        .map_err(|error| error.to_string())?;
    let education_rows = education_stmt
        .query_map(params![ACTIVE_PROFILE_ID], |row| {
            Ok(CandidateEducationEntry {
                id: row.get(0)?,
                institution: row.get(1)?,
                credential: row.get(2)?,
                signal_tags: parse_tags(row.get(3)?),
                field_notes: CandidateEducationFieldNotes {
                    major: row.get(4)?,
                    minor: row.get(5)?,
                },
            })
        })
        .map_err(|error| error.to_string())?;
    let education = education_rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut certifications_stmt = conn
        .prepare(
            "SELECT id, name, issuer, credential_detail, signal_tags_json
             FROM candidate_profile_certifications
             WHERE profile_id = ?1
             ORDER BY sort_order ASC, id ASC",
        )
        .map_err(|error| error.to_string())?;
    let certification_rows = certifications_stmt
        .query_map(params![ACTIVE_PROFILE_ID], |row| {
            Ok(CandidateCertificationEntry {
                id: row.get(0)?,
                name: row.get(1)?,
                issuer: row.get(2)?,
                credential_detail: row.get(3)?,
                signal_tags: parse_tags(row.get(4)?),
            })
        })
        .map_err(|error| error.to_string())?;
    let certifications = certification_rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut summary_stmt = conn
        .prepare(
            "SELECT line_text
             FROM candidate_profile_summary_lines
             WHERE profile_id = ?1
             ORDER BY sort_order ASC, id ASC",
        )
        .map_err(|error| error.to_string())?;
    let summary_rows = summary_stmt
        .query_map(params![ACTIVE_PROFILE_ID], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;
    let profile_summary_seed = summary_rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(Some(CandidateProfile {
        version,
        config_type,
        candidate_identity: CandidateIdentity {
            display_name,
            location,
            contact: CandidateContact {
                email,
                phone,
                linkedin,
                github,
            },
        },
        static_sections: CandidateStaticSections {
            education,
            certifications,
            profile_summary_seed,
        },
    }))
}

pub fn replace_candidate_profile(
    conn: &Connection,
    profile: CandidateProfile,
) -> Result<CandidateProfile, String> {
    let normalized = normalize_profile(conn, profile)?;

    with_transaction(conn, |conn| {
        conn.execute(
            "INSERT INTO candidate_profiles (
                id, version, config_type, display_name, location, email, phone, linkedin, github,
                created_at, updated_at
             ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
                strftime('%Y-%m-%dT%H:%M:%SZ','now'),
                strftime('%Y-%m-%dT%H:%M:%SZ','now')
             )
             ON CONFLICT(id) DO UPDATE SET
                version = excluded.version,
                config_type = excluded.config_type,
                display_name = excluded.display_name,
                location = excluded.location,
                email = excluded.email,
                phone = excluded.phone,
                linkedin = excluded.linkedin,
                github = excluded.github,
                updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')",
            params![
                ACTIVE_PROFILE_ID,
                normalized.version,
                normalized.config_type,
                normalized.candidate_identity.display_name,
                normalized.candidate_identity.location,
                normalized.candidate_identity.contact.email,
                normalized.candidate_identity.contact.phone,
                normalized.candidate_identity.contact.linkedin,
                normalized.candidate_identity.contact.github,
            ],
        )
        .map_err(|error| error.to_string())?;

        conn.execute(
            "DELETE FROM candidate_profile_education WHERE profile_id = ?1",
            params![ACTIVE_PROFILE_ID],
        )
        .map_err(|error| error.to_string())?;
        conn.execute(
            "DELETE FROM candidate_profile_certifications WHERE profile_id = ?1",
            params![ACTIVE_PROFILE_ID],
        )
        .map_err(|error| error.to_string())?;
        conn.execute(
            "DELETE FROM candidate_profile_summary_lines WHERE profile_id = ?1",
            params![ACTIVE_PROFILE_ID],
        )
        .map_err(|error| error.to_string())?;

        for (index, entry) in normalized.static_sections.education.iter().enumerate() {
            conn.execute(
                "INSERT INTO candidate_profile_education (
                    id, profile_id, sort_order, institution, credential, signal_tags_json,
                    major, minor, created_at, updated_at
                 ) VALUES (
                    ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
                    strftime('%Y-%m-%dT%H:%M:%SZ','now'),
                    strftime('%Y-%m-%dT%H:%M:%SZ','now')
                 )",
                params![
                    entry.id,
                    ACTIVE_PROFILE_ID,
                    index as i64,
                    entry.institution,
                    entry.credential,
                    tags_to_json(&entry.signal_tags),
                    entry.field_notes.major,
                    entry.field_notes.minor,
                ],
            )
            .map_err(|error| error.to_string())?;
        }

        for (index, entry) in normalized.static_sections.certifications.iter().enumerate() {
            conn.execute(
                "INSERT INTO candidate_profile_certifications (
                    id, profile_id, sort_order, name, issuer, credential_detail, signal_tags_json,
                    created_at, updated_at
                 ) VALUES (
                    ?1, ?2, ?3, ?4, ?5, ?6, ?7,
                    strftime('%Y-%m-%dT%H:%M:%SZ','now'),
                    strftime('%Y-%m-%dT%H:%M:%SZ','now')
                 )",
                params![
                    entry.id,
                    ACTIVE_PROFILE_ID,
                    index as i64,
                    entry.name,
                    entry.issuer,
                    entry.credential_detail,
                    tags_to_json(&entry.signal_tags),
                ],
            )
            .map_err(|error| error.to_string())?;
        }

        for (index, line_text) in normalized
            .static_sections
            .profile_summary_seed
            .iter()
            .enumerate()
        {
            conn.execute(
                "INSERT INTO candidate_profile_summary_lines (
                    id, profile_id, sort_order, line_text, created_at, updated_at
                 ) VALUES (
                    ?1, ?2, ?3, ?4,
                    strftime('%Y-%m-%dT%H:%M:%SZ','now'),
                    strftime('%Y-%m-%dT%H:%M:%SZ','now')
                 )",
                params![
                    format!("candidate_profile_summary_{}", index + 1),
                    ACTIVE_PROFILE_ID,
                    index as i64,
                    line_text,
                ],
            )
            .map_err(|error| error.to_string())?;
        }

        Ok(())
    })?;

    get_candidate_profile(conn)?
        .ok_or_else(|| "Candidate profile was not found after save.".to_string())
}

pub fn delete_candidate_profile(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "DELETE FROM candidate_profiles WHERE id = ?1",
        params![ACTIVE_PROFILE_ID],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn get_candidate_profile_certification_tags(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT signal_tags_json
             FROM candidate_profile_certifications
             WHERE profile_id = ?1
             ORDER BY sort_order ASC, id ASC",
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(params![ACTIVE_PROFILE_ID], |row| {
            row.get::<_, Option<String>>(0)
        })
        .map_err(|error| error.to_string())?;

    let mut seen = HashSet::new();
    let mut tags = Vec::new();
    for row in rows {
        let raw = row.map_err(|error| error.to_string())?;
        for tag in parse_tags(raw) {
            if seen.insert(tag.clone()) {
                tags.push(tag);
            }
        }
    }
    Ok(tags)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::taxonomy::ensure_runtime_taxonomy_seeded;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(crate::embedded_assets::CAREER_SCHEMA_SQL)
            .unwrap();
        conn
    }

    #[test]
    fn replace_round_trips_and_canonicalizes_signal_tags() {
        let conn = setup_conn();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();

        let saved = replace_candidate_profile(
            &conn,
            CandidateProfile {
                version: "1.0".to_string(),
                config_type: "candidate_profile".to_string(),
                candidate_identity: CandidateIdentity {
                    display_name: "Test Candidate".to_string(),
                    location: "Calgary AB".to_string(),
                    contact: CandidateContact {
                        email: Some("person@example.com".to_string()),
                        phone: None,
                        linkedin: None,
                        github: None,
                    },
                },
                static_sections: CandidateStaticSections {
                    education: vec![CandidateEducationEntry {
                        id: "edu-1".to_string(),
                        institution: "Example University".to_string(),
                        credential: "BSc".to_string(),
                        signal_tags: vec!["Python".to_string()],
                        field_notes: CandidateEducationFieldNotes {
                            major: Some("Computer Science".to_string()),
                            minor: None,
                        },
                    }],
                    certifications: vec![CandidateCertificationEntry {
                        id: "cert-1".to_string(),
                        name: "Python Certification".to_string(),
                        issuer: "Example Issuer".to_string(),
                        credential_detail: "Issued 2024".to_string(),
                        signal_tags: vec![" python ".to_string(), "python".to_string()],
                    }],
                    profile_summary_seed: vec![
                        " Built evidence-bounded systems. ".to_string(),
                        "Built evidence-bounded systems.".to_string(),
                    ],
                },
            },
        )
        .unwrap();

        assert_eq!(saved.candidate_identity.display_name, "Test Candidate");
        assert_eq!(
            saved.static_sections.certifications[0].signal_tags,
            vec!["python".to_string()]
        );
        assert_eq!(
            saved.static_sections.profile_summary_seed,
            vec!["Built evidence-bounded systems.".to_string()]
        );

        let loaded = get_candidate_profile(&conn).unwrap().unwrap();
        assert_eq!(loaded.candidate_identity.location, "Calgary AB");
        assert_eq!(
            get_candidate_profile_certification_tags(&conn).unwrap(),
            vec!["python".to_string()]
        );
    }
}
