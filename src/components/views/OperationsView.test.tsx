import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { operationsServiceMock, libraryServiceMock, toastSuccess, toastError } = vi.hoisted(() => ({
  operationsServiceMock: {
    getAnomalies: vi.fn(),
    getGenerationManifests: vi.fn(),
    resolveAnomaly: vi.fn(),
    reopenAnomaly: vi.fn(),
    deleteAnomaly: vi.fn(),
    deleteGenerationManifest: vi.fn(),
    updateManifestNotes: vi.fn(),
  },
  libraryServiceMock: {
    getRecord: vi.fn(),
    getEvidence: vi.fn(),
  },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/lib/service', () => ({
  operationsService: operationsServiceMock,
  libraryService: libraryServiceMock,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

import OperationsView from '@/components/views/OperationsView'

describe('OperationsView manifest detail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    operationsServiceMock.getAnomalies.mockResolvedValue([])
    operationsServiceMock.getGenerationManifests.mockResolvedValue([
      {
        id: 'manifest-1',
        createdAt: '2026-04-29T10:00:00Z',
        artifactKind: 'assembled_resume',
        targetRoleFamily: 'platform engineering',
        jobPostingPath: null,
        jobPostingSha256: 'job-sha',
        buildPolicyPath: 'db://resume_build_policy_settings',
        buildPolicySha256: 'policy-sha',
        candidateProfilePath: null,
        candidateProfileSha256: 'candidate-sha',
        libraryExportPath: null,
        libraryExportSha256: 'library-sha',
        selectedRecordIds: ['record-1', 'record-2'],
        selectedEvidenceIds: ['evidence-1'],
        gapReport: {
          supported_requirements: [
            {
              requirement: 'Build deterministic export tooling',
              supporting_sources: [{ source_type: 'evidence', source_id: 'evidence-1' }],
            },
          ],
          partially_supported_requirements: [],
          unsupported_requirements: [],
          compensation_strategy: [],
          risk_flags: [],
        },
        artifactPaths: {
          assembled_json: 'C:/tmp/resume_assembled.json',
          rendered_docx: 'C:/tmp/resume.docx',
        },
        artifactHashes: {
          assembled_json: '1234567890abcdef1234567890abcdef',
        },
        requirementReview: {
          source_job_posting_sha256: 'job-sha',
          reviewed_cluster_ids: ['cluster-1'],
          excluded_cluster_ids: ['cluster-2'],
          excluded_atom_ids: ['atom-3'],
          useful_terms: ['platform engineering'],
          noise_terms: ['you'],
        },
        notes: 'Reviewed after interview prep.',
      },
    ])
  })

  it('renders native manifest audit sections instead of raw JSON blocks', async () => {
    const user = userEvent.setup()

    render(<OperationsView />)

    await user.click(screen.getByRole('tab', { name: 'Generation Manifests' }))
    await screen.findByText('Manifest Detail')

    expect(screen.getByText('Selected Records')).toBeInTheDocument()
    expect(screen.getByText('record-1')).toBeInTheDocument()
    expect(screen.getByText('record-2')).toBeInTheDocument()
    expect(screen.getByText('Selected Evidence')).toBeInTheDocument()
    expect(screen.getByText('evidence-1')).toBeInTheDocument()
    expect(screen.getByText('Artifact Outputs')).toBeInTheDocument()
    expect(screen.getByText('Assembled JSON')).toBeInTheDocument()
    expect(screen.getByText('C:/tmp/resume_assembled.json')).toBeInTheDocument()
    expect(screen.getByText('Requirement Review')).toBeInTheDocument()
    expect(screen.getByText('Useful Terms')).toBeInTheDocument()
    expect(screen.getAllByText('platform engineering').length).toBeGreaterThan(0)
    expect(screen.getByText('Noise Terms')).toBeInTheDocument()
    expect(screen.getByText('you')).toBeInTheDocument()
    expect(screen.getByText('Gap Report')).toBeInTheDocument()
    expect(screen.getByText('Build deterministic export tooling')).toBeInTheDocument()
    expect(screen.queryByText(/\["record-1",\s*"record-2"\]/)).not.toBeInTheDocument()
  })
})