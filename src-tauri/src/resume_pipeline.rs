use crate::build_policy;
use crate::bundle_prep::ResumeBundleInput;
use crate::candidate_profile::{self, CandidateProfile};
use crate::docx_renderer;
use crate::library_export::{self, CareerLibraryExport};
use crate::operations::{
    self, GenerationManifest, GenerationManifestArtifactMap, NewGenerationManifest,
};
use crate::preflight_filter::{self, PreflightFilterResult};
use crate::project_paths::runtime_repo_root;
use crate::requirement_analysis::{self, RequirementAnalysis};
use crate::resume_assembler::{self, ResumeAssemblyResult};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

const ARTIFACT_KIND_ASSEMBLED_RESUME: &str = "assembled_resume";

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ResumePipelineRequest {
    pub job_posting_text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reviewed_requirement_analysis: Option<RequirementAnalysis>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub requirement_review: Option<RequirementReviewOverride>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artifact_output_dir: Option<String>,
    /// Custom prefix for artifact filenames. If provided, replaces the auto-generated
    /// `resume_{role_slug}` prefix. Validated: no path separators, max 100 chars.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artifact_base_name: Option<String>,
    #[serde(default)]
    pub write_bundle_json: bool,
    #[serde(default)]
    pub render_docx: bool,
    #[serde(default)]
    pub persist_manifest: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manifest_notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct RequirementReviewOverride {
    pub source_job_posting_sha256: String,
    #[serde(default)]
    pub reviewed_cluster_ids: Vec<String>,
    #[serde(default)]
    pub excluded_cluster_ids: Vec<String>,
    #[serde(default)]
    pub excluded_atom_ids: Vec<String>,
    #[serde(default)]
    pub useful_terms: Vec<String>,
    #[serde(default)]
    pub noise_terms: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ResumeArtifactFile {
    pub path: String,
    pub sha256: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ResumeGeneratedArtifacts {
    pub output_dir: String,
    pub assembled_json: ResumeArtifactFile,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bundle_json: Option<ResumeArtifactFile>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rendered_docx: Option<ResumeArtifactFile>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResumePipelineResult {
    pub career_library_export: CareerLibraryExport,
    pub requirement_analysis: RequirementAnalysis,
    pub preflight_result: PreflightFilterResult,
    pub bundle: ResumeBundleInput,
    pub assembly_result: ResumeAssemblyResult,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generated_artifacts: Option<ResumeGeneratedArtifacts>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generation_manifest: Option<GenerationManifest>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requirement_review: Option<RequirementReviewOverride>,
}

pub fn run_resume_pipeline(
    conn: &Connection,
    active_db_path: Option<&str>,
    request: &ResumePipelineRequest,
) -> Result<ResumePipelineResult, String> {
    let candidate_profile = candidate_profile::get_candidate_profile(conn)?
        .ok_or("Active candidate profile not found")?;
    let source_db_name = source_db_name(active_db_path);
    let career_library_export = library_export::build_career_library_export(conn, &source_db_name)?;
    let base_requirement_analysis =
        requirement_analysis::build_requirement_analysis(conn, &request.job_posting_text)?;
    let (requirement_analysis, requirement_review) = resolve_reviewed_requirement_analysis(
        &base_requirement_analysis,
        request.reviewed_requirement_analysis.clone(),
        request.requirement_review.clone(),
    )?;
    let (build_policy, build_policy_snapshot_json) = build_policy::get_build_policy_snapshot(conn)?;
    let build_policy_sha256 = sha256_hex(build_policy_snapshot_json.as_bytes());
    let preflight_config = build_policy.effective_preflight_config();
    let preflight_result = preflight_filter::run_preflight_filter(
        &career_library_export,
        &requirement_analysis,
        preflight_config.threshold,
        preflight_config.fallback_min_records,
    )
    .map_err(|error| error.to_string())?;
    let bundle = crate::bundle_prep::prepare_resume_bundle(
        conn,
        &candidate_profile,
        &preflight_result.career_library_export,
        &build_policy,
        &request.job_posting_text,
        &requirement_analysis,
        &preflight_result.preflight_report,
    )?;
    let assembly_result = resume_assembler::assemble_resume(&bundle)?;
    let validated_base_name = validate_artifact_base_name(&request.artifact_base_name)?;
    let generated_artifacts = match normalize_optional_string(&request.artifact_output_dir) {
        Some(output_dir) => Some(write_resume_artifacts(
            &bundle,
            &assembly_result,
            &output_dir,
            validated_base_name.as_deref(),
            request.write_bundle_json,
            request.render_docx,
        )?),
        None => {
            if request.write_bundle_json || request.render_docx {
                return Err(
                    "artifact_output_dir is required when bundle JSON or DOCX artifact generation is enabled."
                        .to_string(),
                );
            }
            None
        }
    };
    let generation_manifest = if request.persist_manifest {
        Some(persist_generation_manifest(
            conn,
            &candidate_profile,
            &career_library_export,
            &request.job_posting_text,
            build_policy::BUILD_POLICY_SOURCE_URI,
            &build_policy_sha256,
            &assembly_result,
            generated_artifacts.as_ref(),
            requirement_review.as_ref(),
            normalize_optional_string(&request.manifest_notes),
        )?)
    } else {
        None
    };

    Ok(ResumePipelineResult {
        career_library_export,
        requirement_analysis,
        preflight_result,
        bundle,
        assembly_result,
        generated_artifacts,
        generation_manifest,
        requirement_review,
    })
}

fn resolve_reviewed_requirement_analysis(
    base_requirement_analysis: &RequirementAnalysis,
    reviewed_requirement_analysis: Option<RequirementAnalysis>,
    requirement_review: Option<RequirementReviewOverride>,
) -> Result<(RequirementAnalysis, Option<RequirementReviewOverride>), String> {
    match (reviewed_requirement_analysis, requirement_review) {
        (None, None) => Ok((base_requirement_analysis.clone(), None)),
        (Some(_), None) | (None, Some(_)) => Err(
            "reviewed_requirement_analysis and requirement_review must be provided together."
                .to_string(),
        ),
        (Some(reviewed), Some(review)) => {
            let expected_hash = &base_requirement_analysis.source.job_posting_sha256;
            if review.source_job_posting_sha256 != *expected_hash {
                return Err("Requirement review belongs to a different job posting. Re-run Analyze Posting before generating.".to_string());
            }
            if reviewed.source.job_posting_sha256 != *expected_hash {
                return Err("Reviewed requirement analysis belongs to a different job posting. Re-run Analyze Posting before generating.".to_string());
            }
            Ok((reviewed, Some(review)))
        }
    }
}

fn write_resume_artifacts(
    bundle: &ResumeBundleInput,
    assembly_result: &ResumeAssemblyResult,
    artifact_output_dir: &str,
    custom_base_name: Option<&str>,
    write_bundle_json: bool,
    render_docx: bool,
) -> Result<ResumeGeneratedArtifacts, String> {
    let output_dir = resolve_output_dir(artifact_output_dir)?;
    let output_dir_string = output_dir.display().to_string();
    let base_stem = match custom_base_name {
        Some(name) => format!("{name}_{}", Uuid::new_v4().simple()),
        None => artifact_base_stem(&assembly_result.artifact.provenance.target_role_family),
    };

    let assembled_json = write_json_artifact(
        &output_dir.join(format!("{base_stem}_assembled.json")),
        &assembly_result.artifact,
    )?;
    let bundle_json = if write_bundle_json {
        Some(write_json_artifact(
            &output_dir.join(format!("{base_stem}_bundle.json")),
            bundle,
        )?)
    } else {
        None
    };
    let rendered_docx = if render_docx {
        Some(render_docx_artifact(
            &assembly_result.artifact,
            &output_dir.join(format!("{base_stem}.docx")),
        )?)
    } else {
        None
    };

    Ok(ResumeGeneratedArtifacts {
        output_dir: output_dir_string,
        assembled_json,
        bundle_json,
        rendered_docx,
    })
}

fn persist_generation_manifest(
    conn: &Connection,
    candidate_profile: &CandidateProfile,
    career_library_export: &CareerLibraryExport,
    job_posting_text: &str,
    build_policy_path: &str,
    build_policy_sha256: &str,
    assembly_result: &ResumeAssemblyResult,
    generated_artifacts: Option<&ResumeGeneratedArtifacts>,
    requirement_review: Option<&RequirementReviewOverride>,
    manifest_notes: Option<String>,
) -> Result<GenerationManifest, String> {
    operations::create_generation_manifest(
        conn,
        NewGenerationManifest {
            artifact_kind: ARTIFACT_KIND_ASSEMBLED_RESUME.to_string(),
            target_role_family: Some(
                assembly_result
                    .artifact
                    .provenance
                    .target_role_family
                    .clone(),
            ),
            job_posting_path: None,
            job_posting_sha256: Some(sha256_hex(job_posting_text.as_bytes())),
            build_policy_path: Some(build_policy_path.to_string()),
            build_policy_sha256: Some(build_policy_sha256.to_string()),
            candidate_profile_path: None,
            candidate_profile_sha256: Some(sha256_json(candidate_profile)?),
            library_export_path: None,
            library_export_sha256: Some(sha256_json(career_library_export)?),
            selected_record_ids: Some(assembly_result.selected_record_ids.clone()),
            selected_evidence_ids: Some(assembly_result.selected_evidence_ids.clone()),
            gap_report: Some(assembly_result.artifact.gap_report.clone()),
            artifact_paths: generated_artifacts.map(artifact_paths_json),
            artifact_hashes: generated_artifacts.map(artifact_hashes_json),
            requirement_review: requirement_review.cloned(),
            notes: manifest_notes,
        },
    )
}

fn artifact_paths_json(generated_artifacts: &ResumeGeneratedArtifacts) -> GenerationManifestArtifactMap {
    GenerationManifestArtifactMap {
        assembled_json: generated_artifacts.assembled_json.path.clone(),
        bundle_json: generated_artifacts
            .bundle_json
            .as_ref()
            .map(|bundle_json| bundle_json.path.clone()),
        rendered_docx: generated_artifacts
            .rendered_docx
            .as_ref()
            .map(|rendered_docx| rendered_docx.path.clone()),
    }
}

fn artifact_hashes_json(
    generated_artifacts: &ResumeGeneratedArtifacts,
) -> GenerationManifestArtifactMap {
    GenerationManifestArtifactMap {
        assembled_json: generated_artifacts.assembled_json.sha256.clone(),
        bundle_json: generated_artifacts
            .bundle_json
            .as_ref()
            .map(|bundle_json| bundle_json.sha256.clone()),
        rendered_docx: generated_artifacts
            .rendered_docx
            .as_ref()
            .map(|rendered_docx| rendered_docx.sha256.clone()),
    }
}

fn resolve_output_dir(artifact_output_dir: &str) -> Result<PathBuf, String> {
    let requested_path = PathBuf::from(artifact_output_dir);
    let candidate = if requested_path.is_absolute() {
        requested_path
    } else {
        runtime_repo_root()?.join(requested_path)
    };
    fs::create_dir_all(&candidate).map_err(|error| {
        format!(
            "Failed to create artifact output directory {}: {error}",
            candidate.display()
        )
    })?;
    candidate.canonicalize().map_err(|error| {
        format!(
            "Failed to resolve artifact output directory {}: {error}",
            candidate.display()
        )
    })
}

fn validate_artifact_base_name(value: &Option<String>) -> Result<Option<String>, String> {
    let Some(raw) = normalize_optional_string(value) else {
        return Ok(None);
    };

    if raw.len() > 100 {
        return Err("Artifact base name must be 100 characters or fewer.".to_string());
    }
    if raw.contains('/') || raw.contains('\\') || raw.contains('\0') {
        return Err("Artifact base name must not contain path separators.".to_string());
    }

    // Slugify to a safe filename segment
    let slugified = slugify_filename_segment(&raw);
    if slugified.is_empty() {
        return Err("Artifact base name contains no valid filename characters.".to_string());
    }

    Ok(Some(slugified))
}

fn artifact_base_stem(target_role_family: &str) -> String {
    let role_slug = slugify_filename_segment(target_role_family);
    let role_segment = if role_slug.is_empty() {
        "resume".to_string()
    } else {
        role_slug
    };

    format!("resume_{role_segment}_{}", Uuid::new_v4().simple())
}

fn slugify_filename_segment(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '_'
            }
        })
        .collect::<String>()
        .split('_')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("_")
}

fn write_json_artifact<T: Serialize>(
    path: &Path,
    payload: &T,
) -> Result<ResumeArtifactFile, String> {
    let bytes = serde_json::to_vec_pretty(payload).map_err(|error| error.to_string())?;
    let mut bytes_with_newline = bytes;
    bytes_with_newline.push(b'\n');

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create artifact parent directory {}: {error}",
                parent.display()
            )
        })?;
    }
    fs::write(path, &bytes_with_newline)
        .map_err(|error| format!("Failed to write artifact JSON {}: {error}", path.display()))?;

    let resolved_path = path.canonicalize().map_err(|error| {
        format!(
            "Failed to resolve artifact JSON path {}: {error}",
            path.display()
        )
    })?;

    Ok(ResumeArtifactFile {
        path: resolved_path.display().to_string(),
        sha256: sha256_hex(&bytes_with_newline),
    })
}

