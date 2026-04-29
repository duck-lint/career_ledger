import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BuildPolicy, GenerationManifest, RequirementAnalysis, ResumePipelineResult } from '@/lib/types'

const {
  openMock,
  runtimeSupportsMock,
  operationsServiceMock,
  pipelineServiceMock,
  tagNormalizationServiceMock,
  getStoredArtifactOutputDirMock,
  setStoredArtifactOutputDirMock,
  getStoredJobPostingTextMock,
  setStoredJobPostingTextMock,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  openMock: vi.fn(),
  runtimeSupportsMock: vi.fn(),
  operationsServiceMock: {
    getGenerationManifests: vi.fn(),
    getAnomalies: vi.fn(),
  },
  pipelineServiceMock: {
    getBuildPolicy: vi.fn(),
    buildRequirementAnalysis: vi.fn(),
    getRequirementReviewNoiseTerms: vi.fn(),
    runResumePipeline: vi.fn(),
    saveBuildPolicy: vi.fn(),
    saveRequirementReviewNoiseTerms: vi.fn(),
  },
  tagNormalizationServiceMock: {
    normalizeTag: vi.fn((value: string) => value),
  },
  getStoredArtifactOutputDirMock: vi.fn(),
  setStoredArtifactOutputDirMock: vi.fn(),
  getStoredJobPostingTextMock: vi.fn(),
  setStoredJobPostingTextMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openMock,
}))

vi.mock('@/lib/runtime', () => ({
  runtimeSupports: runtimeSupportsMock,
}))

vi.mock('@/lib/service', () => ({
  operationsService: operationsServiceMock,
  pipelineService: pipelineServiceMock,
  tagNormalizationService: tagNormalizationServiceMock,
}))

vi.mock('@/lib/runtime-settings', () => ({
  getStoredArtifactOutputDir: getStoredArtifactOutputDirMock,
  setStoredArtifactOutputDir: setStoredArtifactOutputDirMock,
  getStoredJobPostingText: getStoredJobPostingTextMock,
  setStoredJobPostingText: setStoredJobPostingTextMock,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/components/dialogs/AdoptTagDialog', () => ({
  default: () => null,
}))

vi.mock('@/components/dialogs/TagDialog', () => ({
  default: () => null,
}))

vi.mock('@/components/ProgressSteps', () => ({
  ProgressSteps: () => <div data-testid="progress-steps" />,
}))

vi.mock('@/components/resume/RequirementAnalysisReviewPanel', () => ({
  RequirementAnalysisReviewPanel: () => <div data-testid="requirement-review-panel" />,
}))

vi.mock('@/components/resume/ResumeAuditPanels', () => ({
  ResumeAssemblyAuditPanel: () => <div data-testid="resume-assembly-audit" />,
  ResumeGapReportPanel: () => <div data-testid="resume-gap-report" />,
}))

vi.mock('@/components/resume/ResumeEvidenceSources', () => ({
  ResumeEvidenceSources: () => <div data-testid="resume-evidence-sources" />,
}))

import ResumeGenerationView from '@/components/views/ResumeGenerationView'

const buildPolicy: BuildPolicy = {
  policy_type: 'resume_build_policy',
  preflight: {
    threshold: 0.5,
    fallback_min_records: 3,
  },
  include_projects: true,
  max_bullets_per_role: 7,
  max_project_bullets: 6,
  max_projects: 6,
  assembler_strategy: {
    max_highlights: 6,
    bullet_max_chars: 280,
    highlight_max_chars: 280,
    profile_max_chars: 420,
    coverage_first_highlights: true,
    coverage_first_profile_tiebreak: true,
    tag_weight: 0.875,
    density_weight: 0.125,
    allow_multi_evidence_sections: ['highlights', 'profile'],
  },
}

const analysis: RequirementAnalysis = {
  analysis_version: '1.1',
  source: {
    job_posting_sha256: 'posting-sha',
    job_posting_length: 42,
    target_role_family: 'platform engineering',
    posting_keyword_bank: [],
    unrecognized_notable_terms: [],
    extraction_method: 'posting_surface_terms_v1',
  },
  clusters: [],
  atoms: [],
}

function buildManifest(overrides: Partial<GenerationManifest>): GenerationManifest {
  return {
    id: 'manifest-current',
    createdAt: '2026-04-29T09:30:00Z',
    artifactKind: 'assembled_resume',
    targetRoleFamily: 'platform engineering',
    jobPostingPath: null,
    jobPostingSha256: 'posting-sha',
    buildPolicyPath: 'db://resume_build_policy_settings',
    buildPolicySha256: 'policy-sha',
    candidateProfilePath: null,
    candidateProfileSha256: 'candidate-sha',
    libraryExportPath: null,
    libraryExportSha256: 'library-sha',
    selectedRecordIds: ['record-1', 'record-2'],
    selectedEvidenceIds: ['evidence-1', 'evidence-2', 'evidence-3'],
    gapReport: {
      supported_requirements: [],
      partially_supported_requirements: [],
      unsupported_requirements: [],
      compensation_strategy: [],
      risk_flags: [],
    },
    artifactPaths: null,
    artifactHashes: null,
    requirementReview: {
      source_job_posting_sha256: 'posting-sha',
      reviewed_cluster_ids: [],
      excluded_cluster_ids: [],
      excluded_atom_ids: [],
      useful_terms: [],
      noise_terms: [],
    },
    notes: 'Reviewed after pipeline run.',
    ...overrides,
  }
}

