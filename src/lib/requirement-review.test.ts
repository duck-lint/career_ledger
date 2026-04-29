import { describe, expect, it } from 'vitest'
import {
  buildRequirementReviewOverride,
  buildReviewedRequirementAnalysis,
} from '@/lib/requirement-review'
import type { RequirementAnalysis } from '@/lib/types'

const analysis: RequirementAnalysis = {
  analysis_version: '1.1',
  source: {
    job_posting_sha256: 'posting-sha',
    job_posting_length: 900,
    target_role_family: 'platform engineering',
    posting_keyword_bank: ['rust', 'waterfall'],
    unrecognized_notable_terms: [
      { term: 'developer experience', count: 3 },
      { term: 'waterfall', count: 2 },
    ],
    extraction_method: 'posting_surface_terms_v1',
  },
  clusters: [
    {
      cluster_id: 'cluster-1',
      label: 'Platform tooling',
      kind: 'must_have',
      priority_rank: 1,
      atom_ids: ['atom-1'],
      matched_tags: ['rust'],
    },
    {
      cluster_id: 'cluster-2',
      label: 'Process baggage',
      kind: 'nice_to_have',
      priority_rank: 4,
      atom_ids: ['atom-2'],
      matched_tags: [],
    },
  ],
  atoms: [
    {
      requirement_id: 'atom-1',
      cluster_id: 'cluster-1',
      text: 'Build Rust tooling.',
      kind: 'must_have',
      priority_rank: 1,
      source_order: 1,
      normalized_terms: [{ term: 'rust', is_negated: false }],
      matched_tags: ['rust'],
      experience_years: null,
      has_quantifier: false,
    },
    {
      requirement_id: 'atom-2',
      cluster_id: 'cluster-2',
      text: 'No waterfall delivery required.',
      kind: 'nice_to_have',
      priority_rank: 4,
      source_order: 2,
      normalized_terms: [{ term: 'waterfall', is_negated: true }],
      matched_tags: [],
      experience_years: null,
      has_quantifier: false,
    },
  ],
}

describe('requirement review helpers', () => {
  it('builds reviewed analysis by excluding clusters and noise terms', () => {
    const reviewed = buildReviewedRequirementAnalysis(analysis, {
      reviewedClusterIds: ['cluster-1'],
      excludedClusterIds: ['cluster-2'],
      usefulTerms: ['developer experience'],
      noiseTerms: ['waterfall'],
    })

    expect(reviewed.clusters.map((cluster) => cluster.cluster_id)).toEqual(['cluster-1'])
    expect(reviewed.atoms.map((atom) => atom.requirement_id)).toEqual(['atom-1'])
    expect(reviewed.source.posting_keyword_bank).toEqual(['rust'])
    expect(reviewed.source.unrecognized_notable_terms).toEqual([
      { term: 'developer experience', count: 3 },
    ])
  })

  it('builds traceable review override metadata', () => {
    const review = buildRequirementReviewOverride(analysis, {
      reviewedClusterIds: ['cluster-1'],
      excludedClusterIds: ['cluster-2'],
      usefulTerms: ['developer experience'],
      noiseTerms: ['waterfall'],
    })

    expect(review).toEqual({
      source_job_posting_sha256: 'posting-sha',
      reviewed_cluster_ids: ['cluster-1'],
      excluded_cluster_ids: ['cluster-2'],
      excluded_atom_ids: ['atom-2'],
      useful_terms: ['developer experience'],
      noise_terms: ['waterfall'],
    })
  })

  it('drops stored review terms that are not present in the current analysis', () => {
    const reviewed = buildReviewedRequirementAnalysis(analysis, {
      reviewedClusterIds: [],
      excludedClusterIds: [],
      usefulTerms: ['developer experience', 'platform automation'],
      noiseTerms: ['waterfall', 'you'],
    })
    const review = buildRequirementReviewOverride(analysis, {
      reviewedClusterIds: [],
      excludedClusterIds: [],
      usefulTerms: ['developer experience', 'platform automation'],
      noiseTerms: ['waterfall', 'you'],
    })

    expect(reviewed.source.posting_keyword_bank).toEqual(['rust'])
    expect(review.useful_terms).toEqual(['developer experience'])
    expect(review.noise_terms).toEqual(['waterfall'])
  })
})