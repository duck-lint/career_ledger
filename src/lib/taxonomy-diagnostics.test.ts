import { describe, expect, it } from 'vitest'
import { buildTaxonomyDiagnostics, taxonomyDiagnosticsIssueCount } from '@/lib/taxonomy-diagnostics'
import type { CandidateProfile, CanonicalTag, Evidence, ExperienceRecord, TagInferenceMarker } from '@/lib/types'

const canonicalTags: CanonicalTag[] = [
  {
    id: 'tag-1',
    tag: 'rust',
    description: null,
    category: 'Technical Skills',
    display_label: 'Rust',
    created_at: '2026-04-24T00:00:00Z',
  },
  {
    id: 'tag-2',
    tag: 'kubernetes',
    description: null,
    category: null,
    display_label: null,
    created_at: '2026-04-24T00:00:00Z',
  },
]

const records: ExperienceRecord[] = [
  {
    id: 'record-1',
    slug: 'platform-engineer',
    record_type: 'employment',
    organization: 'Example Corp',
    title: 'Platform Engineer',
    start_date: '2024-01',
    end_date: 'present',
    location: null,
    employment_type: null,
    context_tags: ['rust', 'orphan_context'],
    created_at: '2026-04-24T00:00:00Z',
    updated_at: '2026-04-24T00:00:00Z',
  },
]

const evidence: Evidence[] = [
  {
    id: 'evidence-1',
    experience_record_id: 'record-1',
    claim: 'Built Rust tooling.',
    date_range: '2024',
    tags: ['rust', 'orphan_evidence'],
    evidence_note: null,
    created_at: '2026-04-24T00:00:00Z',
    updated_at: '2026-04-24T00:00:00Z',
  },
  {
    id: 'evidence-2',
    experience_record_id: 'record-1',
    claim: 'Captured untagged work.',
    date_range: null,
    tags: [],
    evidence_note: null,
    created_at: '2026-04-24T00:00:00Z',
    updated_at: '2026-04-24T00:00:00Z',
  },
]

const candidateProfile: CandidateProfile = {
  version: '1.0',
  configType: 'candidate_profile',
  candidateIdentity: {
    displayName: 'Ada Example',
    location: 'Remote',
    contact: {
      email: null,
      phone: null,
      linkedin: null,
      github: null,
    },
  },
  staticSections: {
    education: [
      {
        id: 'education-1',
        institution: 'Example University',
        credential: 'BS',
        signalTags: ['rust', 'orphan_profile'],
        fieldNotes: { major: null, minor: null },
      },
    ],
    certifications: [],
    profileSummarySeed: [],
  },
}

const markersByTag: Record<string, TagInferenceMarker[]> = {
  rust: [
    {
      id: 'marker-1',
      canonicalTag: 'rust',
      markerKind: 'literal',
      literalValue: 'Rust tooling',
      terms: [],
      createdAt: '2026-04-24T00:00:00Z',
    },
    {
      id: 'marker-2',
      canonicalTag: 'rust',
      markerKind: 'literal',
      literalValue: 'never observed marker',
      terms: [],
      createdAt: '2026-04-24T00:00:00Z',
    },
  ],
  kubernetes: [],
}

describe('buildTaxonomyDiagnostics', () => {
  it('computes coverage and orphaned tag diagnostics', () => {
    const diagnostics = buildTaxonomyDiagnostics({
      canonicalTags,
      records,
      evidence,
      candidateProfile,
      markersByTag,
      storedPostingText: 'We need Rust tooling experience.',
    })

    expect(diagnostics.tagsWithoutSupportingSources).toEqual(['kubernetes'])
    expect(diagnostics.tagsWithoutMarkers).toEqual(['kubernetes'])
    expect(diagnostics.tagsWithoutMetadata).toEqual(['kubernetes'])
    expect(diagnostics.markersWithoutLibraryHits).toEqual([
      { id: 'marker-2', tag: 'rust', label: 'never observed marker' },
    ])
    expect(diagnostics.storedPostingCoverage).toEqual({
      available: true,
      matchedTags: ['rust'],
      unmatchedTags: ['kubernetes'],
    })
    expect(diagnostics.evidenceWithoutTags).toEqual([
      { id: 'evidence-2', claim: 'Captured untagged work.' },
    ])
    expect(diagnostics.unknownEvidenceTags).toEqual(['orphan_evidence'])
    expect(diagnostics.unknownRecordContextTags).toEqual(['orphan_context'])
    expect(diagnostics.unknownCandidateProfileSignalTags).toEqual(['orphan_profile'])
    expect(taxonomyDiagnosticsIssueCount(diagnostics)).toBe(8)
  })

  it('returns clean diagnostics when all references are covered', () => {
    const diagnostics = buildTaxonomyDiagnostics({
      canonicalTags: [canonicalTags[0]],
      records: [{ ...records[0], context_tags: ['rust'] }],
      evidence: [{ ...evidence[0], tags: ['rust'] }],
      candidateProfile: {
        ...candidateProfile,
        staticSections: {
          ...candidateProfile.staticSections,
          education: [
            {
              ...candidateProfile.staticSections.education[0],
              signalTags: ['rust'],
            },
          ],
        },
      },
      markersByTag: { rust: [markersByTag.rust[0]] },
    })

    expect(taxonomyDiagnosticsIssueCount(diagnostics)).toBe(0)
  })

  it('treats education and certification inputs as supporting taxonomy coverage and marker hits', () => {
    const diagnostics = buildTaxonomyDiagnostics({
      canonicalTags: [
        canonicalTags[0],
        {
          id: 'tag-3',
          tag: 'aws',
          description: null,
          category: 'Technical Skills',
          display_label: 'AWS',
          created_at: '2026-04-24T00:00:00Z',
        },
      ],
      records: [],
      evidence: [],
      candidateProfile: {
        ...candidateProfile,
        staticSections: {
          ...candidateProfile.staticSections,
          education: [
            {
              ...candidateProfile.staticSections.education[0],
              credential: 'BS in Rust Tooling',
              signalTags: ['rust'],
            },
          ],
          certifications: [
            {
              id: 'cert-1',
              name: 'AWS Certified Developer',
              issuer: 'Amazon',
              credentialDetail: '',
              signalTags: ['aws'],
            },
          ],
        },
      },
      markersByTag: {
        rust: markersByTag.rust,
        aws: [
          {
            id: 'marker-aws-1',
            canonicalTag: 'aws',
            markerKind: 'literal',
            literalValue: 'AWS Certified Developer',
            terms: [],
            createdAt: '2026-04-24T00:00:00Z',
          },
        ],
      },
    })

    expect(diagnostics.tagsWithoutSupportingSources).toEqual([])
    expect(diagnostics.markersWithoutLibraryHits).toEqual([
      { id: 'marker-2', tag: 'rust', label: 'never observed marker' },
    ])
  })
})