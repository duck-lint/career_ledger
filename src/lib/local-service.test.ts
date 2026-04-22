import { beforeEach, describe, expect, it } from 'vitest'
import type { CandidateProfile, EvidenceFormData, ExperienceRecordFormData, TagInferenceMarkerInput } from '@/lib/types'
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

const defaultMarkerInputs: TagInferenceMarkerInput[] = [
  {
    markerKind: 'literal',
    literalValue: 'analysis',
    allOf: [],
    anyOf: [],
  },
]

const defaultCandidateProfile: CandidateProfile = {
  version: '1.0',
  configType: 'candidate_profile',
  candidateIdentity: {
    displayName: 'Ada Example',
    location: 'Remote',
    contact: {
      email: '  ',
      phone: '  ',
      linkedin: 'https://linkedin.example/ada',
      github: null,
    },
  },
  staticSections: {
    education: [],
    certifications: [
      {
        id: 'cert-1',
        name: 'AWS Certified Developer',
        issuer: 'AWS',
        credentialDetail: 'Associate',
        signalTags: ['AWS Cert', 'aws_cert'],
      },
    ],
    profileSummarySeed: ['Builds reliable systems'],
  },
}

describe('localService shared adapter contract', () => {
  beforeEach(async () => {
    localStorage.clear()
    await localService.initialize()
  })

  it('boots as an empty browser harness store', async () => {
    await expect(localService.getActiveDbPath()).resolves.toBe('Browser localStorage harness')
    await expect(localService.getRecords()).resolves.toEqual([])
    await expect(localService.getAllEvidence()).resolves.toEqual([])
    await expect(localService.getAnomalies()).resolves.toEqual([])
    await expect(localService.getGenerationManifests()).resolves.toEqual([])
    await expect(localService.getCanonicalTags()).resolves.toEqual([])
    await expect(localService.getDeliveryToolkitCategories()).resolves.toEqual([])

    const exportData = await localService.buildCareerLibraryExport()
    expect(exportData.experience_records).toEqual([])
    expect(exportData.export_meta.taxonomy_version).toBe('browser-harness')
    expect(exportData.export_meta.source_db_name).toBe('browser-harness-store')
  })

  it('normalizes tags against the canonical taxonomy', async () => {
    await localService.createDeliveryToolkitCategory('Delivery')
    await localService.createCanonicalTag('Data Analysis', 'desc', 'Delivery', 'Data Analysis')

    expect(localService.normalizeTag('  Data Analysis  ')).toBe('data_analysis')
    await expect(
      localService.normalizeTags(['Data Analysis', 'unknown-tag', 'data_analysis'])
    ).resolves.toEqual({
      normalized: ['data_analysis'],
      unknown: ['unknown_tag'],
    })
  })

  it('rejects desktop-only pipeline behavior explicitly', async () => {
    await expect(localService.buildRequirementAnalysis('job posting text')).rejects.toThrow(
      'Requirement analysis is available only in the Tauri desktop runtime.'
    )
  })

  it('supports record and evidence lifecycle behavior for the shared library seam', async () => {
    await localService.createDeliveryToolkitCategory('Delivery')
    await localService.createCanonicalTag('Data Analysis', 'desc', 'Delivery', 'Data Analysis')

    const record = await localService.createRecord(defaultRecordData)
    const preview = await localService.previewEvidenceInference(record.id, defaultEvidenceData)
    const saveResponse = await localService.createEvidence(record.id, defaultEvidenceData)
    const deletePreview = await localService.previewDeleteRecords([record.id])

    expect(record.slug).toBe('example-corp-platform-engineer')
    expect(preview).toEqual({
      manualTags: ['data_analysis'],
      inferredTags: ['data_analysis'],
      unknownManualTags: [],
      tagsMatch: true,
    })
    expect(saveResponse.status).toBe('saved')
    expect(saveResponse.evidence?.tags).toEqual(['data_analysis'])
    expect(deletePreview).toEqual({
      requestedCount: 1,
      foundCount: 1,
      missingIds: [],
      records: [
        {
          id: record.id,
          slug: record.slug,
          organization: record.organization,
          title: record.title,
          linkedEvidenceCount: 1,
        },
      ],
      cascadeEvidenceCount: 1,
    })

    await localService.deleteRecord(record.id)

    await expect(localService.getRecords()).resolves.toEqual([])
    await expect(localService.getAllEvidence()).resolves.toEqual([])
  })

  it('supports strict batch delete preview and commit semantics for the shared library seam', async () => {
    await localService.createDeliveryToolkitCategory('Delivery')
    await localService.createCanonicalTag('Data Analysis', 'desc', 'Delivery', 'Data Analysis')

    const firstRecord = await localService.createRecord(defaultRecordData)
    const secondRecord = await localService.createRecord({
      ...defaultRecordData,
      title: 'Staff Engineer',
    })
    const firstEvidence = await localService.createEvidence(firstRecord.id, defaultEvidenceData)
    const secondEvidence = await localService.createEvidence(secondRecord.id, {
      ...defaultEvidenceData,
      claim: 'Defined delivery operating model',
    })

    await expect(
      localService.deleteRecords([firstRecord.id, 'missing-record'], { strict: true })
    ).rejects.toThrow(/missing: missing-record/i)
    await expect(
      localService.deleteEvidenceItems([firstEvidence.evidence!.id, 'missing-evidence'], {
        strict: true,
      })
    ).rejects.toThrow(/missing: missing-evidence/i)

    const evidencePreview = await localService.previewDeleteEvidenceItems([
      firstEvidence.evidence!.id,
      secondEvidence.evidence!.id,
    ])
    expect(evidencePreview).toEqual({
      requestedCount: 2,
      foundCount: 2,
      missingIds: [],
      evidenceItems: [
        {
          id: firstEvidence.evidence!.id,
          experienceRecordId: firstRecord.id,
          recordSlug: firstRecord.slug,
          claim: firstEvidence.evidence!.claim,
        },
        {
          id: secondEvidence.evidence!.id,
          experienceRecordId: secondRecord.id,
          recordSlug: secondRecord.slug,
          claim: secondEvidence.evidence!.claim,
        },
      ],
    })

    const recordDeleteResult = await localService.deleteRecords(
      [firstRecord.id, secondRecord.id],
      { strict: true }
    )

    expect(recordDeleteResult.deletedRecordCount).toBe(2)
    expect(recordDeleteResult.deletedEvidenceCount).toBe(2)
    expect(recordDeleteResult.cascadeEvidenceCount).toBe(2)
    await expect(localService.getRecords()).resolves.toEqual([])
    await expect(localService.getAllEvidence()).resolves.toEqual([])
  })

  it('propagates taxonomy renames through linked records, evidence, and markers', async () => {
    await localService.createDeliveryToolkitCategory('Delivery')
    await localService.createCanonicalTag('Data Analysis', 'desc', 'Delivery', 'Data Analysis')

    const record = await localService.createRecord(defaultRecordData)
    const evidenceResponse = await localService.createEvidence(record.id, defaultEvidenceData)
    await localService.replaceTagInferenceMarkers('data_analysis', defaultMarkerInputs)

    await localService.renameDeliveryToolkitCategory('Delivery', 'Strategy')
    const renamedTag = await localService.updateCanonicalTag(
      'data_analysis',
      'Insights Analysis',
      'updated desc',
      'Strategy',
      'Insights Analysis'
    )

    expect(renamedTag.tag).toBe('insights_analysis')
    expect(renamedTag.category).toBe('Strategy')
    await expect(localService.getCanonicalTag('data_analysis')).resolves.toBeUndefined()
    await expect(localService.getRecord(record.id)).resolves.toMatchObject({
      context_tags: ['insights_analysis'],
    })
    await expect(localService.getEvidence(evidenceResponse.evidence!.id)).resolves.toMatchObject({
      tags: ['insights_analysis'],
    })
    await expect(localService.getTagInferenceMarkers('insights_analysis')).resolves.toSatisfy(
      (markers: Array<{ canonicalTag: string }>) =>
        markers.length > 0 && markers.every((marker) => marker.canonicalTag === 'insights_analysis')
    )
  })

  it('normalizes and stores candidate profile data for the shared profile seam', async () => {
    await localService.createDeliveryToolkitCategory('Credentials')
    await localService.createCanonicalTag('AWS Cert', 'desc', 'Credentials', 'AWS Cert')

    const savedProfile = await localService.replaceCandidateProfile(defaultCandidateProfile)

    expect(savedProfile.candidateIdentity.contact.email).toBeNull()
    expect(savedProfile.candidateIdentity.contact.phone).toBeNull()
    expect(savedProfile.staticSections.certifications[0].signalTags).toEqual(['aws_cert'])
    await expect(localService.getCandidateProfileCertificationTags()).resolves.toEqual(['aws_cert'])

    await localService.reset()

    await expect(localService.getCandidateProfile()).resolves.toBeUndefined()
    await expect(localService.getRecords()).resolves.toEqual([])
    await expect(localService.getCanonicalTags()).resolves.toEqual([])
  })
})