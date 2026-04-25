import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ResumePipelineResult } from '@/lib/types'
import { ResumeEvidenceSources } from '@/components/resume/ResumeEvidenceSources'

function buildPipelineResult(): ResumePipelineResult {
  return {
    career_library_export: {
      export_type: 'career_library_extract',
      export_meta: {
        schema_version: '2.0',
        exported_at: '2026-04-24T00:00:00Z',
        taxonomy_version: '1.0',
        source_db_name: 'career.db',
      },
      experience_records: [
        {
          id: 'record-1',
          slug: 'example-platform-engineer',
          record_type: 'employment',
          organization: 'Example Corp',
          title: 'Platform Engineer',
          start_date: '2024-01',
          end_date: 'present',
          location: 'Remote',
          employment_type: 'Full-time',
          context_tags: ['platform_engineering'],
          canonical_scope_summary: null,
          common_context: null,
          created_at: '2026-04-24T00:00:00Z',
          updated_at: '2026-04-24T00:00:00Z',
          evidence: [
            {
              id: 'evidence-1',
              experience_record_id: 'record-1',
              claim: 'Built deterministic export tooling.',
              date_range: '2024',
              tags: ['automation', 'rust'],
              evidence_note: 'Used as resume source evidence.',
              created_at: '2026-04-24T00:00:00Z',
              updated_at: '2026-04-24T00:00:00Z',
            },
          ],
        },
      ],
    },
    preflight_result: {
      career_library_export: {
        export_type: 'career_library_extract',
        export_meta: {
          schema_version: '2.0',
          exported_at: '2026-04-24T00:00:00Z',
          taxonomy_version: '1.0',
          source_db_name: 'career.db',
        },
        experience_records: [],
      },
      preflight_report: {
        threshold: 0.5,
        fallback_min_records: 3,
        kept_counts: { records: 1, evidence: 1 },
        dropped_counts: { records: 0, evidence: 0 },
        decision_log: [],
      },
    },
  } as unknown as ResumePipelineResult
}

describe('ResumeEvidenceSources', () => {
  it('renders source record and evidence details for mapped ids', () => {
    render(<ResumeEvidenceSources result={buildPipelineResult()} evidenceIds={['evidence-1']} />)

    expect(screen.getByText('Sources (1)')).toBeInTheDocument()
    expect(screen.getByText('Platform Engineer')).toBeInTheDocument()
    expect(screen.getByText('Example Corp')).toBeInTheDocument()
    expect(screen.getByText('example-platform-engineer')).toBeInTheDocument()
    expect(screen.getByText('Built deterministic export tooling.')).toBeInTheDocument()
    expect(screen.getByText('Date range: 2024')).toBeInTheDocument()
    expect(screen.getByText('automation')).toBeInTheDocument()
    expect(screen.getByText('rust')).toBeInTheDocument()
    expect(screen.getByText('Used as resume source evidence.')).toBeInTheDocument()
  })

  it('reports source ids that are no longer present in the pipeline payload', () => {
    render(<ResumeEvidenceSources result={buildPipelineResult()} evidenceIds={['missing-evidence']} />)

    expect(screen.getByText('Sources (0 mapped, 1 missing)')).toBeInTheDocument()
    expect(screen.getByText('Missing source evidence ids: missing-evidence')).toBeInTheDocument()
  })

  it('renders nothing for claims without evidence ids', () => {
    const { container } = render(
      <ResumeEvidenceSources result={buildPipelineResult()} evidenceIds={[]} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})