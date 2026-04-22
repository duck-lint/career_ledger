import type {
  CareerLibraryExport,
  CareerLibraryExportEvidenceItem,
  CareerLibraryExportRecord,
  BuildPolicy,
  BundleSemantics,
  ResumeBundleInput,
  ResumeAssemblyResult,
  ResumePipelineRequest,
  ResumePipelineResult,
  RequirementAnalysis,
  PreflightFilterResult,
  ExperienceRecord,
  Evidence,
  DeleteBatchOptions,
  DeleteRecordsPreview,
  DeleteRecordsResult,
  DeleteEvidenceItemsPreview,
  DeleteEvidenceItemsResult,
  CandidateProfile,
  CandidateContact,
  CandidateEducationEntry,
  CandidateCertificationEntry,
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
  RuntimeAdminService,
  PipelineService,
  LibraryService,
  OperationsService,
  TaxonomyService,
  IntakeService,
  RuntimeServices,
  TestMarkersResult,
} from './types'

const RECORDS_KEY = 'career-ledger-records'
const EVIDENCE_KEY = 'career-ledger-evidence'
const CANONICAL_TAGS_KEY = 'career-ledger-canonical-tags'
const DELIVERY_TOOLKIT_CATEGORIES_KEY = 'career-ledger-delivery-toolkit-categories'
const TAG_INFERENCE_MARKERS_KEY = 'career-ledger-tag-inference-markers'
const CANDIDATE_PROFILE_KEY = 'career-ledger-candidate-profile'
const ANOMALIES_KEY = 'career-ledger-anomalies'
const GENERATION_MANIFESTS_KEY = 'career-ledger-generation-manifests'
const INIT_KEY = 'career-ledger-initialized'
const EXPORT_SCHEMA_VERSION = '2.0'
const OPEN_ENDED_DATE_MARKERS = new Set(['present', 'current', 'ongoing', 'now'])

function kvGet<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  return raw ? (JSON.parse(raw) as T) : null
}

function kvSet<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function kvDelete(key: string): void {
  localStorage.removeItem(key)
}

function sortDeliveryToolkitCategories(
  categories: DeliveryToolkitCategory[]
): DeliveryToolkitCategory[] {
  return [...categories].sort(
    (left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name)
  )
}

function deriveStoredDeliveryToolkitCategories(
  tagsObj: Record<string, CanonicalTag>
): DeliveryToolkitCategory[] {
  const seen = new Set<string>()
  let nextSortOrder = 100

  return sortDeliveryToolkitCategories(
    Object.values(tagsObj)
      .map((tag) => normalizeOptionalValue(tag.category))
      .filter((category): category is string => Boolean(category))
      .filter((category) => {
        if (seen.has(category)) {
          return false
        }
        seen.add(category)
        return true
      })
      .map((name) => {
        const category = { name, sort_order: nextSortOrder }
        nextSortOrder += 100
        return category
      })
  )
}

function getStoredDeliveryToolkitCategories(): DeliveryToolkitCategory[] {
  return sortDeliveryToolkitCategories(
    kvGet<DeliveryToolkitCategory[]>(DELIVERY_TOOLKIT_CATEGORIES_KEY) ?? []
  )
}

function saveStoredDeliveryToolkitCategories(categories: DeliveryToolkitCategory[]): void {
  kvSet(DELIVERY_TOOLKIT_CATEGORIES_KEY, sortDeliveryToolkitCategories(categories))
}

function dedupePreserve(values: string[]): string[] {
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value)
      deduped.push(value)
    }
  }
  return deduped
}

function normalizeDeleteIds(ids: string[]): string[] {
  return dedupePreserve(ids.map(normalizeOutputValue).filter(Boolean))
}

function normalizeMarkerValue(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeOutputValue(value: string): string {
  return value.trim()
}

function normalizeOptionalValue(value: string | null | undefined): string | null {
  const normalized = typeof value === 'string' ? normalizeOutputValue(value) : ''
  return normalized ? normalized : null
}

function normalizeSortableDate(value: string | null | undefined): string {
  return normalizeOptionalValue(value) ?? ''
}

function isOpenEndedDate(value: string | null | undefined): boolean {
  const normalized = normalizeSortableDate(value).toLowerCase()
  return normalized === '' || OPEN_ENDED_DATE_MARKERS.has(normalized)
}

function compareExperienceRecordsForExport(a: ExperienceRecord, b: ExperienceRecord): number {
  const aOpenEnded = isOpenEndedDate(a.end_date)
  const bOpenEnded = isOpenEndedDate(b.end_date)
  if (aOpenEnded !== bOpenEnded) {
    return aOpenEnded ? -1 : 1
  }

  const aEndDate = aOpenEnded ? '' : normalizeSortableDate(a.end_date)
  const bEndDate = bOpenEnded ? '' : normalizeSortableDate(b.end_date)
  const endDateCompare = bEndDate.localeCompare(aEndDate)
  if (endDateCompare !== 0) {
    return endDateCompare
  }

  const startDateCompare = normalizeSortableDate(b.start_date).localeCompare(
    normalizeSortableDate(a.start_date)
  )
  if (startDateCompare !== 0) {
    return startDateCompare
  }

  const organizationCompare = a.organization.localeCompare(b.organization, undefined, {
    sensitivity: 'accent',
  })
  if (organizationCompare !== 0) {
    return organizationCompare
  }

  const titleCompare = a.title.localeCompare(b.title, undefined, {
    sensitivity: 'accent',
  })
  if (titleCompare !== 0) {
    return titleCompare
  }

  return a.id.localeCompare(b.id)
}

function mapEvidenceToExportItem(evidence: Evidence): CareerLibraryExportEvidenceItem {
  return {
    id: evidence.id,
    experience_record_id: evidence.experience_record_id,
    claim: evidence.claim,
    date_range: normalizeOptionalValue(evidence.date_range),
    tags: [...evidence.tags],
    scope_context: null,
    evidence_note: evidence.evidence_note,
    created_at: evidence.created_at,
    updated_at: evidence.updated_at,
  }
}

function mapRecordToExportRecord(
  record: ExperienceRecord,
  evidence: CareerLibraryExportEvidenceItem[]
): CareerLibraryExportRecord {
  return {
    id: record.id,
    slug: record.slug,
    record_type: record.record_type,
    organization: record.organization,
    title: record.title,
    start_date: normalizeOptionalValue(record.start_date),
    end_date: normalizeOptionalValue(record.end_date),
    location: record.location,
    employment_type: record.employment_type,
    context_tags: [...record.context_tags],
    canonical_scope_summary: null,
    common_context: null,
    created_at: record.created_at,
    updated_at: record.updated_at,
    evidence,
  }
}

function normalizeRequiredValue(value: string | null | undefined, label: string): string {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) {
    throw new Error(`${label} is required.`)
  }
  return normalized
}

