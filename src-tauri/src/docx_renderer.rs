use crate::resume_assembler::{
    AssembledResumeArtifact, ProjectEntry, ResumeHeader, ToolkitSection,
};
use docx_rs::{
    AlignmentType, Docx, PageMargin, Paragraph, Run, SpecialIndentType, Tab, TabValueType,
};
use std::fs;
use std::fs::File;
use std::path::Path;

const TOOLKIT_GROUP_ORDER: [&str; 6] = [
    "Systems & Platforms",
    "Implementation & Delivery",
    "Testing & Quality",
    "Training & Documentation",
    "Interpersonal & Leadership",
    "Reporting & Analytics",
];
const PAGE_TOP_MARGIN_TWIPS: i32 = 720;
const PAGE_BOTTOM_MARGIN_TWIPS: i32 = 720;
const PAGE_LEFT_MARGIN_TWIPS: i32 = 864;
const PAGE_RIGHT_MARGIN_TWIPS: i32 = 864;
const HEADER_MARGIN_TWIPS: i32 = 576;
const FOOTER_MARGIN_TWIPS: i32 = 576;
const BULLET_LEFT_INDENT_TWIPS: i32 = 317;
const BULLET_HANGING_INDENT_TWIPS: i32 = 259;
const RIGHT_TAB_POSITION_TWIPS: usize = 10_512;

pub fn render_resume_artifact(
    artifact: &AssembledResumeArtifact,
    output_path: &Path,
) -> Result<(), String> {
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create DOCX artifact directory {}: {error}",
                parent.display()
            )
        })?;
    }

    let mut docx = Docx::new().page_margin(
        PageMargin::new()
            .top(PAGE_TOP_MARGIN_TWIPS)
            .bottom(PAGE_BOTTOM_MARGIN_TWIPS)
            .left(PAGE_LEFT_MARGIN_TWIPS)
            .right(PAGE_RIGHT_MARGIN_TWIPS)
            .header(HEADER_MARGIN_TWIPS)
            .footer(FOOTER_MARGIN_TWIPS),
    );

    docx = docx.add_paragraph(render_name_paragraph(&artifact.resume.header));
    let contact_line = build_contact_line(&artifact.resume.header);
    if !contact_line.is_empty() {
        docx = docx.add_paragraph(render_contact_paragraph(&contact_line));
    }

    if let Some(toolkit) = &artifact.resume.toolkit {
        docx = docx.add_paragraph(render_section_heading("Toolkit"));
        for (group_name, items) in ordered_toolkit_groups(toolkit) {
            docx = docx.add_paragraph(render_inline_label_paragraph(
                &group_name,
                &items.join(", "),
            ));
        }
    }

    if !artifact.resume.highlights.is_empty() {
        docx = docx.add_paragraph(render_section_heading("Highlights"));
        for highlight in &artifact.resume.highlights {
            docx = docx.add_paragraph(render_bullet_paragraph(&highlight.text));
        }
    }

    if let Some(profile) = &artifact.resume.profile {
        docx = docx.add_paragraph(render_section_heading("Profile"));
        docx = docx.add_paragraph(render_body_paragraph(&profile.text));
    }

    if !artifact.resume.professional_experience.is_empty() {
        docx = docx.add_paragraph(render_section_heading("Professional Experience"));
        for entry in &artifact.resume.professional_experience {
            docx = docx.add_paragraph(render_role_heading_paragraph(
                &entry.title,
                &entry.organization,
                &entry.date_range,
            ));
            if let Some(location) = entry.location.as_deref().filter(|value| !value.trim().is_empty()) {
                docx = docx.add_paragraph(render_location_paragraph(location));
            }
            for bullet in &entry.bullets {
                docx = docx.add_paragraph(render_bullet_paragraph(&bullet.text));
            }
        }
    }

    if !artifact.resume.projects.is_empty() {
        docx = docx.add_paragraph(render_section_heading("Projects"));
        for entry in &artifact.resume.projects {
            docx = docx.add_paragraph(render_project_heading_paragraph(entry));
            for bullet in &entry.bullets {
                docx = docx.add_paragraph(render_bullet_paragraph(&bullet.text));
            }
        }
    }

    if !artifact.resume.education.is_empty() {
        docx = docx.add_paragraph(render_section_heading("Education"));
        for item in &artifact.resume.education {
            docx = docx.add_paragraph(render_bullet_paragraph(&item.text));
        }
    }

    if !artifact.resume.certifications.is_empty() {
        docx = docx.add_paragraph(render_section_heading("Certifications"));
        for item in &artifact.resume.certifications {
            docx = docx.add_paragraph(render_bullet_paragraph(&item.text));
        }
    }

    let output_file = File::create(output_path).map_err(|error| {
        format!(
            "Failed to create DOCX artifact {}: {error}",
            output_path.display()
        )
    })?;
    docx.build()
        .pack(output_file)
        .map_err(|error| format!("DOCX rendering failed: {error}"))
}

