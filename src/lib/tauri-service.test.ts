import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CandidateProfile,
  EvidenceFormData,
  ExperienceRecordFormData,
  TagInferenceMarkerInput,
} from '@/lib/types'
import { localService } from '@/lib/local-service'

const defaultRecordData: ExperienceRecordFormData = {
  slug: '',
  record_type: 'employment',
  organization: 'Example Corp',
  title: 'Platform Engineer',
  start_date: '2024-01',
  end_date: '2024-06',
  location: null,
  employment_type: null,
  context_tags: ['data_analysis'],
}

const defaultEvidenceData: EvidenceFormData = {
  claim: 'Built the reporting pipeline',
  date_range: '2024',
  tags: ['Data Analysis'],
  evidence_note: 'Normalized against the canonical taxonomy.',
}

const defaultCandidateProfile: CandidateProfile = {
  version: '1.0',
  configType: 'candidate_profile',
  candidateIdentity: {
    displayName: 'Ada Example',
    location: 'Remote',
    contact: {
      email: null,
      phone: null,
      linkedin: 'https://linkedin.example/ada',
      github: null,
    },
  },
  staticSections: {
    education: [],
    certifications: [],
    profileSummarySeed: ['Builds reliable systems'],
  },
}

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

import { tauriService } from '@/lib/tauri-service'