function buildPipelineResult(generationManifest: GenerationManifest): ResumePipelineResult {
  return {
    career_library_export: {
      source_db_name: 'career.db',
      exported_at: '2026-04-29T09:30:00Z',
      experience_records: [],
    },
    requirement_analysis: analysis,
    preflight_result: {
      career_library_export: {
        source_db_name: 'career.db',
        exported_at: '2026-04-29T09:30:00Z',
        experience_records: [],
      },
      preflight_report: {
        threshold: 0.5,
        fallback_min_records: 3,
        kept_counts: { records: 2, evidence: 3 },
        dropped_counts: { records: 0, evidence: 0 },
        decision_log: [],
      },
    },
    bundle: {} as ResumePipelineResult['bundle'],
    assembly_result: {
      artifact: {
        resume: {
          header: {
            display_name: 'Example Operator',
            location: 'Remote',
            email: 'operator@example.com',
            phone: '',
            linkedin: '',
            github: '',
          },
          target_role_family: 'platform engineering',
          highlights: [],
          profile: null,
          professional_experience: [],
          projects: [],
          education: [],
          certifications: [],
          toolkit: null,
        },
        gap_report: {
          supported_requirements: [],
          partially_supported_requirements: [],
          unsupported_requirements: [],
          compensation_strategy: [],
          risk_flags: [],
        },
        provenance: {
          target_role_family: 'platform engineering',
          selected_record_ids: generationManifest.selectedRecordIds ?? [],
          selected_evidence_ids: generationManifest.selectedEvidenceIds ?? [],
          claim_to_evidence_map: [],
          constraint_flags: [],
          notes: [],
        },
      },
      selected_record_ids: generationManifest.selectedRecordIds ?? [],
      selected_evidence_ids: generationManifest.selectedEvidenceIds ?? [],
      claim_to_evidence_map: [],
      constraint_flags: [],
      notes: [],
    },
    generated_artifacts: null,
    generation_manifest: generationManifest,
    requirement_review: generationManifest.requirementReview,
  }
}

describe('ResumeGenerationView manifest summaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    runtimeSupportsMock.mockReturnValue(true)
    getStoredArtifactOutputDirMock.mockReturnValue('')
    getStoredJobPostingTextMock.mockReturnValue('')
    pipelineServiceMock.getBuildPolicy.mockResolvedValue(buildPolicy)
    pipelineServiceMock.buildRequirementAnalysis.mockResolvedValue(analysis)
    pipelineServiceMock.getRequirementReviewNoiseTerms.mockResolvedValue([])
    pipelineServiceMock.saveRequirementReviewNoiseTerms.mockResolvedValue([])
  })

  it('renders current-run and recent-manifest selection counts from typed manifest fields', async () => {
    const user = userEvent.setup()
    const currentManifest = buildManifest({
      id: 'manifest-current',
      createdAt: '2026-04-29T10:00:00Z',
      selectedRecordIds: ['record-1', 'record-2'],
      selectedEvidenceIds: ['evidence-1', 'evidence-2', 'evidence-3'],
    })
    const olderManifest = buildManifest({
      id: 'manifest-older',
      createdAt: '2026-04-28T10:00:00Z',
      targetRoleFamily: 'business analysis',
      selectedRecordIds: ['record-legacy'],
      selectedEvidenceIds: ['evidence-legacy'],
      notes: 'Earlier run',
    })
    const pipelineResult = buildPipelineResult(currentManifest)

    operationsServiceMock.getGenerationManifests
      .mockResolvedValueOnce([olderManifest])
      .mockResolvedValueOnce([currentManifest, olderManifest])
    operationsServiceMock.getAnomalies
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    pipelineServiceMock.runResumePipeline.mockResolvedValue(pipelineResult)

    render(<ResumeGenerationView />)

    await screen.findByLabelText('Job posting text')

    await user.type(
      screen.getByLabelText('Job posting text'),
      'Need platform engineering leadership and deterministic delivery.',
    )
    await user.click(screen.getByRole('button', { name: 'Generate Resume' }))

    await waitFor(() => {
      expect(pipelineServiceMock.runResumePipeline).toHaveBeenCalledTimes(1)
    })

    await user.click(screen.getByRole('tab', { name: 'Pipeline' }))

    const currentRunCard = screen.getByText('Current Run Manifest').closest('[data-slot="card"]')
    const recentManifestsCard = screen.getByText('Recent Manifests').closest('[data-slot="card"]')

    expect(currentRunCard).not.toBeNull()
    expect(recentManifestsCard).not.toBeNull()

    const currentRunScope = within(currentRunCard as HTMLElement)
    const recentManifestsScope = within(recentManifestsCard as HTMLElement)

    await waitFor(() => {
      expect(
        currentRunScope.getByText((_, node) => node?.textContent === 'Selected records: 2'),
      ).toBeInTheDocument()
    })

    expect(
      currentRunScope.getByText((_, node) => node?.textContent === 'Selected records: 2'),
    ).toBeInTheDocument()
    expect(
      currentRunScope.getByText((_, node) => node?.textContent === 'Selected evidence: 3'),
    ).toBeInTheDocument()

    expect(
      recentManifestsScope.getByText((_, node) => node?.textContent === 'Records: 2'),
    ).toBeInTheDocument()
    expect(
      recentManifestsScope.getByText((_, node) => node?.textContent === 'Evidence: 3'),
    ).toBeInTheDocument()
    expect(
      recentManifestsScope.getByText((_, node) => node?.textContent === 'Records: 1'),
    ).toBeInTheDocument()
    expect(
      recentManifestsScope.getByText((_, node) => node?.textContent === 'Evidence: 1'),
    ).toBeInTheDocument()
    expect(setStoredJobPostingTextMock).toHaveBeenCalledWith(
      'Need platform engineering leadership and deterministic delivery.',
    )
    expect(toastSuccess).toHaveBeenCalledWith('Resume pipeline completed')
    expect(toastError).not.toHaveBeenCalled()
  })
})