fn build_contact_line(header: &ResumeHeader) -> String {
    [
        header.location.as_str(),
        header.email.as_str(),
        header.phone.as_str(),
        header.linkedin.as_str(),
        header.github.as_str(),
    ]
    .into_iter()
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .collect::<Vec<_>>()
    .join(" | ")
}

fn ordered_toolkit_groups(toolkit: &ToolkitSection) -> Vec<(String, Vec<String>)> {
    let order_lookup = TOOLKIT_GROUP_ORDER
        .iter()
        .enumerate()
        .map(|(index, group)| (*group, index))
        .collect::<std::collections::HashMap<_, _>>();
    let mut indexed_groups = toolkit.groups.iter().enumerate().collect::<Vec<_>>();
    indexed_groups.sort_by_key(|(index, group)| {
        (
            order_lookup
                .get(group.group_name.as_str())
                .copied()
                .unwrap_or(usize::MAX),
            *index,
        )
    });
    indexed_groups
        .into_iter()
        .map(|(_, group)| (group.group_name.clone(), group.items.clone()))
        .collect()
}

fn render_name_paragraph(header: &ResumeHeader) -> Paragraph {
    Paragraph::new()
        .align(AlignmentType::Center)
        .add_run(styled_run(&header.display_name, 32, Some("000000"), true, false))
}

fn render_contact_paragraph(text: &str) -> Paragraph {
    Paragraph::new()
        .align(AlignmentType::Center)
        .add_run(styled_run(text, 20, Some("434343"), false, false))
}

fn render_section_heading(text: &str) -> Paragraph {
    Paragraph::new().add_run(styled_run(
        &text.to_uppercase(),
        22,
        Some("000000"),
        true,
        false,
    ))
}

fn render_body_paragraph(text: &str) -> Paragraph {
    Paragraph::new().add_run(styled_run(text, 21, Some("000000"), false, false))
}

fn render_inline_label_paragraph(label: &str, value: &str) -> Paragraph {
    let mut paragraph = Paragraph::new();
    if !label.trim().is_empty() {
        paragraph = paragraph.add_run(styled_run(
            &format!("{label}: "),
            21,
            Some("134F5C"),
            true,
            false,
        ));
    }
    paragraph.add_run(styled_run(value, 21, Some("434343"), false, true))
}

fn render_role_heading_paragraph(title: &str, organization: &str, date_range: &str) -> Paragraph {
    let mut paragraph = Paragraph::new().add_tab(
        Tab::new()
            .val(TabValueType::Right)
            .pos(RIGHT_TAB_POSITION_TWIPS),
    );
    if !title.trim().is_empty() {
        paragraph = paragraph.add_run(styled_run(title, 21, Some("134F5C"), false, false));
    }
    if !title.trim().is_empty() && !organization.trim().is_empty() {
        paragraph = paragraph.add_run(styled_run(" | ", 21, Some("000000"), false, false));
    }
    if !organization.trim().is_empty() {
        paragraph = paragraph.add_run(styled_run(organization, 21, Some("000000"), false, false));
    }
    if !date_range.trim().is_empty() {
        paragraph = paragraph
            .add_run(Run::new().add_tab())
            .add_run(styled_run(date_range, 21, Some("134F5C"), false, false));
    }
    paragraph
}

fn render_project_heading_paragraph(entry: &ProjectEntry) -> Paragraph {
    render_role_heading_paragraph(&entry.title, &entry.organization, &entry.date_range)
}

fn render_location_paragraph(text: &str) -> Paragraph {
    Paragraph::new().add_run(styled_run(text, 19, Some("45818E"), false, true))
}

fn render_bullet_paragraph(text: &str) -> Paragraph {
    Paragraph::new()
        .indent(
            Some(BULLET_LEFT_INDENT_TWIPS),
            Some(SpecialIndentType::Hanging(BULLET_HANGING_INDENT_TWIPS)),
            None,
            None,
        )
        .add_run(styled_run(
            &format!("• {text}"),
            21,
            Some("000000"),
            false,
            false,
        ))
}