function slugifyRecordSlug(value: string): string {
  let normalized = ''
  let lastWasSeparator = false

  for (const char of value) {
    if (/^[a-z0-9]$/i.test(char)) {
      normalized += char.toLowerCase()
      lastWasSeparator = false
    } else if (normalized && !lastWasSeparator) {
      normalized += '-'
      lastWasSeparator = true
    }
  }

  return normalized.replace(/^-+|-+$/g, '')
}

function resolveRecordSlug(data: ExperienceRecordFormData): string {
  const explicitSlug = slugifyRecordSlug(data.slug)
  const generatedSlug = slugifyRecordSlug(
    `${normalizeRequiredValue(data.organization, 'Organization')}-${normalizeRequiredValue(data.title, 'Title')}`
  )
  const slug = explicitSlug || generatedSlug

  if (!slug) {
    throw new Error('Slug is required and could not be generated. Please enter a slug.')
  }

  return slug
}

function normalizeTextArray(values: string[]): string[] {
  return dedupePreserve(values.map(normalizeOutputValue).filter(Boolean))
}

function defaultTagInferenceMarkerInputs(tag: string): TagInferenceMarkerInput[] {
  const phrase = tag.replace(/_/g, ' ')
  const markers: TagInferenceMarkerInput[] = [
    {
      markerKind: 'literal',
      literalValue: phrase,
      allOf: [],
      anyOf: [],
    },
  ]

  if (phrase.includes(' ')) {
    markers.push({
      markerKind: 'literal',
      literalValue: phrase.replace(/ /g, '-'),
      allOf: [],
      anyOf: [],
    })
  }

  return markers
}

function normalizeTagInferenceMarkerInputs(
  markers: TagInferenceMarkerInput[]
): TagInferenceMarkerInput[] {
  const normalized = markers.map((marker) => {
    const markerKind = marker.markerKind.trim().toLowerCase()
    const literalValue = marker.literalValue ? normalizeMarkerValue(marker.literalValue) : null
    const allOf = dedupePreserve(
      (marker.allOf ?? []).map(normalizeMarkerValue).filter(Boolean)
    )
    const anyOf = dedupePreserve(
      (marker.anyOf ?? []).map(normalizeMarkerValue).filter(Boolean)
    )

    if (markerKind === 'literal') {
      if (!literalValue) {
        throw new Error('Literal markers must contain a non-empty literal value.')
      }
      return { markerKind, literalValue, allOf: [], anyOf: [] }
    }

    if (markerKind === 'compound') {
      if (allOf.length === 0 && anyOf.length === 0) {
        throw new Error('Compound markers must include at least one allOf or anyOf term.')
      }
      return { markerKind, literalValue: null, allOf, anyOf }
    }

    throw new Error("Marker kind must be either 'literal' or 'compound'.")
  })

  if (normalized.length === 0) {
    throw new Error('Every canonical tag must have at least one inference marker.')
  }

  return normalized
}

function materializeTagInferenceMarkers(
  canonicalTag: string,
  markers: TagInferenceMarkerInput[]
): TagInferenceMarker[] {
  const createdAt = new Date().toISOString()
  return normalizeTagInferenceMarkerInputs(markers).map((marker) => ({
    id: crypto.randomUUID(),
    canonicalTag,
    markerKind: marker.markerKind,
    literalValue: marker.literalValue ?? null,
    terms: [
      ...marker.allOf.map((termValue, index) => ({
        id: crypto.randomUUID(),
        termGroup: 'all_of',
        termValue,
        sortOrder: index,
      })),
      ...marker.anyOf.map((termValue, index) => ({
        id: crypto.randomUUID(),
        termGroup: 'any_of',
        termValue,
        sortOrder: index,
      })),
    ],
    createdAt,
  }))
}
function buildDefaultTagInferenceMarkerMap(
  tagsObj: Record<string, CanonicalTag>
): Record<string, TagInferenceMarker[]> {
  const markers: Record<string, TagInferenceMarker[]> = {}
  Object.values(tagsObj).forEach((tag) => {
    markers[tag.tag] = materializeTagInferenceMarkers(
      tag.tag,
      defaultTagInferenceMarkerInputs(tag.tag)
    )
  })
  return markers
}

