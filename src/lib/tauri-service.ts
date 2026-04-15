import { invoke } from '@tauri-apps/api/core'
import type {
  CareerLibraryExport,
  RequirementAnalysis,
  PreflightFilterResult,
  BuildPolicy,
  BundleSemantics,
  ResumeBundleInput,
  ResumeAssemblyResult,
  ResumePipelineRequest,
  ResumePipelineResult,
  ExperienceRecord,
  Evidence,
  CandidateProfile,
  Anomaly,
  GenerationManifest,
  CanonicalTag,
  DeliveryToolkitCategory,
  TagInferenceMarker,
  TagInferenceMarkerInput,
  TagNormalizationResult,
  TaxonomyImportResult,
  LibraryTagRefreshResult,
  LibraryTagSyncStatus,
  RawIntakeImportResult,
  EvidenceInferenceComparison,
  EvidenceSaveDecision,
  EvidenceSaveResponse,
  ExperienceRecordFormData,
  EvidenceFormData,
  CareerService,
} from './types'

class TauriCareerService implements CareerService {
  async initialize(dbPath?: string | null): Promise<void> {
    await invoke('initialize_db', { dbPath: dbPath ?? null })
  }

  async getActiveDbPath(): Promise<string> {
    return invoke('get_active_db_path')
  }

  async buildCareerLibraryExport(): Promise<CareerLibraryExport> {
    return invoke('build_career_library_export')
  }

  async buildRequirementAnalysis(jobPostingText: string): Promise<RequirementAnalysis> {
    return invoke('build_requirement_analysis', { jobPostingText })
  }

  async getBuildPolicy(): Promise<BuildPolicy> {
    return invoke('get_build_policy')
  }

  async saveBuildPolicy(buildPolicy: BuildPolicy): Promise<BuildPolicy> {
    return invoke('save_build_policy', { buildPolicy })
  }

  async buildBundleSemantics(
    careerLibraryExport: CareerLibraryExport,
    requirementAnalysis: RequirementAnalysis,
  ): Promise<BundleSemantics> {
    return invoke('build_bundle_semantics', {
      careerLibraryExport,
      requirementAnalysis,
    })
  }

  async runPreflightFilter(
    careerLibraryExport: CareerLibraryExport,
    requirementAnalysis: RequirementAnalysis,
    threshold: number,
    fallbackMinRecords: number,
  ): Promise<PreflightFilterResult> {
    return invoke('run_preflight_filter', {
      careerLibraryExport,
      requirementAnalysis,
      threshold,
      fallbackMinRecords,
    })
  }

  async prepareResumeBundle(
    jobPostingText: string,
    requirementAnalysis: RequirementAnalysis,
    preflightResult: PreflightFilterResult,
  ): Promise<ResumeBundleInput> {
    return invoke('prepare_resume_bundle', {
      jobPostingText,
      requirementAnalysis,
      preflightResult,
    })
  }

  async assembleResume(bundle: ResumeBundleInput): Promise<ResumeAssemblyResult> {
    return invoke('assemble_resume', { bundle })
  }

  async runResumePipeline(request: ResumePipelineRequest): Promise<ResumePipelineResult> {
    return invoke('run_resume_pipeline', { request })
  }

  private slugify(input: string): string {
    return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  }

  normalizeTag(input: string): string {
    return this.slugify(input)
  }

  async normalizeTags(tags: string[]): Promise<TagNormalizationResult> {
    return invoke('normalize_tags', { tags })
  }

  // ── ExperienceRecord ───────────────────────────────────────────────────────

  async getRecords(): Promise<ExperienceRecord[]> {
    return invoke('get_records')
  }

  async getRecord(id: string): Promise<ExperienceRecord | undefined> {
    return invoke<ExperienceRecord | null>('get_record', { id }).then((r) => r ?? undefined)
  }

  async createRecord(data: ExperienceRecordFormData): Promise<ExperienceRecord> {
    return invoke('create_record', { data })
  }

  async updateRecord(id: string, data: ExperienceRecordFormData): Promise<ExperienceRecord> {
    return invoke('update_record', { id, data })
  }

  async deleteRecord(id: string): Promise<void> {
    return invoke('delete_record', { id })
  }

  // ── Evidence ───────────────────────────────────────────────────────────────

  async getEvidenceForRecord(recordId: string): Promise<Evidence[]> {
    return invoke('get_evidence_for_record', { recordId })
  }

  async getAllEvidence(): Promise<Evidence[]> {
    return invoke('get_all_evidence')
  }

  async getEvidence(id: string): Promise<Evidence | undefined> {
    return invoke<Evidence | null>('get_evidence', { id }).then((r) => r ?? undefined)
  }

  async createEvidence(
    recordId: string,
    data: EvidenceFormData,
    decision?: EvidenceSaveDecision,
  ): Promise<EvidenceSaveResponse> {
    return invoke('create_evidence', { recordId, data, decision })
  }

  async updateEvidence(
    id: string,
    data: EvidenceFormData,
    decision?: EvidenceSaveDecision,
  ): Promise<EvidenceSaveResponse> {
    return invoke('update_evidence', { id, data, decision })
  }

