import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  openMock,
  saveMock,
  runtimeSupportsMock,
  taxonomyServiceMock,
  libraryServiceMock,
  tagNormalizationServiceMock,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  openMock: vi.fn(),
  saveMock: vi.fn(),
  runtimeSupportsMock: vi.fn(),
  taxonomyServiceMock: {
    getCanonicalTags: vi.fn(),
    getDeliveryToolkitCategories: vi.fn(),
    getTagInferenceMarkers: vi.fn(),
    getLibraryTagSyncStatus: vi.fn(),
    deleteCanonicalTag: vi.fn(),
    replaceTagInferenceMarkers: vi.fn(),
    testMarkers: vi.fn(),
    renameDeliveryToolkitCategory: vi.fn(),
    createDeliveryToolkitCategory: vi.fn(),
    deleteDeliveryToolkitCategory: vi.fn(),
    importTaxonomy: vi.fn(),
    clearTaxonomy: vi.fn(),
    reInferLibraryTags: vi.fn(),
    exportTaxonomy: vi.fn(),
  },
  libraryServiceMock: {
    getRecords: vi.fn(),
    getAllEvidence: vi.fn(),
    getCandidateProfile: vi.fn(),
  },
  tagNormalizationServiceMock: {
    normalizeTag: vi.fn((value: string) => value.trim().toLowerCase()),
  },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openMock,
  save: saveMock,
}))

vi.mock('@/lib/runtime', () => ({
  runtimeSupports: runtimeSupportsMock,
}))

vi.mock('@/lib/service', () => ({
  taxonomyService: taxonomyServiceMock,
  libraryService: libraryServiceMock,
  tagNormalizationService: tagNormalizationServiceMock,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/components/taxonomy/TagInferenceMarkerEditor', () => ({
  default: () => <div data-testid="marker-editor" />,
}))

vi.mock('@/components/dialogs/AdoptTagDialog', () => ({
  default: ({
    open,
    term,
    onCreate,
  }: {
    open: boolean
    term: string | null
    onCreate: () => void
  }) =>
    open ? (
      <div data-testid="adopt-dialog">
        <div>{`adopt-dialog: ${term}`}</div>
        <button type="button" onClick={onCreate}>
          Create New Tag Instead
        </button>
      </div>
    ) : null,
}))

vi.mock('@/components/dialogs/TagDialog', () => ({
  default: ({
    open,
    draft,
    tag,
  }: {
    open: boolean
    draft?: { tagValue: string; displayLabel: string } | null
    tag?: { tag: string } | null
  }) =>
    open ? (
      <div data-testid="tag-dialog">
        <div>{`tag-dialog-draft: ${draft?.tagValue ?? 'none'}`}</div>
        <div>{`tag-dialog-label: ${draft?.displayLabel ?? 'none'}`}</div>
        <div>{`tag-dialog-editing: ${tag?.tag ?? 'none'}`}</div>
      </div>
    ) : null,
}))

import TaxonomyView from '@/components/views/TaxonomyView'

function mockTaxonomySurface() {
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
  taxonomyServiceMock.getDeliveryToolkitCategories.mockResolvedValue([
    {
      name: 'Technical Skills',
      sort_order: 0,
    },
  ])
  taxonomyServiceMock.getTagInferenceMarkers.mockImplementation((tag: string) =>
    Promise.resolve(
      tag === 'rust'
        ? [
            {
              id: 'marker-1',
              canonicalTag: 'rust',
              markerKind: 'literal',
              literalValue: 'Rust tooling',
              terms: [],
              createdAt: '2026-04-24T00:00:00Z',
            },
          ]
        : [],
    ),
  )
  taxonomyServiceMock.getLibraryTagSyncStatus.mockResolvedValue({
    requiresReinference: false,
    lastTaxonomyChangeAt: null,
    lastLibraryTagRefreshAt: null,
  })

  libraryServiceMock.getRecords.mockResolvedValue([
    {
      id: 'record-1',
      context_tags: ['rust'],
      organization: 'Example Corp',
      title: 'Platform Engineer',
      location: null,
      employment_type: null,
    },
  ])
  libraryServiceMock.getAllEvidence.mockResolvedValue([
    {
      id: 'evidence-1',
      claim: 'Built Rust tooling.',
      tags: ['rust'],
      date_range: null,
      evidence_note: null,
    },
  ])
  libraryServiceMock.getCandidateProfile.mockResolvedValue({
    staticSections: {
      education: [
        {
          id: 'education-1',
          institution: 'Example University',
          credential: 'BS',
          signalTags: ['orphan_profile'],
          fieldNotes: { major: null, minor: null },
        },
      ],
      certifications: [],
      profileSummarySeed: [],
    },
  })
}

describe('TaxonomyView diagnostics interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runtimeSupportsMock.mockReturnValue(false)
    mockTaxonomySurface()
  })

  it('routes unknown taxonomy diagnostics into the adopt-or-create flow', async () => {
    const user = userEvent.setup()

    render(<TaxonomyView />)

    await screen.findByText('Taxonomy Diagnostics')
    await user.click(screen.getByRole('button', { name: 'Resolve unknown tag orphan_profile' }))

    expect(screen.getByTestId('adopt-dialog')).toBeInTheDocument()
    expect(screen.getByText('adopt-dialog: orphan_profile')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create New Tag Instead' }))

    await waitFor(() => {
      expect(screen.getByTestId('tag-dialog')).toBeInTheDocument()
    })
    expect(screen.getByText('tag-dialog-draft: orphan_profile')).toBeInTheDocument()
    expect(screen.getByText('tag-dialog-label: Orphan Profile')).toBeInTheDocument()
    expect(screen.getByText('tag-dialog-editing: none')).toBeInTheDocument()
  })
})