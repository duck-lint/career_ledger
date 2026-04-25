import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { libraryServiceMock, operationsServiceMock, taxonomyServiceMock, appRuntimeMock } = vi.hoisted(() => ({
  libraryServiceMock: {
    getRecords: vi.fn(),
    getAllEvidence: vi.fn(),
    getCandidateProfile: vi.fn(),
  },
  operationsServiceMock: {
    getAnomalies: vi.fn(),
    getGenerationManifests: vi.fn(),
  },
  taxonomyServiceMock: {
    getDeliveryToolkitCategories: vi.fn(),
    getCanonicalTags: vi.fn(),
    getTagInferenceMarkers: vi.fn(),
    getLibraryTagSyncStatus: vi.fn(),
  },
  appRuntimeMock: {
    isTauri: true,
  },
}))

vi.mock('@/lib/service', () => ({
  libraryService: libraryServiceMock,
  operationsService: operationsServiceMock,
  taxonomyService: taxonomyServiceMock,
}))

vi.mock('@/lib/runtime', () => ({
  appRuntime: appRuntimeMock,
}))

import { ReadinessDashboard } from '@/components/ReadinessDashboard'

function mockReadinessState({
  categoryCount = 1,
  tagCount = 1,
  recordCount = 1,
  evidenceCount = 1,
  hasCandidateProfile = true,
  requiresReinference = false,
  openAnomalyCount = 0,
  manifestCount = 1,
} = {}) {
  taxonomyServiceMock.getDeliveryToolkitCategories.mockResolvedValue(
    Array.from({ length: categoryCount }, (_, index) => ({
      name: `Category ${index + 1}`,
      sort_order: index,
    })),
  )
  taxonomyServiceMock.getCanonicalTags.mockResolvedValue(
    Array.from({ length: tagCount }, (_, index) => ({
      id: `tag-${index + 1}`,
      tag: `tag_${index + 1}`,
      description: null,
      category: 'Category 1',
      display_label: `Tag ${index + 1}`,
      created_at: '2026-04-24T00:00:00Z',
    })),
  )
  taxonomyServiceMock.getLibraryTagSyncStatus.mockResolvedValue({
    requiresReinference,
    lastTaxonomyChangeAt: '2026-04-24T00:00:00Z',
    lastLibraryTagRefreshAt: '2026-04-24T00:00:00Z',
  })
  libraryServiceMock.getRecords.mockResolvedValue(
    Array.from({ length: recordCount }, (_, index) => ({
      id: `record-${index + 1}`,
      organization: 'Example Corp',
      title: `Tag ${index + 1} role`,
      location: null,
      employment_type: null,
      context_tags: [`tag_${index + 1}`],
    })),
  )
  libraryServiceMock.getAllEvidence.mockResolvedValue(
    Array.from({ length: evidenceCount }, (_, index) => ({
      id: `evidence-${index + 1}`,
      claim: `Worked with tag ${index + 1}`,
      date_range: null,
      evidence_note: null,
      tags: [`tag_${index + 1}`],
    })),
  )
  libraryServiceMock.getCandidateProfile.mockResolvedValue(
    hasCandidateProfile ? {
      version: '1.0',
      staticSections: {
        education: [],
        certifications: [],
      },
    } : undefined,
  )
  taxonomyServiceMock.getTagInferenceMarkers.mockImplementation((tag: string) => Promise.resolve([
    {
      id: `marker-${tag}`,
      canonicalTag: tag,
      markerKind: 'literal',
      literalValue: tag.replace(/_/g, ' '),
      terms: [],
      createdAt: '2026-04-24T00:00:00Z',
    },
  ]))
  operationsServiceMock.getAnomalies.mockResolvedValue(
    Array.from({ length: openAnomalyCount }, (_, index) => ({
      id: `anomaly-${index + 1}`,
      resolvedAt: null,
    })),
  )
  operationsServiceMock.getGenerationManifests.mockResolvedValue(
    Array.from({ length: manifestCount }, (_, index) => ({
      id: `manifest-${index + 1}`,
    })),
  )
}

