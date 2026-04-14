export type RecordType = 'employment' | 'project'

export type ExperienceRecord = {
  id: string
  slug: string
  record_type: RecordType
  organization: string
  title: string
  start_date: string
  end_date: string
  location: string | null
  employment_type: string | null
  context_tags: string[]
  created_at: string
  updated_at: string
}

export type Evidence = {
  id: string
  experience_record_id: string
  claim: string
  date_range: string | null
  tags: string[]
  evidence_note: string | null
  created_at: string
  updated_at: string
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type CareerLibraryExportEvidenceItem = {
  id: string
  experience_record_id: string
  claim: string
  date_range: string | null
  tags: string[]
  scope_context: JsonValue | null
  evidence_note: string | null
  created_at: string
  updated_at: string
}

export type CareerLibraryExportRecord = {
  id: string
  slug: string
  record_type: RecordType
  organization: string
  title: string
  start_date: string | null
  end_date: string | null
  location: string | null
  employment_type: string | null
  context_tags: string[]
  canonical_scope_summary: string | null
  common_context: JsonValue | null
  created_at: string
  updated_at: string
  evidence: CareerLibraryExportEvidenceItem[]
}

export type CareerLibraryExportMeta = {
  schema_version: '2.0'
  exported_at: string
  taxonomy_version: string
  source_db_name: string
}

export type CareerLibraryExport = {
  export_type: 'career_library_extract'
  experience_records: CareerLibraryExportRecord[]
  export_meta: CareerLibraryExportMeta
}

export type RequirementKind = 'must_have' | 'should_have' | 'nice_to_have'

export type UnrecognizedNotableTerm = {
  term: string
  count: number
}

export type RequirementAnalysisSource = {
  job_posting_sha256: string
  job_posting_length: number
  target_role_family: string
  posting_keyword_bank: string[]
  unrecognized_notable_terms: UnrecognizedNotableTerm[]
  extraction_method: 'posting_surface_terms_v1'
}

export type RequirementCluster = {
  cluster_id: string
  label: string
  kind: RequirementKind
  priority_rank: number
  atom_ids: string[]
  matched_tags: string[]
}

export type ExperienceYears = {
  min_years: number
  max_years?: number
}

export type RequirementAtom = {
  requirement_id: string
  cluster_id: string
  text: string
  kind: RequirementKind
  priority_rank: number
  source_order: number
  normalized_terms: string[]
  matched_tags: string[]
  experience_years: ExperienceYears | null
  has_quantifier: boolean
  merged_from?: string[]
}

export type RequirementAnalysis = {
  analysis_version: '1.0'
  source: RequirementAnalysisSource
  clusters: RequirementCluster[]
  atoms: RequirementAtom[]
}

export type PreflightCounts = {
  records: number
  evidence: number
}

export type PreflightDecisionLogEntry = {
  record_id: string
  decision: string
  reason: string
}

export type PreflightReport = {
  threshold: number
  fallback_min_records: number
  kept_counts: PreflightCounts
  dropped_counts: PreflightCounts
  decision_log: PreflightDecisionLogEntry[]
}

export type PreflightFilterResult = {
  career_library_export: CareerLibraryExport
  preflight_report: PreflightReport
}

export type BuildPolicyPreflight = {
  threshold?: number
  fallback_min_records?: number
}

export type AssemblerStrategy = {
  max_highlights: number
  bullet_max_chars: number
  highlight_max_chars: number
  profile_max_chars: number
  coverage_first_highlights?: boolean
  coverage_first_profile_tiebreak?: boolean
  allow_multi_evidence_sections: Array<'highlights' | 'profile'>
  tag_weight: number
  density_weight: number
}

export type BuildPolicy = {
  policy_type: 'resume_build_policy'
  include_projects: boolean
  max_bullets_per_role: number
  max_project_bullets: number
  max_projects: number
  preflight?: BuildPolicyPreflight
  assembler_strategy: AssemblerStrategy
}

export type DeliveryToolkitGroup = {
  group_name: string
  items: string[]
}

export type DeliveryToolkit = {
  label: string
  groups: DeliveryToolkitGroup[]
}

export type BundleTagSources = {
  direct_evidence_tags: string[]
  education_tags: string[]
  certification_tags: string[]
}

export type BundleSemantics = {
  notes: string[]
  tags: string[]
  tag_sources: BundleTagSources
  education_tags: string[]
  direct_evidence_tags: string[]
  certification_tags: string[]
  static_source_tags: Record<string, string[]>
  toolkit_tags: string[]
  posting_matched_tags: string[]
  delivery_toolkit: DeliveryToolkit
}

export type BundleCandidateContact = {
  email: string | null
  phone: string | null
  linkedin: string | null
  github: string | null
}

export type BundleCandidateIdentity = {
  display_name: string
  location: string
  contact: BundleCandidateContact
}

export type BundleCandidateEducationFieldNotes = {
  major: string | null
  minor: string | null
}

export type BundleCandidateEducationEntry = {
  id: string
  institution: string
  credential: string
  signal_tags: string[]
  field_notes: BundleCandidateEducationFieldNotes
}

export type BundleCandidateCertificationEntry = {
  id: string
  name: string
  issuer: string
  credential_detail: string
  signal_tags: string[]
}

export type BundleCandidateStaticSections = {
  education: BundleCandidateEducationEntry[]
  certifications: BundleCandidateCertificationEntry[]
  profile_summary_seed: string[]
}

export type BundleCandidateProfile = {
  version: string
  config_type: string
  candidate_identity: BundleCandidateIdentity
  static_sections: BundleCandidateStaticSections
}

export type ResumeBundleInput = {
  build_policy: BuildPolicy
  job_posting_text: string
  candidate_profile: BundleCandidateProfile
  career_library_export: CareerLibraryExport
  bundle_semantics: BundleSemantics
  requirement_analysis: RequirementAnalysis
  preflight_report: PreflightReport
}

export type MultiEvidenceClaim = {
  text: string
  evidence_ids: string[]
}

export type SingleEvidenceClaim = {
  text: string
  evidence_ids: string[]
}

export type ResumeHeader = {
  display_name: string
  location: string
  email: string
  phone: string
  linkedin: string
  github: string
}

export type ProfileSection = {
  text: string
  evidence_ids: string[]
}

export type ExperienceEntry = {
  record_id: string
  organization: string
  title: string
  date_range: string
  location: string | null
  bullets: SingleEvidenceClaim[]
}

export type ProjectEntry = {
  record_id: string
  organization: string
  title: string
  date_range: string
  bullets: SingleEvidenceClaim[]
}

export type TextSourceItem = {
  text: string
  source_id: string
}

export type ToolkitSection = {
  label: string
  groups: DeliveryToolkitGroup[]
}

export type StructuredResume = {
  header: ResumeHeader
  target_role_family: string
  highlights: MultiEvidenceClaim[]
  profile: ProfileSection | null
  professional_experience: ExperienceEntry[]
  projects: ProjectEntry[]
  education: TextSourceItem[]
  certifications: TextSourceItem[]
  toolkit: ToolkitSection | null
}

export type SupportingSourceType = 'evidence' | 'education' | 'certification'

export type SupportingSource = {
  source_type: SupportingSourceType
  source_id: string
}

export type SupportedRequirement = {
  requirement: string
  supporting_sources: SupportingSource[]
}

export type PartiallySupportedRequirement = {
  requirement: string
  supporting_sources: SupportingSource[]
  limitation: string
}

export type UnsupportedRequirement = {
  requirement: string
  reason: string
}

export type GapReport = {
  supported_requirements: SupportedRequirement[]
  partially_supported_requirements: PartiallySupportedRequirement[]
  unsupported_requirements: UnsupportedRequirement[]
  compensation_strategy: string[]
  risk_flags: string[]
}

export type ClaimToEvidenceMapEntry = {
  claim_path: string
  evidence_ids: string[]
}

export type ConstraintFlagStatus = 'passed' | 'warning' | 'failed'

export type ConstraintFlag = {
  rule: string
  status: ConstraintFlagStatus
  note: string
}

export type Provenance = {
  target_role_family: string
  selected_record_ids: string[]
  selected_evidence_ids: string[]
  claim_to_evidence_map: ClaimToEvidenceMapEntry[]
  constraint_flags: ConstraintFlag[]
  notes: string[]
}

export type AssembledResumeArtifact = {
  resume: StructuredResume
  gap_report: GapReport
  provenance: Provenance
}

export type ResumeAssemblyResult = {
  artifact: AssembledResumeArtifact
  selected_record_ids: string[]
  selected_evidence_ids: string[]
  claim_to_evidence_map: ClaimToEvidenceMapEntry[]
  constraint_flags: ConstraintFlag[]
  notes: string[]
}

export type ResumePipelineRequest = {
  job_posting_text: string
  artifact_output_dir?: string | null
  write_bundle_json?: boolean
  render_docx?: boolean
  persist_manifest?: boolean
  manifest_notes?: string | null
}

export type ResumeArtifactFile = {
  path: string
  sha256: string
}

export type ResumeGeneratedArtifacts = {
  output_dir: string
  assembled_json: ResumeArtifactFile
  bundle_json: ResumeArtifactFile | null
  rendered_docx: ResumeArtifactFile | null
}

export type ResumePipelineResult = {
  career_library_export: CareerLibraryExport
  requirement_analysis: RequirementAnalysis
  preflight_result: PreflightFilterResult
  bundle: ResumeBundleInput
  assembly_result: ResumeAssemblyResult
  generated_artifacts: ResumeGeneratedArtifacts | null
  generation_manifest: GenerationManifest | null
}

export type CandidateContact = {
  email: string | null
  phone: string | null
  linkedin: string | null
  github: string | null
}

export type CandidateIdentity = {
  displayName: string
  location: string
  contact: CandidateContact
}

export type CandidateEducationFieldNotes = {
  major: string | null
  minor: string | null
}

export type CandidateEducationEntry = {
  id: string
  institution: string
  credential: string
  signalTags: string[]
  fieldNotes: CandidateEducationFieldNotes
}

export type CandidateCertificationEntry = {
  id: string
  name: string
  issuer: string
  credentialDetail: string
  signalTags: string[]
}

export type CandidateStaticSections = {
  education: CandidateEducationEntry[]
  certifications: CandidateCertificationEntry[]
  profileSummarySeed: string[]
}

export type CandidateProfile = {
  version: string
  configType: string
  candidateIdentity: CandidateIdentity
  staticSections: CandidateStaticSections
}

export type Anomaly = {
  id: string
  entityType: string
  entityId: string
  anomalyCode: string
  severity: string
  message: string
  detectedAt: string
  resolvedAt: string | null
}

export type GenerationManifest = {
  id: string
  createdAt: string
  artifactKind: string
  targetRoleFamily: string | null
  jobPostingPath: string | null
  jobPostingSha256: string | null
  buildPolicyPath: string | null
  buildPolicySha256: string | null
  candidateProfilePath: string | null
  candidateProfileSha256: string | null
  libraryExportPath: string | null
  libraryExportSha256: string | null
  selectedRecordIds: unknown | null
  selectedEvidenceIds: unknown | null
  gapReport: unknown | null
  artifactPaths: unknown | null
  artifactHashes: unknown | null
  notes: string | null
}

export type CanonicalTag = {
  id: string
  tag: string
  description: string | null
  category: string | null
  display_label: string | null
  created_at: string
}

export type DeliveryToolkitCategory = {
  name: string
  sort_order: number
}

export type TagInferenceMarkerTerm = {
  id: string
  termGroup: string
  termValue: string
  sortOrder: number
}

export type TagInferenceMarker = {
  id: string
  canonicalTag: string
  markerKind: string
  literalValue: string | null
  terms: TagInferenceMarkerTerm[]
  createdAt: string
}

export type TagInferenceMarkerInput = {
  markerKind: string
  literalValue?: string | null
  allOf: string[]
  anyOf: string[]
}

export type EvidenceValueSource = 'manual' | 'inferred'

export type EvidenceSaveDecision = {
  tagsSource?: EvidenceValueSource
}

export type EvidenceInferenceComparison = {
  manualTags: string[]
  inferredTags: string[]
  unknownManualTags: string[]
  tagsMatch: boolean
}

export type EvidenceSaveResponse = {
  status: 'saved' | 'confirmation_required'
  evidence: Evidence | null
  comparison: EvidenceInferenceComparison
}

export type TagNormalizationResult = {
  normalized: string[]
  unknown: string[]
}

export type TaxonomyImportResult = {
  importedTaxonomyVersion: string
  retaggedEvidenceCount: number
  rebuiltRecordCount: number
  unknownCandidateProfileSignalTags: string[]
}

export type ValidationError = {
  field: string
  message: string
}

export type ExperienceRecordFormData = Omit<ExperienceRecord, 'id' | 'created_at' | 'updated_at'>

export type EvidenceFormData = Omit<Evidence, 'id' | 'experience_record_id' | 'created_at' | 'updated_at'>

export type RawIntakeImportSkipReason =
  | 'ambiguous_item'
  | 'duplicate_claim'
  | 'duplicate_intake_id'
  | 'empty_raw_text'
  | 'invalid_item'
  | 'missing_target_record'
  | 'unknown_target_record'
  | 'unsupported_action'
  | 'zero_inferred_tags'

export type RawIntakeImportSkipSummary = {
  reason: RawIntakeImportSkipReason
  count: number
}

export type RawIntakeImportResult = {
  run_id: string | null
  success: boolean
  source_path: string
  imported_record_count: number
  imported_evidence_count: number
  skipped_count: number
  skip_reasons: RawIntakeImportSkipSummary[]
  duplicate_intake_ids: string[]
  messages: string[]
  error: string | null
}

// ---------------------------------------------------------------------------
// Service interface — every backend (local, Tauri IPC) implements this.
// Views import from @/lib/service, never a concrete backend.
// ---------------------------------------------------------------------------

export interface CareerService {
  initialize(dbPath?: string | null): Promise<void>
  getActiveDbPath(): Promise<string>
  buildCareerLibraryExport(): Promise<CareerLibraryExport>
  buildRequirementAnalysis(jobPostingText: string): Promise<RequirementAnalysis>
  getBuildPolicy(): Promise<BuildPolicy>
  saveBuildPolicy(buildPolicy: BuildPolicy): Promise<BuildPolicy>
  buildBundleSemantics(
    careerLibraryExport: CareerLibraryExport,
    requirementAnalysis: RequirementAnalysis,
  ): Promise<BundleSemantics>
  runPreflightFilter(
    careerLibraryExport: CareerLibraryExport,
    requirementAnalysis: RequirementAnalysis,
    threshold: number,
    fallbackMinRecords: number,
  ): Promise<PreflightFilterResult>
  prepareResumeBundle(
    jobPostingText: string,
    requirementAnalysis: RequirementAnalysis,
    preflightResult: PreflightFilterResult,
  ): Promise<ResumeBundleInput>
  assembleResume(bundle: ResumeBundleInput): Promise<ResumeAssemblyResult>
  runResumePipeline(request: ResumePipelineRequest): Promise<ResumePipelineResult>

  normalizeTag(input: string): string
  normalizeTags(tags: string[]): Promise<TagNormalizationResult>

  getRecords(): Promise<ExperienceRecord[]>
  getRecord(id: string): Promise<ExperienceRecord | undefined>
  createRecord(data: ExperienceRecordFormData): Promise<ExperienceRecord>
  updateRecord(id: string, data: ExperienceRecordFormData): Promise<ExperienceRecord>
  deleteRecord(id: string): Promise<void>

  getEvidenceForRecord(recordId: string): Promise<Evidence[]>
  getAllEvidence(): Promise<Evidence[]>
  getEvidence(id: string): Promise<Evidence | undefined>
  createEvidence(
    recordId: string,
    data: EvidenceFormData,
    decision?: EvidenceSaveDecision,
  ): Promise<EvidenceSaveResponse>
  updateEvidence(
    id: string,
    data: EvidenceFormData,
    decision?: EvidenceSaveDecision,
  ): Promise<EvidenceSaveResponse>
  previewEvidenceInference(
    recordId: string,
    data: EvidenceFormData,
  ): Promise<EvidenceInferenceComparison>
  deleteEvidence(id: string): Promise<void>

  getCandidateProfile(): Promise<CandidateProfile | undefined>
  replaceCandidateProfile(profile: CandidateProfile): Promise<CandidateProfile>
  deleteCandidateProfile(): Promise<void>
  getCandidateProfileCertificationTags(): Promise<string[]>

  getAnomalies(): Promise<Anomaly[]>
  getAnomaly(id: string): Promise<Anomaly | undefined>
  resolveAnomaly(id: string): Promise<Anomaly>
  reopenAnomaly(id: string): Promise<Anomaly>
  deleteAnomaly(id: string): Promise<void>

  getGenerationManifests(): Promise<GenerationManifest[]>
  getGenerationManifest(id: string): Promise<GenerationManifest | undefined>
  deleteGenerationManifest(id: string): Promise<void>

  getCanonicalTags(): Promise<CanonicalTag[]>
  getCanonicalTag(tag: string): Promise<CanonicalTag | undefined>
  getDeliveryToolkitCategories(): Promise<DeliveryToolkitCategory[]>
  importTaxonomy(path: string): Promise<TaxonomyImportResult>
  exportTaxonomy(path: string): Promise<string>
  resetTaxonomyToStarter(): Promise<TaxonomyImportResult>
  createCanonicalTag(
    tag: string,
    description: string | null,
    category: string,
    displayLabel: string,
  ): Promise<CanonicalTag>
  updateCanonicalTag(
    oldTag: string,
    newTag: string,
    description: string | null,
    category: string,
    displayLabel: string,
  ): Promise<CanonicalTag>
  deleteCanonicalTag(tag: string): Promise<void>

  getTagInferenceMarkers(canonicalTag: string): Promise<TagInferenceMarker[]>
  replaceTagInferenceMarkers(
    canonicalTag: string,
    markers: TagInferenceMarkerInput[],
  ): Promise<TagInferenceMarker[]>

  importRawIntake(path: string): Promise<RawIntakeImportResult>

  reset(): Promise<void>
}