fn render_docx_artifact(
    assembled_artifact: &crate::resume_assembler::AssembledResumeArtifact,
    docx_output_path: &Path,
) -> Result<ResumeArtifactFile, String> {
    if let Some(parent) = docx_output_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create DOCX artifact directory {}: {error}",
                parent.display()
            )
        })?;
    }
    docx_renderer::render_resume_artifact(assembled_artifact, docx_output_path)?;

    let resolved_path = docx_output_path.canonicalize().map_err(|error| {
        format!(
            "Failed to resolve rendered DOCX path {}: {error}",
            docx_output_path.display()
        )
    })?;
    let bytes = fs::read(&resolved_path).map_err(|error| {
        format!(
            "Failed to read rendered DOCX artifact {}: {error}",
            resolved_path.display()
        )
    })?;

    Ok(ResumeArtifactFile {
        path: resolved_path.display().to_string(),
        sha256: sha256_hex(&bytes),
    })
}

fn source_db_name(active_db_path: Option<&str>) -> String {
    active_db_path
        .and_then(|value| Path::new(value).file_name())
        .and_then(|value| value.to_str())
        .map(str::to_string)
        .unwrap_or_else(|| "career.db".to_string())
}

fn normalize_optional_string(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn sha256_json<T: Serialize>(value: &T) -> Result<String, String> {
    let bytes = serde_json::to_vec(value).map_err(|error| error.to_string())?;
    Ok(sha256_hex(&bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::candidate_profile::{
        replace_candidate_profile, CandidateCertificationEntry, CandidateContact,
        CandidateEducationEntry, CandidateEducationFieldNotes, CandidateIdentity, CandidateProfile,
        CandidateStaticSections,
    };
    use crate::operations::get_generation_manifests;
    use crate::taxonomy::ensure_runtime_taxonomy_seeded;
    use rusqlite::params;
    use serde_json::json;
    use std::env;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(crate::embedded_assets::CAREER_SCHEMA_SQL)
            .unwrap();
        ensure_runtime_taxonomy_seeded(&conn).unwrap();
        conn
    }

    fn seed_candidate_profile(conn: &Connection) {
        replace_candidate_profile(
            conn,
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
                        name: "Python Cert".to_string(),
                        issuer: "Issuer".to_string(),
                        credential_detail: "Level 1".to_string(),
                        signal_tags: vec!["python".to_string()],
                    }],
                    profile_summary_seed: vec![
                        "Built CLI tooling for deterministic exports.".to_string()
                    ],
                },
            },
        )
        .unwrap();
    }

    fn seed_library(conn: &Connection) {
        conn.execute(
            "INSERT INTO experience_records (
                id, slug, record_type, organization, title, start_date, end_date,
                location, context_tags_json, common_context_json
             ) VALUES (?1, ?2, 'employment', ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                "rec-1",
                "role-one",
                "Example Org",
                "Analyst",
                "2024-01",
                "present",
                "Remote",
                serde_json::to_string(&vec!["python", "automation"]).unwrap(),
                json!({}).to_string(),
            ],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO evidence_items (
                id, experience_record_id, claim, tags_json, scope_context_json
             ) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                "ev-1",
                "rec-1",
                "Built CLI tooling for deterministic exports.",
                serde_json::to_string(&vec!["python", "automation"]).unwrap(),
                json!({}).to_string(),
            ],
        )
        .unwrap();
    }

    fn configure_test_build_policy(conn: &Connection) {
        let mut build_policy = build_policy::default_build_policy().unwrap();
        build_policy.max_bullets_per_role = 2;
        build_policy.max_project_bullets = 2;
        build_policy.max_projects = 2;
        build_policy.preflight = Some(build_policy::BuildPolicyPreflight {
            threshold: Some(0.0),
            fallback_min_records: Some(1),
        });
        build_policy.assembler_strategy.max_highlights = 2;
        build_policy.assembler_strategy.bullet_max_chars = 120;
        build_policy.assembler_strategy.highlight_max_chars = 120;
        build_policy.assembler_strategy.profile_max_chars = 120;
        build_policy::save_build_policy(conn, build_policy).unwrap();
    }

    fn temp_output_dir() -> PathBuf {
        let path = env::temp_dir().join(format!("career-ledger-artifacts-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn run_resume_pipeline_returns_stages_without_manifest_writeback() {
        let conn = setup_conn();
        seed_candidate_profile(&conn);
        seed_library(&conn);
        configure_test_build_policy(&conn);

        let result = run_resume_pipeline(
            &conn,
            Some("C:/work/career.db"),
            &ResumePipelineRequest {
                job_posting_text: "Need Python automation support and export tooling.".to_string(),
                reviewed_requirement_analysis: None,
                requirement_review: None,
                artifact_output_dir: None,
                artifact_base_name: None,
                write_bundle_json: false,
                render_docx: false,
                persist_manifest: false,
                manifest_notes: None,
            },
        )
        .unwrap();

        assert!(result.generated_artifacts.is_none());
        assert!(result.generation_manifest.is_none());
        assert_eq!(result.preflight_result.preflight_report.threshold, 0.0);
        assert_eq!(
            result.bundle.build_policy.policy_type,
            "resume_build_policy"
        );
        assert_eq!(result.assembly_result.selected_record_ids, vec!["rec-1"]);
        assert!(get_generation_manifests(&conn).unwrap().is_empty());
    }

    #[test]
    fn run_resume_pipeline_persists_generation_manifest_when_enabled() {
        let conn = setup_conn();
        seed_candidate_profile(&conn);
        seed_library(&conn);
        configure_test_build_policy(&conn);
        let artifact_output_dir = temp_output_dir();

        let result = run_resume_pipeline(
            &conn,
            Some("C:/work/career.db"),
            &ResumePipelineRequest {
                job_posting_text: "Need Python automation support and export tooling.".to_string(),
                reviewed_requirement_analysis: None,
                requirement_review: None,
                artifact_output_dir: Some(artifact_output_dir.display().to_string()),
                artifact_base_name: None,
                write_bundle_json: true,
                render_docx: false,
                persist_manifest: true,
                manifest_notes: Some("preview pipeline".to_string()),
            },
        )
        .unwrap();

        let manifest = result.generation_manifest.as_ref().unwrap();
        let generated_artifacts = result.generated_artifacts.as_ref().unwrap();
        let manifests = get_generation_manifests(&conn).unwrap();

        assert_eq!(manifest.artifact_kind, ARTIFACT_KIND_ASSEMBLED_RESUME);
        assert_eq!(manifest.notes.as_deref(), Some("preview pipeline"));
        assert_eq!(manifests.len(), 1);
        assert_eq!(manifests[0].id, manifest.id);
        assert_eq!(
            manifests[0].selected_record_ids,
            Some(result.assembly_result.selected_record_ids.clone())
        );
        assert_eq!(
            manifests[0].selected_evidence_ids,
            Some(result.assembly_result.selected_evidence_ids.clone())
        );
        assert!(Path::new(&generated_artifacts.assembled_json.path).exists());
        assert!(Path::new(&generated_artifacts.bundle_json.as_ref().unwrap().path).exists());
        assert!(generated_artifacts.rendered_docx.is_none());
        assert_eq!(
            manifests[0].artifact_paths,
            Some(GenerationManifestArtifactMap {
                assembled_json: generated_artifacts.assembled_json.path.clone(),
                bundle_json: Some(generated_artifacts.bundle_json.as_ref().unwrap().path.clone()),
                rendered_docx: None,
            })
        );
        assert_eq!(
            manifests[0].artifact_hashes,
            Some(GenerationManifestArtifactMap {
                assembled_json: generated_artifacts.assembled_json.sha256.clone(),
                bundle_json: Some(generated_artifacts.bundle_json.as_ref().unwrap().sha256.clone()),
                rendered_docx: None,
            })
        );
        assert_eq!(
            manifest.build_policy_path.as_deref(),
            Some(build_policy::BUILD_POLICY_SOURCE_URI)
        );

        fs::remove_dir_all(artifact_output_dir).unwrap();
    }

    #[test]
    fn run_resume_pipeline_rejects_artifact_flags_without_output_dir() {
        let conn = setup_conn();
        seed_candidate_profile(&conn);
        seed_library(&conn);
        configure_test_build_policy(&conn);

        let error = run_resume_pipeline(
            &conn,
            Some("C:/work/career.db"),
            &ResumePipelineRequest {
                job_posting_text: "Need Python automation support and export tooling.".to_string(),
                reviewed_requirement_analysis: None,
                requirement_review: None,
                artifact_output_dir: None,
                artifact_base_name: None,
                write_bundle_json: true,
                render_docx: false,
                persist_manifest: false,
                manifest_notes: None,
            },
        )
        .unwrap_err();

        assert!(error.contains("artifact_output_dir"));
    }

    #[test]
    fn run_resume_pipeline_renders_docx_when_requested() {
        let conn = setup_conn();
        seed_candidate_profile(&conn);
        seed_library(&conn);
        configure_test_build_policy(&conn);
        let artifact_output_dir = temp_output_dir();

        let result = run_resume_pipeline(
            &conn,
            Some("C:/work/career.db"),
            &ResumePipelineRequest {
                job_posting_text: "Need Python automation support and export tooling.".to_string(),
                reviewed_requirement_analysis: None,
                requirement_review: None,
                artifact_output_dir: Some(artifact_output_dir.display().to_string()),
                artifact_base_name: None,
                write_bundle_json: false,
                render_docx: true,
                persist_manifest: false,
                manifest_notes: None,
            },
        )
        .unwrap();

        let generated_artifacts = result.generated_artifacts.as_ref().unwrap();
        let rendered_docx = generated_artifacts.rendered_docx.as_ref().unwrap();

        assert!(Path::new(&generated_artifacts.assembled_json.path).exists());
        assert!(Path::new(&rendered_docx.path).exists());
        assert!(generated_artifacts.bundle_json.is_none());
        assert!(rendered_docx.path.ends_with(".docx"));

        fs::remove_dir_all(artifact_output_dir).unwrap();
    }

    #[test]
    fn run_resume_pipeline_uses_custom_artifact_base_name() {
        let conn = setup_conn();
        seed_candidate_profile(&conn);
        seed_library(&conn);
        configure_test_build_policy(&conn);
        let artifact_output_dir = temp_output_dir();

        let result = run_resume_pipeline(
            &conn,
            Some("C:/work/career.db"),
            &ResumePipelineRequest {
                job_posting_text: "Need Python automation support and export tooling.".to_string(),
                reviewed_requirement_analysis: None,
                requirement_review: None,
                artifact_output_dir: Some(artifact_output_dir.display().to_string()),
                artifact_base_name: Some("my_custom_prefix".to_string()),
                write_bundle_json: true,
                render_docx: false,
                persist_manifest: false,
                manifest_notes: None,
            },
        )
        .unwrap();

        let artifacts = result.generated_artifacts.as_ref().unwrap();
        let assembled_filename = Path::new(&artifacts.assembled_json.path)
            .file_name()
            .unwrap()
            .to_str()
            .unwrap();
        assert!(
            assembled_filename.starts_with("my_custom_prefix_"),
            "Expected custom prefix in filename, got: {assembled_filename}"
        );
        assert!(assembled_filename.ends_with("_assembled.json"));

        let bundle_filename = Path::new(&artifacts.bundle_json.as_ref().unwrap().path)
            .file_name()
            .unwrap()
            .to_str()
            .unwrap();
        assert!(bundle_filename.starts_with("my_custom_prefix_"));

        fs::remove_dir_all(artifact_output_dir).unwrap();
    }

    #[test]
    fn run_resume_pipeline_uses_reviewed_requirement_analysis_and_persists_review() {
        let conn = setup_conn();
        seed_candidate_profile(&conn);
        seed_library(&conn);
        configure_test_build_policy(&conn);
        let posting_text = "Need Python automation support and export tooling.";
        let mut reviewed_analysis =
            requirement_analysis::build_requirement_analysis(&conn, posting_text).unwrap();
        reviewed_analysis.source.posting_keyword_bank = Vec::new();
        reviewed_analysis.clusters = Vec::new();
        reviewed_analysis.atoms = Vec::new();
        let review = RequirementReviewOverride {
            source_job_posting_sha256: reviewed_analysis.source.job_posting_sha256.clone(),
            reviewed_cluster_ids: vec!["cluster-1".to_string()],
            excluded_cluster_ids: vec!["cluster-1".to_string()],
            excluded_atom_ids: vec!["atom-1".to_string()],
            useful_terms: vec!["python".to_string()],
            noise_terms: vec!["waterfall".to_string()],
        };

        let result = run_resume_pipeline(
            &conn,
            Some("C:/work/career.db"),
            &ResumePipelineRequest {
                job_posting_text: posting_text.to_string(),
                reviewed_requirement_analysis: Some(reviewed_analysis),
                requirement_review: Some(review.clone()),
                artifact_output_dir: None,
                artifact_base_name: None,
                write_bundle_json: false,
                render_docx: false,
                persist_manifest: true,
                manifest_notes: None,
            },
        )
        .unwrap();

        assert!(result.requirement_analysis.atoms.is_empty());
        assert_eq!(result.requirement_review, Some(review.clone()));
        let manifest = result.generation_manifest.unwrap();
        assert_eq!(manifest.requirement_review, Some(review));
    }

    #[test]
    fn run_resume_pipeline_rejects_review_for_different_posting() {
        let conn = setup_conn();
        seed_candidate_profile(&conn);
        seed_library(&conn);
        configure_test_build_policy(&conn);
        let mut reviewed_analysis = requirement_analysis::build_requirement_analysis(
            &conn,
            "Need Python automation support.",
        )
        .unwrap();
        reviewed_analysis.source.job_posting_sha256 = "wrong-hash".to_string();

        let error = run_resume_pipeline(
            &conn,
            Some("C:/work/career.db"),
            &ResumePipelineRequest {
                job_posting_text: "Need Python automation support.".to_string(),
                reviewed_requirement_analysis: Some(reviewed_analysis),
                requirement_review: Some(RequirementReviewOverride {
                    source_job_posting_sha256: "wrong-hash".to_string(),
                    reviewed_cluster_ids: Vec::new(),
                    excluded_cluster_ids: Vec::new(),
                    excluded_atom_ids: Vec::new(),
                    useful_terms: Vec::new(),
                    noise_terms: Vec::new(),
                }),
                artifact_output_dir: None,
                artifact_base_name: None,
                write_bundle_json: false,
                render_docx: false,
                persist_manifest: false,
                manifest_notes: None,
            },
        )
        .unwrap_err();

        assert!(error.contains("different job posting"));
    }

    #[test]
    fn validate_artifact_base_name_rejects_path_separators() {
        assert!(validate_artifact_base_name(&Some("../evil".to_string())).is_err());
        assert!(validate_artifact_base_name(&Some("foo\\bar".to_string())).is_err());
    }

    #[test]
    fn validate_artifact_base_name_rejects_over_100_chars() {
        let long_name = "a".repeat(101);
        assert!(validate_artifact_base_name(&Some(long_name)).is_err());
    }

    #[test]
    fn validate_artifact_base_name_accepts_valid_input() {
        let result = validate_artifact_base_name(&Some("My Resume - V2".to_string()));
        assert_eq!(result.unwrap(), Some("my_resume_v2".to_string()));
    }

    #[test]
    fn validate_artifact_base_name_passes_through_none() {
        assert_eq!(validate_artifact_base_name(&None).unwrap(), None);
    }
}