describe('ReadinessDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    appRuntimeMock.isTauri = true
  })

  it('shows blockers for an empty first-run state', async () => {
    mockReadinessState({
      categoryCount: 0,
      tagCount: 0,
      recordCount: 0,
      evidenceCount: 0,
      hasCandidateProfile: false,
      manifestCount: 0,
    })

    render(<ReadinessDashboard onNavigate={vi.fn()} />)

    await screen.findByText('Setup needed')
    expect(screen.getByText('Create or import taxonomy')).toBeInTheDocument()
    expect(screen.getByText('Add experience records')).toBeInTheDocument()
    expect(screen.getByText('Add evidence claims')).toBeInTheDocument()
    expect(screen.getByText('Save candidate profile')).toBeInTheDocument()
  })

  it('shows ready state when core inputs are present and warnings are clear', async () => {
    mockReadinessState()

    render(<ReadinessDashboard onNavigate={vi.fn()} />)

    await screen.findByText('Ready to generate')
    expect(screen.getByText('Taxonomy exists')).toBeInTheDocument()
    expect(screen.getByText('Career records exist')).toBeInTheDocument()
    expect(screen.getByText('Evidence library has claims')).toBeInTheDocument()
    expect(screen.getByText('Candidate profile saved')).toBeInTheDocument()
    expect(screen.getByText('Taxonomy diagnostics clear')).toBeInTheDocument()
    expect(screen.getByText('No open anomalies')).toBeInTheDocument()
  })

  it('mixes ready and blocker items for a partial library state', async () => {
    mockReadinessState({
      evidenceCount: 0,
      manifestCount: 0,
    })

    render(<ReadinessDashboard onNavigate={vi.fn()} />)

    await screen.findByText('Setup needed')
    expect(screen.getByText('Taxonomy exists')).toBeInTheDocument()
    expect(screen.getByText('Career records exist')).toBeInTheDocument()
    expect(screen.getByText('Add evidence claims')).toBeInTheDocument()
    expect(screen.getByText('No resume run recorded yet')).toBeInTheDocument()
  })

  it('surfaces taxonomy diagnostics in readiness', async () => {
    mockReadinessState()
    taxonomyServiceMock.getTagInferenceMarkers.mockResolvedValue([])

    render(<ReadinessDashboard onNavigate={vi.fn()} />)

    await screen.findByText('Review recommended')
    expect(screen.getByText('Review taxonomy diagnostics')).toBeInTheDocument()
    expect(screen.getByText('1 taxonomy diagnostic may affect matching confidence or repair loops.')).toBeInTheDocument()
  })

  it('surfaces warning state for stale tags and open anomalies', async () => {
    mockReadinessState({ requiresReinference: true, openAnomalyCount: 2 })

    render(<ReadinessDashboard onNavigate={vi.fn()} />)

    await screen.findByText('Review recommended')
    expect(screen.getByText('Re-infer library tags')).toBeInTheDocument()
    expect(screen.getByText('Review open anomalies')).toBeInTheDocument()
    expect(screen.getByText('2 open anomalies may indicate import or assembly data quality issues.')).toBeInTheDocument()
  })

  it('navigates through item actions', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    mockReadinessState({ categoryCount: 0, tagCount: 0 })

    render(<ReadinessDashboard onNavigate={onNavigate} />)

    await screen.findByText('Setup needed')
    await user.click(screen.getAllByRole('button', { name: 'Open Taxonomy' })[0])

    expect(onNavigate).toHaveBeenCalledWith('taxonomy')
  })

  it('makes browser harness limitations visible', async () => {
    appRuntimeMock.isTauri = false
    mockReadinessState()

    render(<ReadinessDashboard onNavigate={vi.fn()} />)

    await screen.findByText('Ready to generate')
    expect(screen.getByText('Browser harness')).toBeInTheDocument()
    expect(
      screen.getByText(/Browser mode is a frontend harness/),
    ).toBeInTheDocument()
  })

  it('refreshes readiness data on demand', async () => {
    const user = userEvent.setup()
    mockReadinessState()

    render(<ReadinessDashboard onNavigate={vi.fn()} />)

    await screen.findByText('Ready to generate')
    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => {
      expect(taxonomyServiceMock.getCanonicalTags).toHaveBeenCalledTimes(2)
    })
  })
})