import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ResumeAssemblyAuditPanel, ResumeGapReportPanel } from '@/components/resume/ResumeAuditPanels'
import type { GapReport } from '@/lib/types'

const gapReport: GapReport = {
  supported_requirements: [
    {
      requirement: 'Build deterministic export tooling',
      supporting_sources: [{ source_type: 'evidence', source_id: 'evidence-1' }],
    },
  ],
  partially_supported_requirements: [
    {
      requirement: 'Lead cross-functional rollout',
      supporting_sources: [{ source_type: 'certification', source_id: 'cert-1' }],
      limitation: 'Selected source only overlaps general delivery tags.',
    },
  ],
  unsupported_requirements: [
    {
      requirement: 'Operate Kubernetes at scale',
      reason: 'No selected source overlaps the requirement terms or tags.',
    },
  ],
  compensation_strategy: [
    'Keep unsupported requirements explicit instead of inferring support.',
  ],
  risk_flags: ['One or more must-have requirements remain unsupported.'],
}

describe('ResumeGapReportPanel', () => {
  it('renders supported, partial, unsupported, risk, and compensation details', () => {
    render(<ResumeGapReportPanel gapReport={gapReport} />)

    expect(screen.getByText('Gap Report')).toBeInTheDocument()
    expect(screen.getByText('1 supported')).toBeInTheDocument()
    expect(screen.getByText('1 partial')).toBeInTheDocument()
    expect(screen.getByText('1 unsupported')).toBeInTheDocument()
    expect(screen.getByText('One or more must-have requirements remain unsupported.')).toBeInTheDocument()
    expect(screen.getByText('Build deterministic export tooling')).toBeInTheDocument()
    expect(screen.getByText('evidence: evidence-1')).toBeInTheDocument()
    expect(screen.getByText('Lead cross-functional rollout')).toBeInTheDocument()
    expect(screen.getByText('Selected source only overlaps general delivery tags.')).toBeInTheDocument()
    expect(screen.getByText('certification: cert-1')).toBeInTheDocument()
    expect(screen.getByText('Operate Kubernetes at scale')).toBeInTheDocument()
    expect(screen.getByText('No selected source overlaps the requirement terms or tags.')).toBeInTheDocument()
    expect(screen.getByText('Keep unsupported requirements explicit instead of inferring support.')).toBeInTheDocument()
  })

  it('renders empty states when a gap bucket has no entries', () => {
    render(
      <ResumeGapReportPanel
        gapReport={{
          supported_requirements: [],
          partially_supported_requirements: [],
          unsupported_requirements: [],
          compensation_strategy: [],
          risk_flags: [],
        }}
      />,
    )

    expect(screen.getByText('No fully supported requirements reported.')).toBeInTheDocument()
    expect(screen.getByText('No partially supported requirements reported.')).toBeInTheDocument()
    expect(screen.getByText('No unsupported requirements reported.')).toBeInTheDocument()
  })
})

describe('ResumeAssemblyAuditPanel', () => {
  it('renders constraint flags and assembly notes', () => {
    render(
      <ResumeAssemblyAuditPanel
        constraintFlags={[
          {
            rule: 'normalization_only_claim_projection',
            status: 'passed',
            note: 'Rendered claims preserve source wording.',
          },
          {
            rule: 'unsupported_must_have',
            status: 'warning',
            note: 'One must-have requirement remains unsupported.',
          },
        ]}
        notes={['Highlights and profile never paraphrase evidence claims.']}
      />,
    )

    expect(screen.getByText('Assembly Audit')).toBeInTheDocument()
    expect(screen.getByText('normalization_only_claim_projection')).toBeInTheDocument()
    expect(screen.getByText('Rendered claims preserve source wording.')).toBeInTheDocument()
    expect(screen.getByText('unsupported_must_have')).toBeInTheDocument()
    expect(screen.getByText('One must-have requirement remains unsupported.')).toBeInTheDocument()
    expect(screen.getByText('Highlights and profile never paraphrase evidence claims.')).toBeInTheDocument()
  })

  it('renders nothing when no audit details exist', () => {
    const { container } = render(<ResumeAssemblyAuditPanel constraintFlags={[]} notes={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})