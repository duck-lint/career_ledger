import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { libraryServiceMock, taxonomyServiceMock } = vi.hoisted(() => ({
  libraryServiceMock: {
    getRecords: vi.fn(),
    getAllEvidence: vi.fn(),
    getCandidateProfile: vi.fn(),
  },
  taxonomyServiceMock: {
    getCanonicalTags: vi.fn(),
    getTagInferenceMarkers: vi.fn(),
  },
}))

vi.mock('@/lib/service', () => ({
  libraryService: libraryServiceMock,
  taxonomyService: taxonomyServiceMock,
}))

import { TaxonomyDiagnosticsPanel } from '@/components/taxonomy/TaxonomyDiagnosticsPanel'

function mockDiagnosticState() {
  taxonomyServiceMock.getCanonicalTags.mockResolvedValue([
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
  ])
  taxonomyServiceMock.getTagInferenceMarkers.mockImplementation((tag: string) =>
    Promise.resolve(tag === 'rust' ? [
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
        literalValue: 'unobserved phrase',
        terms: [],
        createdAt: '2026-04-24T00:00:00Z',
      },
    ] : []),
  )
  libraryServiceMock.getRecords.mockResolvedValue([
    {
      id: 'record-1',
      context_tags: ['rust', 'orphan_context'],
    },
  ])
  libraryServiceMock.getAllEvidence.mockResolvedValue([
    {
      id: 'evidence-1',
      claim: 'Built Rust tooling.',
      tags: ['rust', 'orphan_evidence'],
    },
    {
      id: 'evidence-2',
      claim: 'Captured untagged work.',
      tags: [],
    },
  ])
  libraryServiceMock.getCandidateProfile.mockResolvedValue({
    staticSections: {
      education: [{ signalTags: ['orphan_profile'] }],
      certifications: [],
    },
  })
}

describe('TaxonomyDiagnosticsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders taxonomy diagnostics from existing services', async () => {
    mockDiagnosticState()
    localStorage.setItem('career-ledger-job-posting-text', 'Posting asks for Rust tooling experience.')

    render(<TaxonomyDiagnosticsPanel />)

    await screen.findByText('Taxonomy Diagnostics')
    await screen.findAllByText('8 issues')
    expect(screen.getByText('Tags With No Evidence')).toBeInTheDocument()
    expect(screen.getByText('Markers With No Library Hits')).toBeInTheDocument()
    expect(screen.getAllByText('kubernetes').length).toBeGreaterThan(0)
    expect(screen.getByText('unobserved phrase')).toBeInTheDocument()
    expect(screen.getByText('Captured untagged work.')).toBeInTheDocument()
    expect(screen.getByText('orphan_evidence')).toBeInTheDocument()
    expect(screen.getByText('orphan_context')).toBeInTheDocument()
    expect(screen.getByText('orphan_profile')).toBeInTheDocument()
  })

  it('refreshes diagnostics on demand', async () => {
    const user = userEvent.setup()
    mockDiagnosticState()

    render(<TaxonomyDiagnosticsPanel />)

    await screen.findAllByText('8 issues')
    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => {
      expect(taxonomyServiceMock.getCanonicalTags).toHaveBeenCalledTimes(2)
    })
  })

  it('shows a clean state when no diagnostics are found', async () => {
    taxonomyServiceMock.getCanonicalTags.mockResolvedValue([
      {
        id: 'tag-1',
        tag: 'rust',
        description: null,
        category: 'Technical Skills',
        display_label: 'Rust',
        created_at: '2026-04-24T00:00:00Z',
      },
    ])
    taxonomyServiceMock.getTagInferenceMarkers.mockResolvedValue([{ id: 'marker-1' }])
    libraryServiceMock.getRecords.mockResolvedValue([{ id: 'record-1', context_tags: ['rust'] }])
    libraryServiceMock.getAllEvidence.mockResolvedValue([
      { id: 'evidence-1', claim: 'Built Rust tooling.', tags: ['rust'] },
    ])
    libraryServiceMock.getCandidateProfile.mockResolvedValue(undefined)

    render(<TaxonomyDiagnosticsPanel />)

    expect(await screen.findByText('No issues found')).toBeInTheDocument()
    expect(screen.getByText('Every canonical tag appears on at least one evidence item.')).toBeInTheDocument()
  })

  it('uses diagnostic action hooks for repair paths', async () => {
    const user = userEvent.setup()
    const onSelectMarkerTag = vi.fn()
    const onReviewTags = vi.fn()
    mockDiagnosticState()

    render(<TaxonomyDiagnosticsPanel onSelectMarkerTag={onSelectMarkerTag} onReviewTags={onReviewTags} />)

    await screen.findAllByText('8 issues')
    await user.click(screen.getAllByRole('button', { name: 'Edit first' })[0])
    await user.click(screen.getByRole('button', { name: 'Review tags' }))

    expect(onSelectMarkerTag).toHaveBeenCalledWith('kubernetes')
    expect(onReviewTags).toHaveBeenCalled()
  })
})