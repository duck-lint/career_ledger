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

const singleClusterSuggestedTerms = new Map([['cluster-1', ['developer experience']]])

const multiClusterAnalysis: RequirementAnalysis = {
  ...analysis,
  clusters: [
    ...analysis.clusters,
    {
      cluster_id: 'cluster-2',
      label: 'Delivery systems',
      kind: 'should_have',
      priority_rank: 2,
      atom_ids: ['atom-3'],
      matched_tags: ['kubernetes'],
    },
  ],
  atoms: [
    ...analysis.atoms,
    {
      requirement_id: 'atom-3',
      cluster_id: 'cluster-2',
      text: 'Improve developer experience for kubernetes delivery systems.',
      kind: 'should_have',
      priority_rank: 2,
      source_order: 3,
      normalized_terms: [
        { term: 'developer experience', is_negated: false },
        { term: 'kubernetes', is_negated: false },
        { term: 'platform automation', is_negated: false },
      ],
      matched_tags: ['kubernetes'],
      experience_years: null,
      has_quantifier: false,
      subject: 'delivery systems',
    },
  ],
}

const multiClusterSuggestedTerms = new Map([
  ['cluster-1', ['developer experience']],
  ['cluster-2', ['developer experience', 'platform automation']],
])

describe('RequirementAnalysisReviewPanel', () => {
  it('renders local extraction framing and extracted requirement details', () => {
    render(
      <RequirementAnalysisReviewPanel
        analysis={analysis}
        suggestedTermsByCluster={singleClusterSuggestedTerms}
        onSuggestedTermClick={vi.fn()}
      />,
    )

    expect(screen.getByText('Requirement Review')).toBeInTheDocument()
    expect(screen.getAllByText(/Cluster\s+1\s+of\s+1/i)).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Open Platform tooling review' })).toBeInTheDocument()
    expect(screen.getByText('Suggested taxonomy terms')).toBeInTheDocument()
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
        suggestedTermsByCluster={singleClusterSuggestedTerms}
        onSuggestedTermClick={vi.fn()}
        onReviewChange={onReviewChange}
      />,
    )

    expect(screen.getByText('0 / 1')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Mark Platform tooling reviewed' }))
    await user.click(screen.getByRole('button', { name: 'Mark developer experience useful' }))

    expect(screen.getByText('1 / 1')).toBeInTheDocument()
    expect(screen.getByText('Useful terms').nextElementSibling).toHaveTextContent('1')
    expect(
      screen.getByRole('button', { name: 'Mark developer experience useful' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(onReviewChange).toHaveBeenCalled()
  })

  it('hydrates persisted noise terms and resets them when a new analysis arrives', async () => {
    const user = userEvent.setup()
    const nextAnalysis: RequirementAnalysis = {
      ...multiClusterAnalysis,
      source: {
        ...multiClusterAnalysis.source,
        job_posting_sha256: 'def456',
      },
    }
    const { rerender } = render(
      <RequirementAnalysisReviewPanel
        analysis={analysis}
        suggestedTermsByCluster={singleClusterSuggestedTerms}
        onSuggestedTermClick={vi.fn()}
        persistedNoiseTerms={['developer experience']}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Mark developer experience noise' }),
    ).toHaveAttribute('aria-pressed', 'true')

    rerender(
      <RequirementAnalysisReviewPanel
        analysis={nextAnalysis}
        suggestedTermsByCluster={multiClusterSuggestedTerms}
        onSuggestedTermClick={vi.fn()}
        persistedNoiseTerms={['platform automation']}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Mark developer experience noise' }),
    ).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'Next cluster' }))

    expect(
      screen.getByRole('button', { name: 'Mark platform automation noise' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('reports excluded clusters and noise terms for generation', async () => {
    const user = userEvent.setup()
    const onReviewChange = vi.fn()

    render(
      <RequirementAnalysisReviewPanel
        analysis={analysis}
        suggestedTermsByCluster={singleClusterSuggestedTerms}
        onSuggestedTermClick={vi.fn()}
        onReviewChange={onReviewChange}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: 'Use Platform tooling in generation' }))
    await user.click(screen.getByRole('button', { name: 'Mark developer experience noise' }))

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
        suggestedTermsByCluster={singleClusterSuggestedTerms}
        onSuggestedTermClick={onSuggestedTermClick}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'developer experience' }))

    expect(onSuggestedTermClick).toHaveBeenCalledWith('developer experience', ['rust'])
  })

  it('navigates between clusters without losing term decisions', async () => {
    const user = userEvent.setup()

    render(
      <RequirementAnalysisReviewPanel
        analysis={multiClusterAnalysis}
        suggestedTermsByCluster={multiClusterSuggestedTerms}
        onSuggestedTermClick={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Mark developer experience useful' }))
    await user.click(screen.getByRole('button', { name: 'Next cluster' }))

    expect(screen.getAllByText(/Cluster\s+2\s+of\s+2/i)).toHaveLength(2)
    expect(
      screen.getByText('Improve developer experience for kubernetes delivery systems.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next cluster' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Mark developer experience useful' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })
})