class LocalCareerService
  implements
    RuntimeAdminService,
    PipelineService,
    LibraryService,
    OperationsService,
    TaxonomyService,
    IntakeService
{
  private assertStrictBatchDeleteReady(
    entityLabel: string,
    missingIds: string[],
    strict: boolean
  ): void {
    if (!strict || missingIds.length === 0) {
      return
    }

    throw new Error(
      `Strict batch delete aborted because these ${entityLabel} were missing: ${missingIds.join(', ')}`
    )
  }

  private buildDeleteRecordsPreview(ids: string[]): DeleteRecordsPreview {
    const normalizedIds = normalizeDeleteIds(ids)
    const recordsObj = kvGet<Record<string, ExperienceRecord>>(RECORDS_KEY) ?? {}
    const evidenceObj = kvGet<Record<string, Evidence>>(EVIDENCE_KEY) ?? {}
    const linkedEvidenceCounts = new Map<string, number>()

    Object.values(evidenceObj).forEach((item) => {
      linkedEvidenceCounts.set(
        item.experience_record_id,
        (linkedEvidenceCounts.get(item.experience_record_id) ?? 0) + 1
      )
    })

    const records = normalizedIds.flatMap((id) => {
      const record = recordsObj[id]
      if (!record) {
        return []
      }

      return [{
        id: record.id,
        slug: record.slug,
        organization: record.organization,
        title: record.title,
        linkedEvidenceCount: linkedEvidenceCounts.get(record.id) ?? 0,
      }]
    })

    return {
      requestedCount: normalizedIds.length,
      foundCount: records.length,
      missingIds: normalizedIds.filter((id) => !recordsObj[id]),
      records,
      cascadeEvidenceCount: records.reduce(
        (count, record) => count + record.linkedEvidenceCount,
        0
      ),
    }
  }

  private commitDeleteRecords(
    preview: DeleteRecordsPreview,
    options?: DeleteBatchOptions
  ): DeleteRecordsResult {
    const strict = options?.strict ?? true
    this.assertStrictBatchDeleteReady('record ids', preview.missingIds, strict)

    const recordIds = new Set(preview.records.map((record) => record.id))
    const recordsObj = kvGet<Record<string, ExperienceRecord>>(RECORDS_KEY) ?? {}
    const evidenceObj = kvGet<Record<string, Evidence>>(EVIDENCE_KEY) ?? {}
    let deletedEvidenceCount = 0

    Object.keys(recordsObj).forEach((recordId) => {
      if (recordIds.has(recordId)) {
        delete recordsObj[recordId]
      }
    })

    Object.entries(evidenceObj).forEach(([evidenceId, item]) => {
      if (recordIds.has(item.experience_record_id)) {
        delete evidenceObj[evidenceId]
        deletedEvidenceCount += 1
      }
    })

    kvSet(RECORDS_KEY, recordsObj)
    kvSet(EVIDENCE_KEY, evidenceObj)

    return {
      ...preview,
      deletedRecordCount: recordIds.size,
      deletedEvidenceCount,
      strict,
    }
  }

  private buildDeleteEvidenceItemsPreview(ids: string[]): DeleteEvidenceItemsPreview {
    const normalizedIds = normalizeDeleteIds(ids)
    const evidenceObj = kvGet<Record<string, Evidence>>(EVIDENCE_KEY) ?? {}
    const recordsObj = kvGet<Record<string, ExperienceRecord>>(RECORDS_KEY) ?? {}
    const evidenceItems = normalizedIds.flatMap((id) => {
      const evidence = evidenceObj[id]
      if (!evidence) {
        return []
      }

      return [{
        id: evidence.id,
        experienceRecordId: evidence.experience_record_id,
        recordSlug: recordsObj[evidence.experience_record_id]?.slug ?? null,
        claim: evidence.claim,
      }]
    })

    return {
      requestedCount: normalizedIds.length,
      foundCount: evidenceItems.length,
      missingIds: normalizedIds.filter((id) => !evidenceObj[id]),
      evidenceItems,
    }
  }

  private commitDeleteEvidenceItems(
    preview: DeleteEvidenceItemsPreview,
    options?: DeleteBatchOptions
  ): DeleteEvidenceItemsResult {
    const strict = options?.strict ?? true
    this.assertStrictBatchDeleteReady('evidence item ids', preview.missingIds, strict)

    const evidenceIds = new Set(preview.evidenceItems.map((item) => item.id))
    const evidenceObj = kvGet<Record<string, Evidence>>(EVIDENCE_KEY) ?? {}

    Object.keys(evidenceObj).forEach((evidenceId) => {
      if (evidenceIds.has(evidenceId)) {
        delete evidenceObj[evidenceId]
      }
    })

    kvSet(EVIDENCE_KEY, evidenceObj)

    return {
      ...preview,
      deletedEvidenceCount: evidenceIds.size,
      strict,
    }
  }

  private async normalizeCanonicalTags(tags: string[], label: string): Promise<string[]> {
    const normalized = await this.normalizeTags(tags)
    if (normalized.unknown.length > 0) {
      throw new Error(`${label}: unknown tags ${normalized.unknown.join(', ')}`)
    }
    return normalized.normalized
  }

  private async normalizeCandidateProfile(profile: CandidateProfile): Promise<CandidateProfile> {
    if (normalizeRequiredValue(profile.configType, 'candidateProfile.configType') !== 'candidate_profile') {
      throw new Error("candidateProfile.configType must equal 'candidate_profile'.")
    }

    const normalizeContact = (contact: CandidateContact): CandidateContact => ({
      email: normalizeOptionalValue(contact.email),
      phone: normalizeOptionalValue(contact.phone),
      linkedin: normalizeOptionalValue(contact.linkedin),
      github: normalizeOptionalValue(contact.github),
    })

    const normalizeEducation = async (
      entry: CandidateEducationEntry,
      index: number,
    ): Promise<CandidateEducationEntry> => ({
      id: normalizeRequiredValue(entry.id, `candidateProfile.staticSections.education[${index + 1}].id`),
      institution: normalizeRequiredValue(
        entry.institution,
        `candidateProfile.staticSections.education[${index + 1}].institution`
      ),
      credential: normalizeRequiredValue(
        entry.credential,
        `candidateProfile.staticSections.education[${index + 1}].credential`
      ),
      signalTags: await this.normalizeCanonicalTags(
        entry.signalTags ?? [],
        `candidateProfile.staticSections.education[${index + 1}].signalTags`
      ),
      fieldNotes: {
        major: normalizeOptionalValue(entry.fieldNotes?.major ?? null),
        minor: normalizeOptionalValue(entry.fieldNotes?.minor ?? null),
      },
    })

    const normalizeCertification = async (
      entry: CandidateCertificationEntry,
      index: number,
    ): Promise<CandidateCertificationEntry> => ({
      id: normalizeRequiredValue(entry.id, `candidateProfile.staticSections.certifications[${index + 1}].id`),
      name: normalizeRequiredValue(entry.name, `candidateProfile.staticSections.certifications[${index + 1}].name`),
      issuer: normalizeRequiredValue(
        entry.issuer,
        `candidateProfile.staticSections.certifications[${index + 1}].issuer`
      ),
      credentialDetail: normalizeRequiredValue(
        entry.credentialDetail,
        `candidateProfile.staticSections.certifications[${index + 1}].credentialDetail`
      ),
      signalTags: await this.normalizeCanonicalTags(
        entry.signalTags ?? [],
        `candidateProfile.staticSections.certifications[${index + 1}].signalTags`
      ),
    })

    return {
      version: normalizeRequiredValue(profile.version, 'candidateProfile.version'),
      configType: 'candidate_profile',
      candidateIdentity: {
        displayName: normalizeRequiredValue(
          profile.candidateIdentity.displayName,
          'candidateProfile.candidateIdentity.displayName'
        ),
        location: normalizeRequiredValue(
          profile.candidateIdentity.location,
          'candidateProfile.candidateIdentity.location'
        ),
        contact: normalizeContact(profile.candidateIdentity.contact ?? {
          email: null,
          phone: null,
          linkedin: null,
          github: null,
        }),
      },
      staticSections: {
        education: await Promise.all(
          (profile.staticSections.education ?? []).map((entry, index) => normalizeEducation(entry, index))
        ),
        certifications: await Promise.all(
          (profile.staticSections.certifications ?? []).map((entry, index) => normalizeCertification(entry, index))
        ),
        profileSummarySeed: normalizeTextArray(profile.staticSections.profileSummarySeed ?? []),
      },
    }
  }

  private async initializeEmptyState(): Promise<void> {
    kvSet<Record<string, ExperienceRecord>>(RECORDS_KEY, {})
    kvSet<Record<string, Evidence>>(EVIDENCE_KEY, {})
    kvSet<Record<string, CanonicalTag>>(CANONICAL_TAGS_KEY, {})
    saveStoredDeliveryToolkitCategories([])
    kvSet<Record<string, TagInferenceMarker[]>>(TAG_INFERENCE_MARKERS_KEY, {})
    kvSet<Record<string, Anomaly>>(ANOMALIES_KEY, {})
    kvSet<Record<string, GenerationManifest>>(GENERATION_MANIFESTS_KEY, {})
  }

  async initialize(_dbPath?: string | null): Promise<void> {
    if (!kvGet<boolean>(INIT_KEY)) {
      await this.initializeEmptyState()
      kvSet(INIT_KEY, true)
    }

    const canonicalTagsObj = kvGet<Record<string, CanonicalTag>>(CANONICAL_TAGS_KEY) ?? {}
    if (!kvGet<DeliveryToolkitCategory[]>(DELIVERY_TOOLKIT_CATEGORIES_KEY)) {
      saveStoredDeliveryToolkitCategories(deriveStoredDeliveryToolkitCategories(canonicalTagsObj))
    }
    if (!kvGet<Record<string, TagInferenceMarker[]>>(TAG_INFERENCE_MARKERS_KEY)) {
      kvSet(TAG_INFERENCE_MARKERS_KEY, buildDefaultTagInferenceMarkerMap(canonicalTagsObj))
    }
    if (!kvGet<Record<string, Anomaly>>(ANOMALIES_KEY)) {
      kvSet(ANOMALIES_KEY, {})
    }
    if (!kvGet<Record<string, GenerationManifest>>(GENERATION_MANIFESTS_KEY)) {
      kvSet(GENERATION_MANIFESTS_KEY, {})
    }
  }

  async getActiveDbPath(): Promise<string> {
    return 'Browser localStorage harness'
  }

  async buildCareerLibraryExport(): Promise<CareerLibraryExport> {
    const records = await this.getRecords()
    const evidence = (await this.getAllEvidence())
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))

    const evidenceByRecord = new Map<string, CareerLibraryExportEvidenceItem[]>()
    evidence.forEach((item) => {
      const existing = evidenceByRecord.get(item.experience_record_id) ?? []
      existing.push(mapEvidenceToExportItem(item))
      evidenceByRecord.set(item.experience_record_id, existing)
    })

    return {
      export_type: 'career_library_extract',
      experience_records: records
        .slice()
        .sort(compareExperienceRecordsForExport)
        .map((record) => mapRecordToExportRecord(record, evidenceByRecord.get(record.id) ?? [])),
      export_meta: {
        schema_version: EXPORT_SCHEMA_VERSION,
        exported_at: new Date().toISOString(),
        taxonomy_version: 'browser-harness',
        source_db_name: 'browser-harness-store',
      },
    }
  }

  async buildRequirementAnalysis(_jobPostingText: string): Promise<RequirementAnalysis> {
    throw new Error('Requirement analysis is available only in the Tauri desktop runtime.')
  }

  async getBuildPolicy(): Promise<BuildPolicy> {
    throw new Error('Build policy loading is available only in the Tauri desktop runtime.')
  }

  async saveBuildPolicy(_buildPolicy: BuildPolicy): Promise<BuildPolicy> {
    throw new Error('Build policy saving is available only in the Tauri desktop runtime.')
  }

  async buildBundleSemantics(
    _careerLibraryExport: CareerLibraryExport,
    _requirementAnalysis: RequirementAnalysis,
  ): Promise<BundleSemantics> {
    throw new Error('Bundle semantics are available only in the Tauri desktop runtime.')
  }

  async runPreflightFilter(
    _careerLibraryExport: CareerLibraryExport,
    _requirementAnalysis: RequirementAnalysis,
    _threshold: number,
    _fallbackMinRecords: number,
  ): Promise<PreflightFilterResult> {
    throw new Error('Preflight filtering is available only in the Tauri desktop runtime.')
  }

  async prepareResumeBundle(
    _jobPostingText: string,
    _requirementAnalysis: RequirementAnalysis,
    _preflightResult: PreflightFilterResult,
  ): Promise<ResumeBundleInput> {
    throw new Error('Resume bundle preparation is available only in the Tauri desktop runtime.')
  }

  async assembleResume(_bundle: ResumeBundleInput): Promise<ResumeAssemblyResult> {
    throw new Error('Resume assembly is available only in the Tauri desktop runtime.')
  }

  async runResumePipeline(_request: ResumePipelineRequest): Promise<ResumePipelineResult> {
    throw new Error('Resume pipeline orchestration is available only in the Tauri desktop runtime.')
  }

  normalizeTag(input: string): string {
    return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  }

  async normalizeTags(tags: string[]): Promise<TagNormalizationResult> {
    const canonicalTagsObj = kvGet<Record<string, CanonicalTag>>(CANONICAL_TAGS_KEY) ?? {}

    const normalized: string[] = []
    const unknown: string[] = []
    const seen = new Set<string>()

    for (const tag of tags) {
      const normalizedTag = this.normalizeTag(tag)
      if (!normalizedTag || seen.has(normalizedTag)) continue

      if (canonicalTagsObj[normalizedTag]) {
        normalized.push(normalizedTag)
        seen.add(normalizedTag)
      } else {
        unknown.push(normalizedTag)
      }
    }

    return { normalized, unknown }
  }

  private async buildEvidenceInferenceComparison(
    data: EvidenceFormData
  ): Promise<EvidenceInferenceComparison> {
    const normalized = await this.normalizeTags(data.tags)
    return {
      manualTags: normalized.normalized,
      inferredTags: normalized.normalized,
      unknownManualTags: normalized.unknown,
      tagsMatch: normalized.unknown.length === 0,
    }
  }

  async getRecords(): Promise<ExperienceRecord[]> {
    const recordsObj = kvGet<Record<string, ExperienceRecord>>(RECORDS_KEY) ?? {}
    return Object.values(recordsObj).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }

  async getRecord(id: string): Promise<ExperienceRecord | undefined> {
    const recordsObj = kvGet<Record<string, ExperienceRecord>>(RECORDS_KEY) ?? {}
    return recordsObj[id]
  }

  async createRecord(data: ExperienceRecordFormData): Promise<ExperienceRecord> {
    const recordsObj = kvGet<Record<string, ExperienceRecord>>(RECORDS_KEY) ?? {}

    const slug = resolveRecordSlug(data)
    if (Object.values(recordsObj).some((r) => r.slug === slug)) {
      throw new Error(`Slug '${slug}' already exists. Please choose a unique slug.`)
    }

    const now = new Date().toISOString()
    const record: ExperienceRecord = {
      ...data,
      slug,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    }

    recordsObj[record.id] = record
    kvSet(RECORDS_KEY, recordsObj)
    return record
  }

  async updateRecord(id: string, data: ExperienceRecordFormData): Promise<ExperienceRecord> {
    const recordsObj = kvGet<Record<string, ExperienceRecord>>(RECORDS_KEY) ?? {}
    const existing = recordsObj[id]

    if (!existing) {
      throw new Error('Record not found')
    }

    const slug = resolveRecordSlug(data)
    if (Object.values(recordsObj).some((r) => r.slug === slug && r.id !== id)) {
      throw new Error(`Slug '${slug}' already exists. Please choose a unique slug.`)
    }

    const updated: ExperienceRecord = {
      ...data,
      slug,
      id: existing.id,
      created_at: existing.created_at,
      updated_at: new Date().toISOString(),
    }

    recordsObj[id] = updated
    kvSet(RECORDS_KEY, recordsObj)
    return updated
  }

  async previewDeleteRecords(ids: string[]): Promise<DeleteRecordsPreview> {
    return this.buildDeleteRecordsPreview(ids)
  }

  async deleteRecords(
    ids: string[],
    options?: DeleteBatchOptions
  ): Promise<DeleteRecordsResult> {
    return this.commitDeleteRecords(this.buildDeleteRecordsPreview(ids), options)
  }

  async deleteRecord(id: string): Promise<void> {
    this.commitDeleteRecords(this.buildDeleteRecordsPreview([id]), { strict: false })
  }

  async getEvidenceForRecord(recordId: string): Promise<Evidence[]> {
    const evidenceObj = kvGet<Record<string, Evidence>>(EVIDENCE_KEY) ?? {}
    return Object.values(evidenceObj)
      .filter((e) => e.experience_record_id === recordId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  async getAllEvidence(): Promise<Evidence[]> {
    const evidenceObj = kvGet<Record<string, Evidence>>(EVIDENCE_KEY) ?? {}
    return Object.values(evidenceObj).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }

  async getEvidence(id: string): Promise<Evidence | undefined> {
    const evidenceObj = kvGet<Record<string, Evidence>>(EVIDENCE_KEY) ?? {}
    return evidenceObj[id]
  }

  async createEvidence(
    recordId: string,
    data: EvidenceFormData,
    _decision?: EvidenceSaveDecision,
  ): Promise<EvidenceSaveResponse> {
    const recordsObj = kvGet<Record<string, ExperienceRecord>>(RECORDS_KEY) ?? {}
    const record = recordsObj[recordId]

    if (!record) {
      throw new Error('Parent record not found')
    }

    const comparison = await this.buildEvidenceInferenceComparison(data)
    if (comparison.unknownManualTags.length > 0) {
      throw new Error(
        `Unknown tags: ${comparison.unknownManualTags.join(', ')}. Add them to taxonomy first.`
      )
    }

    const now = new Date().toISOString()
    const evidence: Evidence = {
      ...data,
      tags: comparison.manualTags,
      id: crypto.randomUUID(),
      experience_record_id: recordId,
      created_at: now,
      updated_at: now,
    }

    const evidenceObj = kvGet<Record<string, Evidence>>(EVIDENCE_KEY) ?? {}
    evidenceObj[evidence.id] = evidence
    kvSet(EVIDENCE_KEY, evidenceObj)
    return {
      status: 'saved',
      evidence,
      comparison,
    }
  }

  async updateEvidence(
    id: string,
    data: EvidenceFormData,
    _decision?: EvidenceSaveDecision,
  ): Promise<EvidenceSaveResponse> {
    const evidenceObj = kvGet<Record<string, Evidence>>(EVIDENCE_KEY) ?? {}
    const existing = evidenceObj[id]

    if (!existing) {
      throw new Error('Evidence not found')
    }

    const comparison = await this.buildEvidenceInferenceComparison(data)
    if (comparison.unknownManualTags.length > 0) {
      throw new Error(
        `Unknown tags: ${comparison.unknownManualTags.join(', ')}. Add them to taxonomy first.`
      )
    }

    const updated: Evidence = {
      ...data,
      tags: comparison.manualTags,
      id: existing.id,
      experience_record_id: existing.experience_record_id,
      created_at: existing.created_at,
      updated_at: new Date().toISOString(),
    }

    evidenceObj[id] = updated
    kvSet(EVIDENCE_KEY, evidenceObj)
    return {
      status: 'saved',
      evidence: updated,
      comparison,
    }
  }

  async previewEvidenceInference(
    _recordId: string,
    data: EvidenceFormData
  ): Promise<EvidenceInferenceComparison> {
    return this.buildEvidenceInferenceComparison(data)
  }

  async previewDeleteEvidenceItems(ids: string[]): Promise<DeleteEvidenceItemsPreview> {
    return this.buildDeleteEvidenceItemsPreview(ids)
  }

  async deleteEvidenceItems(
    ids: string[],
    options?: DeleteBatchOptions
  ): Promise<DeleteEvidenceItemsResult> {
    return this.commitDeleteEvidenceItems(this.buildDeleteEvidenceItemsPreview(ids), options)
  }

  async deleteEvidence(id: string): Promise<void> {
    this.commitDeleteEvidenceItems(this.buildDeleteEvidenceItemsPreview([id]), {
      strict: false,
    })
  }

  async getCandidateProfile(): Promise<CandidateProfile | undefined> {
    return kvGet<CandidateProfile>(CANDIDATE_PROFILE_KEY) ?? undefined
  }

  async replaceCandidateProfile(profile: CandidateProfile): Promise<CandidateProfile> {
    const normalized = await this.normalizeCandidateProfile(profile)
    kvSet(CANDIDATE_PROFILE_KEY, normalized)
    return normalized
  }

  async deleteCandidateProfile(): Promise<void> {
    kvDelete(CANDIDATE_PROFILE_KEY)
  }

  async getCandidateProfileCertificationTags(): Promise<string[]> {
    const profile = kvGet<CandidateProfile>(CANDIDATE_PROFILE_KEY)
    if (!profile) {
      return []
    }

    return dedupePreserve(
      profile.staticSections.certifications.flatMap((entry) => entry.signalTags)
    )
  }

  async getAnomalies(): Promise<Anomaly[]> {
    const anomalies = kvGet<Record<string, Anomaly>>(ANOMALIES_KEY) ?? {}
    return Object.values(anomalies).sort((a, b) => a.detectedAt.localeCompare(b.detectedAt))
  }

  async getAnomaly(id: string): Promise<Anomaly | undefined> {
    const anomalies = kvGet<Record<string, Anomaly>>(ANOMALIES_KEY) ?? {}
    return anomalies[id]
  }

  async resolveAnomaly(id: string): Promise<Anomaly> {
    const anomalies = kvGet<Record<string, Anomaly>>(ANOMALIES_KEY) ?? {}
    const existing = anomalies[id]
    if (!existing) {
      throw new Error('Anomaly not found')
    }
    const updated = { ...existing, resolvedAt: new Date().toISOString() }
    anomalies[id] = updated
    kvSet(ANOMALIES_KEY, anomalies)
    return updated
  }

  async reopenAnomaly(id: string): Promise<Anomaly> {
    const anomalies = kvGet<Record<string, Anomaly>>(ANOMALIES_KEY) ?? {}
    const existing = anomalies[id]
    if (!existing) {
      throw new Error('Anomaly not found')
    }
    const updated = { ...existing, resolvedAt: null }
    anomalies[id] = updated
    kvSet(ANOMALIES_KEY, anomalies)
    return updated
  }

  async deleteAnomaly(id: string): Promise<void> {
    const anomalies = kvGet<Record<string, Anomaly>>(ANOMALIES_KEY) ?? {}
    delete anomalies[id]
    kvSet(ANOMALIES_KEY, anomalies)
  }

  async getGenerationManifests(): Promise<GenerationManifest[]> {
    const manifests = kvGet<Record<string, GenerationManifest>>(GENERATION_MANIFESTS_KEY) ?? {}
    return Object.values(manifests).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getGenerationManifest(id: string): Promise<GenerationManifest | undefined> {
    const manifests = kvGet<Record<string, GenerationManifest>>(GENERATION_MANIFESTS_KEY) ?? {}
    return manifests[id]
  }

  async deleteGenerationManifest(id: string): Promise<void> {
    const manifests = kvGet<Record<string, GenerationManifest>>(GENERATION_MANIFESTS_KEY) ?? {}
    delete manifests[id]
    kvSet(GENERATION_MANIFESTS_KEY, manifests)
  }

  async updateManifestNotes(id: string, notes: string | null): Promise<GenerationManifest> {
    const manifests = kvGet<Record<string, GenerationManifest>>(GENERATION_MANIFESTS_KEY) ?? {}
    const manifest = manifests[id]
    if (!manifest) throw new Error(`Manifest ${id} not found`)
    manifest.notes = notes
    kvSet(GENERATION_MANIFESTS_KEY, manifests)
    return manifest
  }

  async getCanonicalTags(): Promise<CanonicalTag[]> {
    const tagsObj = kvGet<Record<string, CanonicalTag>>(CANONICAL_TAGS_KEY) ?? {}
    return Object.values(tagsObj).sort((a, b) => a.tag.localeCompare(b.tag))
  }

  async getCanonicalTag(tag: string): Promise<CanonicalTag | undefined> {
    const tagsObj = kvGet<Record<string, CanonicalTag>>(CANONICAL_TAGS_KEY) ?? {}
    return tagsObj[tag]
  }

  async getDeliveryToolkitCategories(): Promise<DeliveryToolkitCategory[]> {
    return getStoredDeliveryToolkitCategories()
  }

  async createDeliveryToolkitCategory(name: string): Promise<DeliveryToolkitCategory> {
    const normalizedName = name.trim()
    if (!normalizedName) {
      throw new Error('Category name is required')
    }

    const categories = getStoredDeliveryToolkitCategories()
    if (categories.some((category) => category.name === normalizedName)) {
      throw new Error(`Category "${normalizedName}" already exists`)
    }

    const nextSortOrder =
      categories.reduce((max, category) => Math.max(max, category.sort_order), 0) + 100
    const createdCategory = {
      name: normalizedName,
      sort_order: nextSortOrder,
    }

    saveStoredDeliveryToolkitCategories([...categories, createdCategory])
    return createdCategory
  }

  async renameDeliveryToolkitCategory(
    currentName: string,
    nextName: string,
  ): Promise<DeliveryToolkitCategory> {
    const normalizedCurrentName = currentName.trim()
    const normalizedNextName = nextName.trim()
    if (!normalizedCurrentName) {
      throw new Error('Current category name is required')
    }
    if (!normalizedNextName) {
      throw new Error('Category name is required')
    }

    const categories = getStoredDeliveryToolkitCategories()
    const existingCategory = categories.find((category) => category.name === normalizedCurrentName)
    if (!existingCategory) {
      throw new Error(`Category "${normalizedCurrentName}" not found`)
    }
    if (
      normalizedCurrentName !== normalizedNextName &&
      categories.some((category) => category.name === normalizedNextName)
    ) {
      throw new Error(`Category "${normalizedNextName}" already exists`)
    }

    const updatedCategories = categories.map((category) =>
      category.name === normalizedCurrentName
        ? { ...category, name: normalizedNextName }
        : category
    )
    saveStoredDeliveryToolkitCategories(updatedCategories)

    const tagsObj = kvGet<Record<string, CanonicalTag>>(CANONICAL_TAGS_KEY) ?? {}
    Object.values(tagsObj).forEach((tag) => {
      if (tag.category === normalizedCurrentName) {
        tag.category = normalizedNextName
      }
    })
    kvSet(CANONICAL_TAGS_KEY, tagsObj)

    return {
      ...existingCategory,
      name: normalizedNextName,
    }
  }

  async deleteDeliveryToolkitCategory(name: string): Promise<void> {
    const normalizedName = name.trim()
    if (!normalizedName) {
      throw new Error('Category name is required')
    }

    const categories = getStoredDeliveryToolkitCategories()
    if (!categories.some((category) => category.name === normalizedName)) {
      throw new Error(`Category "${normalizedName}" not found`)
    }

    const tagsObj = kvGet<Record<string, CanonicalTag>>(CANONICAL_TAGS_KEY) ?? {}
    const tagsUsingCategory = Object.values(tagsObj).filter(
      (tag) => tag.category === normalizedName
    ).length
    if (tagsUsingCategory > 0) {
      throw new Error(
        `Cannot delete category in use by ${tagsUsingCategory} canonical tag(s)`
      )
    }

    saveStoredDeliveryToolkitCategories(
      categories.filter((category) => category.name !== normalizedName)
    )
  }

  async importTaxonomy(_path: string): Promise<TaxonomyImportResult> {
    throw new Error('Taxonomy import is available only in the Tauri desktop runtime.')
  }

  async exportTaxonomy(_path: string): Promise<string> {
    throw new Error('Taxonomy export is available only in the Tauri desktop runtime.')
  }

  async resetTaxonomyToStarter(): Promise<TaxonomyImportResult> {
    throw new Error('Taxonomy reset is available only in the Tauri desktop runtime.')
  }

  async clearTaxonomy(): Promise<TaxonomyImportResult> {
    throw new Error('Taxonomy clear is available only in the Tauri desktop runtime.')
  }

  async getLibraryTagSyncStatus(): Promise<LibraryTagSyncStatus> {
    return {
      requiresReinference: false,
      lastTaxonomyChangeAt: null,
      lastLibraryTagRefreshAt: null,
    }
  }

  async reInferLibraryTags(): Promise<LibraryTagRefreshResult> {
    throw new Error('Library tag re-inference is available only in the Tauri desktop runtime.')
  }

  async createCanonicalTag(
    tag: string,
    description: string | null,
    category: string,
    displayLabel: string,
  ): Promise<CanonicalTag> {
    const tagsObj = kvGet<Record<string, CanonicalTag>>(CANONICAL_TAGS_KEY) ?? {}

    const normalized = this.normalizeTag(tag)
    const normalizedCategory = category.trim()
    const normalizedDisplayLabel = displayLabel.trim()
    if (!normalized) {
      throw new Error('Invalid tag format')
    }

    if (!normalizedCategory) {
      throw new Error('Category is required')
    }

    const categories = getStoredDeliveryToolkitCategories()
    if (!categories.some((item) => item.name === normalizedCategory)) {
      throw new Error(`Category "${normalizedCategory}" does not exist`)
    }

    if (!normalizedDisplayLabel) {
      throw new Error('Display label is required')
    }

    if (tagsObj[normalized]) {
      throw new Error(`Tag "${normalized}" already exists`)
    }

    const canonicalTag: CanonicalTag = {
      id: crypto.randomUUID(),
      tag: normalized,
      description,
      category: normalizedCategory,
      display_label: normalizedDisplayLabel,
      created_at: new Date().toISOString(),
    }

    tagsObj[normalized] = canonicalTag
    kvSet(CANONICAL_TAGS_KEY, tagsObj)

    const markerStore = kvGet<Record<string, TagInferenceMarker[]>>(TAG_INFERENCE_MARKERS_KEY) ?? {}
    markerStore[normalized] = materializeTagInferenceMarkers(
      normalized,
      defaultTagInferenceMarkerInputs(normalized)
    )
    kvSet(TAG_INFERENCE_MARKERS_KEY, markerStore)

    return canonicalTag
  }

  async updateCanonicalTag(
    oldTag: string,
    newTag: string,
    description: string | null,
    category: string,
    displayLabel: string,
  ): Promise<CanonicalTag> {
    const tagsObj = kvGet<Record<string, CanonicalTag>>(CANONICAL_TAGS_KEY) ?? {}
    const existing = tagsObj[oldTag]

    if (!existing) {
      throw new Error('Tag not found')
    }

    const normalized = this.normalizeTag(newTag)
    const normalizedCategory = category.trim()
    const normalizedDisplayLabel = displayLabel.trim()
    if (!normalized) {
      throw new Error('Invalid tag format')
    }

    if (!normalizedCategory) {
      throw new Error('Category is required')
    }

    const categories = getStoredDeliveryToolkitCategories()
    if (!categories.some((item) => item.name === normalizedCategory)) {
      throw new Error(`Category "${normalizedCategory}" does not exist`)
    }

    if (!normalizedDisplayLabel) {
      throw new Error('Display label is required')
    }

    if (normalized !== oldTag && tagsObj[normalized]) {
      throw new Error(`Tag "${normalized}" already exists`)
    }

    if (normalized !== oldTag) {
      delete tagsObj[oldTag]

      const recordsObj = kvGet<Record<string, ExperienceRecord>>(RECORDS_KEY) ?? {}
      Object.values(recordsObj).forEach((record) => {
        if (record.context_tags.includes(oldTag)) {
          record.context_tags = record.context_tags.map((t) => (t === oldTag ? normalized : t))
        }
      })
      kvSet(RECORDS_KEY, recordsObj)

      const evidenceObj = kvGet<Record<string, Evidence>>(EVIDENCE_KEY) ?? {}
      Object.values(evidenceObj).forEach((item) => {
        if (item.tags.includes(oldTag)) {
          item.tags = item.tags.map((t) => (t === oldTag ? normalized : t))
        }
      })
      kvSet(EVIDENCE_KEY, evidenceObj)

      const markerStore = kvGet<Record<string, TagInferenceMarker[]>>(TAG_INFERENCE_MARKERS_KEY) ?? {}
      const existingMarkers = markerStore[oldTag] ?? []
      delete markerStore[oldTag]
      markerStore[normalized] = existingMarkers.map((marker) => ({
        ...marker,
        canonicalTag: normalized,
      }))
      kvSet(TAG_INFERENCE_MARKERS_KEY, markerStore)
    }

    const updated: CanonicalTag = {
      ...existing,
      tag: normalized,
      description,
      category: normalizedCategory,
      display_label: normalizedDisplayLabel,
    }

    tagsObj[normalized] = updated
    kvSet(CANONICAL_TAGS_KEY, tagsObj)
    return updated
  }

  async deleteCanonicalTag(tag: string): Promise<void> {
    const recordsObj = kvGet<Record<string, ExperienceRecord>>(RECORDS_KEY) ?? {}
    const evidenceObj = kvGet<Record<string, Evidence>>(EVIDENCE_KEY) ?? {}

    const recordsUsing = Object.values(recordsObj).filter((r) =>
      r.context_tags.includes(tag)
    ).length
    const evidenceUsing = Object.values(evidenceObj).filter((e) => e.tags.includes(tag))
      .length

    if (recordsUsing > 0 || evidenceUsing > 0) {
      throw new Error(
        `Cannot delete tag in use by ${recordsUsing} record(s) and ${evidenceUsing} evidence item(s)`
      )
    }

    const tagsObj = kvGet<Record<string, CanonicalTag>>(CANONICAL_TAGS_KEY) ?? {}
    delete tagsObj[tag]
    kvSet(CANONICAL_TAGS_KEY, tagsObj)

    const markerStore = kvGet<Record<string, TagInferenceMarker[]>>(TAG_INFERENCE_MARKERS_KEY) ?? {}
    delete markerStore[tag]
    kvSet(TAG_INFERENCE_MARKERS_KEY, markerStore)
  }

  async getTagInferenceMarkers(canonicalTag: string): Promise<TagInferenceMarker[]> {
    const markerStore = kvGet<Record<string, TagInferenceMarker[]>>(TAG_INFERENCE_MARKERS_KEY) ?? {}
    const existing = markerStore[canonicalTag]
    if (existing) {
      return existing
    }

    const tagsObj = kvGet<Record<string, CanonicalTag>>(CANONICAL_TAGS_KEY) ?? {}
    if (!tagsObj[canonicalTag]) {
      throw new Error(`Tag "${canonicalTag}" not found`)
    }

    const defaultMarkers = materializeTagInferenceMarkers(
      canonicalTag,
      defaultTagInferenceMarkerInputs(canonicalTag)
    )
    markerStore[canonicalTag] = defaultMarkers
    kvSet(TAG_INFERENCE_MARKERS_KEY, markerStore)
    return defaultMarkers
  }

  async replaceTagInferenceMarkers(
    canonicalTag: string,
    markers: TagInferenceMarkerInput[]
  ): Promise<TagInferenceMarker[]> {
    const tagsObj = kvGet<Record<string, CanonicalTag>>(CANONICAL_TAGS_KEY) ?? {}
    if (!tagsObj[canonicalTag]) {
      throw new Error(`Tag "${canonicalTag}" not found`)
    }

    const normalizedMarkers = materializeTagInferenceMarkers(canonicalTag, markers)
    const markerStore = kvGet<Record<string, TagInferenceMarker[]>>(TAG_INFERENCE_MARKERS_KEY) ?? {}
    markerStore[canonicalTag] = normalizedMarkers
    kvSet(TAG_INFERENCE_MARKERS_KEY, markerStore)
    return normalizedMarkers
  }

  async testMarkers(_text: string, markers: TagInferenceMarkerInput[]): Promise<TestMarkersResult> {
    // Local service can't run inference — return all-false results
    return {
      matches: markers.map((_, i) => ({ markerIndex: i, matched: false })),
      normalizedText: _text.trim().toLowerCase(),
    }
  }

  async importRawIntake(_path: string): Promise<RawIntakeImportResult> {
    throw new Error(
      'Raw intake import is available only in the Tauri desktop runtime.'
    )
  }

  async reset(): Promise<void> {
    kvDelete(RECORDS_KEY)
    kvDelete(EVIDENCE_KEY)
    kvDelete(CANONICAL_TAGS_KEY)
    kvDelete(DELIVERY_TOOLKIT_CATEGORIES_KEY)
    kvDelete(TAG_INFERENCE_MARKERS_KEY)
    kvDelete(CANDIDATE_PROFILE_KEY)
    kvDelete(ANOMALIES_KEY)
    kvDelete(GENERATION_MANIFESTS_KEY)
    kvDelete(INIT_KEY)
    await this.initializeEmptyState()
    kvSet(INIT_KEY, true)
  }
}

export const localService = new LocalCareerService()

export const localServices: RuntimeServices = {
  runtimeAdmin: localService,
  pipeline: localService,
  library: localService,
  operations: localService,
  taxonomy: localService,
  intake: localService,
  tagNormalization: localService,
}
