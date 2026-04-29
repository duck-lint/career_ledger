import type {
  RequirementAnalysis,
  RequirementReviewOverride,
  RequirementReviewTermStatus,
} from './types'

export type RequirementReviewDraft = {
  reviewedClusterIds: string[]
  excludedClusterIds: string[]
  usefulTerms: string[]
  noiseTerms: string[]
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right),
  )
}

function reviewTermUniverse(analysis: RequirementAnalysis): Set<string> {
  return new Set(
    uniqueSorted([
      ...analysis.source.posting_keyword_bank,
      ...analysis.source.unrecognized_notable_terms.map((term) => term.term),
      ...analysis.atoms.flatMap((atom) => atom.normalized_terms.map((term) => term.term)),
    ]),
  )
}

export function filterApplicableReviewTerms(
  analysis: RequirementAnalysis,
  terms: string[],
): string[] {
  const availableTerms = reviewTermUniverse(analysis)
  return uniqueSorted(terms).filter((term) => availableTerms.has(term))
}

export function buildReviewedRequirementAnalysis(
  analysis: RequirementAnalysis,
  draft: RequirementReviewDraft,
): RequirementAnalysis {
  const excludedClusterIds = new Set(draft.excludedClusterIds)
  const noiseTerms = new Set(filterApplicableReviewTerms(analysis, draft.noiseTerms))
  const atoms = analysis.atoms
    .filter((atom) => !excludedClusterIds.has(atom.cluster_id))
    .map((atom) => ({
      ...atom,
      normalized_terms: atom.normalized_terms.filter((term) => !noiseTerms.has(term.term)),
    }))
  const keptAtomIds = new Set(atoms.map((atom) => atom.requirement_id))
  const clusters = analysis.clusters
    .filter((cluster) => !excludedClusterIds.has(cluster.cluster_id))
    .map((cluster) => ({
      ...cluster,
      atom_ids: cluster.atom_ids.filter((atomId) => keptAtomIds.has(atomId)),
    }))
    .filter((cluster) => cluster.atom_ids.length > 0)

  return {
    ...analysis,
    source: {
      ...analysis.source,
      posting_keyword_bank: analysis.source.posting_keyword_bank.filter((term) => !noiseTerms.has(term)),
      unrecognized_notable_terms: analysis.source.unrecognized_notable_terms.filter(
        (term) => !noiseTerms.has(term.term),
      ),
    },
    clusters,
    atoms,
  }
}

export function buildRequirementReviewOverride(
  analysis: RequirementAnalysis,
  draft: RequirementReviewDraft,
): RequirementReviewOverride {
  const excludedClusterIds = uniqueSorted(draft.excludedClusterIds)
  const excludedClusterIdSet = new Set(excludedClusterIds)
  const usefulTerms = filterApplicableReviewTerms(analysis, draft.usefulTerms)
  const noiseTerms = filterApplicableReviewTerms(analysis, draft.noiseTerms)
  const excludedAtomIds = uniqueSorted(
    analysis.atoms
      .filter((atom) => excludedClusterIdSet.has(atom.cluster_id))
      .map((atom) => atom.requirement_id),
  )

  return {
    source_job_posting_sha256: analysis.source.job_posting_sha256,
    reviewed_cluster_ids: uniqueSorted(draft.reviewedClusterIds),
    excluded_cluster_ids: excludedClusterIds,
    excluded_atom_ids: excludedAtomIds,
    useful_terms: usefulTerms,
    noise_terms: noiseTerms,
  }
}

export function splitTermStatuses(statuses: Record<string, RequirementReviewTermStatus>) {
  return Object.entries(statuses).reduce(
    (result, [term, status]) => {
      if (status === 'useful') result.usefulTerms.push(term)
      if (status === 'noise') result.noiseTerms.push(term)
      return result
    },
    { usefulTerms: [] as string[], noiseTerms: [] as string[] },
  )
}