describe('tauriService shared adapter contract', () => {
  beforeEach(() => {
    invokeMock.mockReset()
  })

  it('shares normalizeTag semantics with the browser adapter', () => {
    const rawTag = ' Senior Platform / Data '

    expect(tauriService.normalizeTag(rawTag)).toBe(localService.normalizeTag(rawTag))
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('maps representative shared seams onto the expected Tauri commands', async () => {
    const markerInputs: TagInferenceMarkerInput[] = [
      {
        markerKind: 'literal',
        literalValue: 'platform',
        allOf: [],
        anyOf: [],
      },
    ]

    invokeMock.mockResolvedValue(undefined)

    await tauriService.initialize('career-ledger.sqlite3')
    await tauriService.buildRequirementAnalysis('job posting text')
    await tauriService.updateManifestNotes('manifest-1', 'review later')
    await tauriService.importTaxonomy('C:/tmp/taxonomy.json')
    await tauriService.exportTaxonomy('C:/tmp/export.json')
    await tauriService.replaceTagInferenceMarkers('platform_engineering', markerInputs)
    await tauriService.importRawIntake('C:/tmp/intake.json')

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'initialize_db', {
      dbPath: 'career-ledger.sqlite3',
    })
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'build_requirement_analysis', {
      jobPostingText: 'job posting text',
    })
    expect(invokeMock).toHaveBeenNthCalledWith(3, 'update_manifest_notes', {
      id: 'manifest-1',
      notes: 'review later',
    })
    expect(invokeMock).toHaveBeenNthCalledWith(4, 'import_taxonomy', {
      taxonomyPath: 'C:/tmp/taxonomy.json',
    })
    expect(invokeMock).toHaveBeenNthCalledWith(5, 'export_taxonomy', {
      outputPath: 'C:/tmp/export.json',
    })
    expect(invokeMock).toHaveBeenNthCalledWith(6, 'replace_tag_inference_markers', {
      canonicalTag: 'platform_engineering',
      markers: markerInputs,
    })
    expect(invokeMock).toHaveBeenNthCalledWith(7, 'import_raw_intake', {
      rawFilePath: 'C:/tmp/intake.json',
    })
  })

  it('maps reusable requirement-review noise settings onto stable Tauri commands', async () => {
    invokeMock.mockResolvedValue([])

    await tauriService.getRequirementReviewNoiseTerms()
    await tauriService.saveRequirementReviewNoiseTerms(['you', 'developer experience'])

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'get_requirement_review_noise_terms')
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'save_requirement_review_noise_terms', {
      noiseTerms: ['you', 'developer experience'],
    })
  })

  it('coerces nullable record lookups to undefined', async () => {
    invokeMock.mockResolvedValueOnce(null)
    invokeMock.mockResolvedValueOnce(null)
    invokeMock.mockResolvedValueOnce(null)

    await expect(tauriService.getRecord('missing-record')).resolves.toBeUndefined()
    await expect(tauriService.getEvidence('missing-evidence')).resolves.toBeUndefined()
    await expect(tauriService.getCanonicalTag('missing_tag')).resolves.toBeUndefined()

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'get_record', { id: 'missing-record' })
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'get_evidence', { id: 'missing-evidence' })
    expect(invokeMock).toHaveBeenNthCalledWith(3, 'get_canonical_tag', { tag: 'missing_tag' })
  })

  it('maps shared library, profile, taxonomy, and reset seams onto stable Tauri commands', async () => {
    invokeMock.mockResolvedValue(undefined)

    await tauriService.getRecords()
    await tauriService.createRecord(defaultRecordData)
    await tauriService.createEvidence('record-1', defaultEvidenceData)
    await tauriService.previewEvidenceInference('record-1', defaultEvidenceData)
    await tauriService.replaceCandidateProfile(defaultCandidateProfile)
    await tauriService.getCandidateProfileCertificationTags()
    await tauriService.getAnomalies()
    await tauriService.getGenerationManifests()
    await tauriService.createDeliveryToolkitCategory('Delivery')
    await tauriService.renameDeliveryToolkitCategory('Delivery', 'Strategy')
    await tauriService.createCanonicalTag('Data Analysis', 'desc', 'Strategy', 'Data Analysis')
    await tauriService.updateCanonicalTag(
      'data_analysis',
      'Insights Analysis',
      'updated desc',
      'Strategy',
      'Insights Analysis'
    )
    await tauriService.reset()

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'get_records')
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'create_record', { data: defaultRecordData })
    expect(invokeMock).toHaveBeenNthCalledWith(3, 'create_evidence', {
      recordId: 'record-1',
      data: defaultEvidenceData,
      decision: undefined,
    })
    expect(invokeMock).toHaveBeenNthCalledWith(4, 'preview_evidence_inference', {
      recordId: 'record-1',
      data: defaultEvidenceData,
    })
    expect(invokeMock).toHaveBeenNthCalledWith(5, 'replace_candidate_profile', {
      profile: defaultCandidateProfile,
    })
    expect(invokeMock).toHaveBeenNthCalledWith(6, 'get_candidate_profile_certification_tags')
    expect(invokeMock).toHaveBeenNthCalledWith(7, 'get_anomalies')
    expect(invokeMock).toHaveBeenNthCalledWith(8, 'get_generation_manifests')
    expect(invokeMock).toHaveBeenNthCalledWith(9, 'create_delivery_toolkit_category', {
      name: 'Delivery',
    })
    expect(invokeMock).toHaveBeenNthCalledWith(10, 'rename_delivery_toolkit_category', {
      currentName: 'Delivery',
      nextName: 'Strategy',
    })
    expect(invokeMock).toHaveBeenNthCalledWith(11, 'create_canonical_tag', {
      tag: 'Data Analysis',
      description: 'desc',
      category: 'Strategy',
      displayLabel: 'Data Analysis',
    })
    expect(invokeMock).toHaveBeenNthCalledWith(12, 'update_canonical_tag', {
      oldTag: 'data_analysis',
      newTag: 'Insights Analysis',
      description: 'updated desc',
      category: 'Strategy',
      displayLabel: 'Insights Analysis',
    })
    expect(invokeMock).toHaveBeenNthCalledWith(13, 'reset_db')
  })

  it('maps batch delete preview and commit seams onto stable Tauri commands', async () => {
    invokeMock.mockResolvedValue(undefined)

    await tauriService.previewDeleteRecords(['record-1', 'record-2'])
    await tauriService.deleteRecords(['record-1', 'record-2'], { strict: true })
    await tauriService.previewDeleteEvidenceItems(['evidence-1'])
    await tauriService.deleteEvidenceItems(['evidence-1'], { strict: false })

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'preview_delete_records', {
      ids: ['record-1', 'record-2'],
    })
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'delete_records', {
      ids: ['record-1', 'record-2'],
      options: { strict: true },
    })
    expect(invokeMock).toHaveBeenNthCalledWith(3, 'preview_delete_evidence_items', {
      ids: ['evidence-1'],
    })
    expect(invokeMock).toHaveBeenNthCalledWith(4, 'delete_evidence_items', {
      ids: ['evidence-1'],
      options: { strict: false },
    })
  })
})