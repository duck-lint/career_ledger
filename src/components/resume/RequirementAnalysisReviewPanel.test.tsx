import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RequirementAnalysisReviewPanel } from '@/components/resume/RequirementAnalysisReviewPanel'
import type { RequirementAnalysis } from '@/lib/types'

const analysis: RequirementAnalysis = {
  analysis_version: '1.1',
  source: {
    job_posting_sha256: 'abc123',
    job_posting_length: 1200,
    target_role_family: 'platform engineering',
    posting_keyword_bank: ['rust', 'kubernetes'],
    unrecognized_notable_terms: [{ term: 'developer experience', count: 3 }],
    extraction_method: 'posting_surface_terms_v1',
  },
  clusters: [
    {
      cluster_id: 'cluster-1',
      label: 'Platform tooling',
      kind: 'must_have',
      priority_rank: 1,
      atom_ids: ['atom-1', 'atom-2'],
      matched_tags: ['rust'],
    },
  ],
  atoms: [
    {
      requirement_id: 'atom-1',
      cluster_id: 'cluster-1',
      text: 'Build Rust developer tooling for platform teams.',
      kind: 'must_have',
      priority_rank: 1,
      source_order: 1,
      normalized_terms: [
        { term: 'rust', is_negated: false },
        { term: 'developer experience', is_negated: false },
      ],
      matched_tags: ['rust'],
      experience_years: { min_years: 4 },
      has_quantifier: true,
      subject: 'platform tooling',
    },
    {
      requirement_id: 'atom-2',
      cluster_id: 'cluster-1',
      text: 'No legacy waterfall delivery required.',
      kind: 'nice_to_have',
      priority_rank: 4,
      source_order: 2,
      normalized_terms: [{ term: 'waterfall', is_negated: true }],
      matched_tags: [],
      experience_years: null,
      has_quantifier: false,
      subject: null,
    },
  ],
}

describe('RequirementAnalysisReviewPanel', () => {
  it('renders local extraction framing and extracted requirement details', () => {
    render(
      <RequirementAnalysisReviewPanel
        analysis={analysis}
        suggestedTermsByCluster={new Map([['cluster-1', ['developer experience']]])}
        onSuggestedTermClick={vi.fn()}
      />,
    )

    expect(screen.getByText('Requirement Review')).toBeInTheDocument()
    expect(screen.getByText(/local surface-term extraction and taxonomy matching/i)).toBeInTheDocument()
    expect(screen.getByText(/flow into generation for this run/i)).toBeInTheDocument()
    expect(screen.getByText('Platform tooling')).toBeInTheDocument()
    expect(screen.getByText('Build Rust developer tooling for platform teams.')).toBeInTheDocument()
    expect(screen.getByText('No legacy waterfall delivery required.')).toBeInTheDocument()
    expect(screen.getByText('waterfall')).toBeInTheDocument()
    expect(screen.getByText('4+ years')).toBeInTheDocument()
  })

  it('tracks per-run review marks without persisting corrections', async () => {
    const user = userEvent.setup()
    const onReviewChange = vi.fn()
    render(
      <RequirementAnalysisReviewPanel
        analysis={analysis}
        suggestedTermsByCluster={new Map([['cluster-1', ['developer experience']]])}
        onSuggestedTermClick={vi.fn()}
        onReviewChange={onReviewChange}
      />,
    )

    expect(screen.getByText('0 / 1')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Mark Platform tooling reviewed' }))
    await user.click(screen.getByRole('button', { name: 'Useful' }))

    expect(screen.getByText('1 / 1')).toBeInTheDocument()
    expect(screen.getByText('Useful terms').nextElementSibling).toHaveTextContent('1')
    expect(onReviewChange).toHaveBeenCalled()
  })

  it('reports excluded clusters and noise terms for generation', async () => {
    const user = userEvent.setup()
    const onReviewChange = vi.fn()

    render(
      <RequirementAnalysisReviewPanel
        analysis={analysis}
        suggestedTermsByCluster={new Map([['cluster-1', ['developer experience']]])}
        onSuggestedTermClick={vi.fn()}
        onReviewChange={onReviewChange}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: 'Use Platform tooling in generation' }))
    await user.click(screen.getByRole('button', { name: 'Noise' }))

    const lastCall = onReviewChange.mock.calls[onReviewChange.mock.calls.length - 1]
    expect(lastCall?.[0].clusters).toEqual([])
    expect(lastCall?.[1]).toMatchObject({
      excluded_cluster_ids: ['cluster-1'],
      excluded_atom_ids: ['atom-1', 'atom-2'],
      noise_terms: ['developer experience'],
    })
  })

  it('keeps suggested taxonomy adoption connected to the existing callback', async () => {
    const user = userEvent.setup()
    const onSuggestedTermClick = vi.fn()

    render(
      <RequirementAnalysisReviewPanel
        analysis={analysis}
        suggestedTermsByCluster={new Map([['cluster-1', ['developer experience']]])}
        onSuggestedTermClick={onSuggestedTermClick}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'developer experience' }))

    expect(onSuggestedTermClick).toHaveBeenCalledWith('developer experience', ['rust'])
  })
})