  async previewEvidenceInference(
    recordId: string,
    data: EvidenceFormData,
  ): Promise<EvidenceInferenceComparison> {
    return invoke('preview_evidence_inference', { recordId, data })
  }

  async deleteEvidence(id: string): Promise<void> {
    return invoke('delete_evidence', { id })
  }

  async getCandidateProfile(): Promise<CandidateProfile | undefined> {
    return invoke<CandidateProfile | null>('get_candidate_profile').then((result) => result ?? undefined)
  }

  async replaceCandidateProfile(profile: CandidateProfile): Promise<CandidateProfile> {
    return invoke('replace_candidate_profile', { profile })
  }

  async deleteCandidateProfile(): Promise<void> {
    return invoke('delete_candidate_profile')
  }

  async getCandidateProfileCertificationTags(): Promise<string[]> {
    return invoke('get_candidate_profile_certification_tags')
  }

  async getAnomalies(): Promise<Anomaly[]> {
    return invoke('get_anomalies')
  }

  async getAnomaly(id: string): Promise<Anomaly | undefined> {
    return invoke<Anomaly | null>('get_anomaly', { id }).then((result) => result ?? undefined)
  }

  async resolveAnomaly(id: string): Promise<Anomaly> {
    return invoke('resolve_anomaly', { id })
  }

  async reopenAnomaly(id: string): Promise<Anomaly> {
    return invoke('reopen_anomaly', { id })
  }

  async deleteAnomaly(id: string): Promise<void> {
    return invoke('delete_anomaly', { id })
  }

  async getGenerationManifests(): Promise<GenerationManifest[]> {
    return invoke('get_generation_manifests')
  }

  async getGenerationManifest(id: string): Promise<GenerationManifest | undefined> {
    return invoke<GenerationManifest | null>('get_generation_manifest', { id }).then((result) => result ?? undefined)
  }

  async deleteGenerationManifest(id: string): Promise<void> {
    return invoke('delete_generation_manifest', { id })
  }

  // ── CanonicalTag ───────────────────────────────────────────────────────────

  async getCanonicalTags(): Promise<CanonicalTag[]> {
    return invoke('get_canonical_tags')
  }

  async getCanonicalTag(tag: string): Promise<CanonicalTag | undefined> {
    return invoke<CanonicalTag | null>('get_canonical_tag', { tag }).then((r) => r ?? undefined)
  }

  async getDeliveryToolkitCategories(): Promise<DeliveryToolkitCategory[]> {
    return invoke('get_delivery_toolkit_categories')
  }

  async createDeliveryToolkitCategory(name: string): Promise<DeliveryToolkitCategory> {
    return invoke('create_delivery_toolkit_category', { name })
  }

  async renameDeliveryToolkitCategory(
    currentName: string,
    nextName: string,
  ): Promise<DeliveryToolkitCategory> {
    return invoke('rename_delivery_toolkit_category', { currentName, nextName })
  }

  async deleteDeliveryToolkitCategory(name: string): Promise<void> {
    return invoke('delete_delivery_toolkit_category', { name })
  }

  async importTaxonomy(path: string): Promise<TaxonomyImportResult> {
    return invoke('import_taxonomy', { taxonomyPath: path })
  }

  async exportTaxonomy(path: string): Promise<string> {
    return invoke('export_taxonomy', { outputPath: path })
  }

  async resetTaxonomyToStarter(): Promise<TaxonomyImportResult> {
    return invoke('reset_taxonomy_to_starter')
  }

  async getLibraryTagSyncStatus(): Promise<LibraryTagSyncStatus> {
    return invoke('get_library_tag_sync_status')
  }

  async reInferLibraryTags(): Promise<LibraryTagRefreshResult> {
    return invoke('re_infer_library_tags')
  }

  async createCanonicalTag(
    tag: string,
    description: string | null,
    category: string,
    displayLabel: string,
  ): Promise<CanonicalTag> {
    return invoke<CanonicalTag>('create_canonical_tag', {
      tag,
      description,
      category,
      displayLabel,
    })
  }

  async updateCanonicalTag(
    oldTag: string,
    newTag: string,
    description: string | null,
    category: string,
    displayLabel: string,
  ): Promise<CanonicalTag> {
    return invoke<CanonicalTag>('update_canonical_tag', {
      oldTag,
      newTag,
      description,
      category,
      displayLabel,
    })
  }

  async deleteCanonicalTag(tag: string): Promise<void> {
    return invoke('delete_canonical_tag', { tag })
  }

  async getTagInferenceMarkers(canonicalTag: string): Promise<TagInferenceMarker[]> {
    return invoke('get_tag_inference_markers', { canonicalTag })
  }

  async replaceTagInferenceMarkers(
    canonicalTag: string,
    markers: TagInferenceMarkerInput[],
  ): Promise<TagInferenceMarker[]> {
    return invoke('replace_tag_inference_markers', { canonicalTag, markers })
  }

  async importRawIntake(path: string): Promise<RawIntakeImportResult> {
    return invoke('import_raw_intake', { rawFilePath: path })
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  async reset(): Promise<void> {
    return invoke('reset_db')
  }
}

export const tauriService: CareerService = new TauriCareerService()