fn styled_run(text: &str, size: usize, color: Option<&str>, bold: bool, italic: bool) -> Run {
    let mut run = Run::new().add_text(text).size(size);
    if let Some(color) = color {
        run = run.color(color);
    }
    if bold {
        run = run.bold();
    }
    if italic {
        run = run.italic();
    }
    run
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::resume_assembler::{
        AssembledResumeArtifact, ClaimToEvidenceMapEntry, ConstraintFlag, ExperienceEntry,
        GapReport, MultiEvidenceClaim, ProfileSection, ProjectEntry, Provenance,
        ResumeHeader, SingleEvidenceClaim, StructuredResume, SupportedRequirement,
        TextSourceItem, ToolkitSection,
    };
    use crate::bundle_prep::DeliveryToolkitGroup;
    use std::env;
    use uuid::Uuid;

    fn sample_artifact() -> AssembledResumeArtifact {
        AssembledResumeArtifact {
            resume: StructuredResume {
                header: ResumeHeader {
                    display_name: "Test User".to_string(),
                    location: "Remote".to_string(),
                    email: "test@example.com".to_string(),
                    phone: "555-0100".to_string(),
                    linkedin: "linkedin/test".to_string(),
                    github: "github/test".to_string(),
                },
                target_role_family: "Analyst".to_string(),
                highlights: vec![MultiEvidenceClaim {
                    text: "Built deterministic export tooling.".to_string(),
                    evidence_ids: vec!["ev-1".to_string()],
                }],
                profile: Some(ProfileSection {
                    text: "Analyst with evidence-backed delivery experience.".to_string(),
                    evidence_ids: vec!["ev-1".to_string()],
                }),
                professional_experience: vec![ExperienceEntry {
                    record_id: "rec-1".to_string(),
                    organization: "Example Org".to_string(),
                    title: "Analyst".to_string(),
                    date_range: "2024-01 - present".to_string(),
                    location: Some("Remote".to_string()),
                    bullets: vec![SingleEvidenceClaim {
                        text: "Built deterministic export tooling.".to_string(),
                        evidence_ids: vec!["ev-1".to_string()],
                    }],
                }],
                projects: vec![ProjectEntry {
                    record_id: "proj-1".to_string(),
                    organization: "Example Org".to_string(),
                    title: "Resume System".to_string(),
                    date_range: "2025-01 - 2025-06".to_string(),
                    bullets: vec![SingleEvidenceClaim {
                        text: "Shipped a native DOCX renderer.".to_string(),
                        evidence_ids: vec!["ev-2".to_string()],
                    }],
                }],
                education: vec![TextSourceItem {
                    text: "BSc, Example University".to_string(),
                    source_id: "edu-1".to_string(),
                }],
                certifications: vec![TextSourceItem {
                    text: "Python Certification".to_string(),
                    source_id: "cert-1".to_string(),
                }],
                toolkit: Some(ToolkitSection {
                    label: "Toolkit".to_string(),
                    groups: vec![DeliveryToolkitGroup {
                        group_name: "Reporting & Analytics".to_string(),
                        items: vec!["Power BI".to_string(), "SQL".to_string()],
                    }],
                }),
            },
            gap_report: GapReport {
                supported_requirements: vec![SupportedRequirement {
                    requirement: "Automation".to_string(),
                    supporting_sources: Vec::new(),
                }],
                partially_supported_requirements: Vec::new(),
                unsupported_requirements: Vec::new(),
                compensation_strategy: Vec::new(),
                risk_flags: Vec::new(),
            },
            provenance: Provenance {
                target_role_family: "Analyst".to_string(),
                selected_record_ids: vec!["rec-1".to_string()],
                selected_evidence_ids: vec!["ev-1".to_string(), "ev-2".to_string()],
                claim_to_evidence_map: vec![ClaimToEvidenceMapEntry {
                    claim_path: "resume.highlights[0]".to_string(),
                    evidence_ids: vec!["ev-1".to_string()],
                }],
                constraint_flags: vec![ConstraintFlag {
                    rule: "normalization_only".to_string(),
                    status: "passed".to_string(),
                    note: "No paraphrasing.".to_string(),
                }],
                notes: Vec::new(),
            },
        }
    }

    #[test]
    fn renders_docx_file_without_python() {
        let artifact = sample_artifact();
        let output_path = env::temp_dir().join(format!("career-ledger-docx-{}.docx", Uuid::new_v4()));

        render_resume_artifact(&artifact, &output_path).unwrap();

        let bytes = fs::read(&output_path).unwrap();
        assert!(bytes.starts_with(b"PK"));
        assert!(bytes.len() > 1_000);

        fs::remove_file(output_path).ok();
    }
}
