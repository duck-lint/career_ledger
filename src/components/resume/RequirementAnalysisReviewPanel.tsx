import { useEffect, useMemo, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  buildRequirementReviewOverride,
  buildReviewedRequirementAnalysis,
  splitTermStatuses,
} from '@/lib/requirement-review'
import type {
  RequirementAnalysis,
  RequirementAtom,
  RequirementCluster,
  RequirementReviewOverride,
} from '@/lib/types'
import { cn } from '@/lib/utils'

type TermReviewStatus = 'useful' | 'noise'

type ClusterReviewItem = {
  cluster: RequirementCluster
  atoms: RequirementAtom[]
  positiveTerms: string[]
  negatedTerms: string[]
  suggestedTerms: string[]
}

type RequirementAnalysisReviewPanelProps = {
  analysis: RequirementAnalysis
  suggestedTermsByCluster: Map<string, string[]>
  onSuggestedTermClick: (term: string, clusterMatchedTags: string[]) => void
  onReviewChange?: (reviewedAnalysis: RequirementAnalysis, review: RequirementReviewOverride) => void
  disabled?: boolean
}

function formatRequirementKind(value: string): string {
  return value
    .split('_')
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ')
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right))
}

function atomTerms(atoms: RequirementAtom[], negated: boolean): string[] {
  return uniqueSorted(
    atoms.flatMap((atom) =>
      atom.normalized_terms
        .filter((term) => term.is_negated === negated)
        .map((term) => term.term),
    ),
  )
}

function clusterAtoms(cluster: RequirementCluster, atoms: RequirementAtom[]): RequirementAtom[] {
  const byId = new Map(atoms.map((atom) => [atom.requirement_id, atom]))
  return cluster.atom_ids
    .map((atomId) => byId.get(atomId))
    .filter((atom): atom is RequirementAtom => Boolean(atom))
}

function termKey(clusterId: string, term: string): string {
  return `${clusterId}::${term}`
}

function countReviewedTerms(terms: string[], termStatuses: Record<string, TermReviewStatus>): number {
  return terms.filter((term) => Boolean(termStatuses[term])).length
}

export function RequirementAnalysisReviewPanel({
  analysis,
  suggestedTermsByCluster,
  onSuggestedTermClick,
  onReviewChange,
  disabled = false,
}: RequirementAnalysisReviewPanelProps) {
  const [reviewedClusterIds, setReviewedClusterIds] = useState<Set<string>>(() => new Set())
  const [excludedClusterIds, setExcludedClusterIds] = useState<Set<string>>(() => new Set())
  const [termStatuses, setTermStatuses] = useState<Record<string, TermReviewStatus>>({})
  const [activeClusterId, setActiveClusterId] = useState<string | null>(
    analysis.clusters[0]?.cluster_id ?? null,
  )

  const reviewItems = useMemo<ClusterReviewItem[]>(() => {
    return analysis.clusters.map((cluster) => {
      const atoms = clusterAtoms(cluster, analysis.atoms)

      return {
        cluster,
        atoms,
        positiveTerms: atomTerms(atoms, false),
        negatedTerms: atomTerms(atoms, true),
        suggestedTerms: suggestedTermsByCluster.get(cluster.cluster_id) ?? [],
      }
    })
  }, [analysis, suggestedTermsByCluster])

  useEffect(() => {
    if (reviewItems.length === 0) {
      setActiveClusterId(null)
      return
    }

    if (activeClusterId && reviewItems.some((item) => item.cluster.cluster_id === activeClusterId)) {
      return
    }

    setActiveClusterId(reviewItems[0].cluster.cluster_id)
  }, [activeClusterId, reviewItems])

  const activeClusterIndex = reviewItems.findIndex(
    (item) => item.cluster.cluster_id === activeClusterId,
  )
  const currentClusterIndex = activeClusterIndex >= 0 ? activeClusterIndex : 0
  const currentItem = reviewItems[currentClusterIndex] ?? null

  const reviewSummary = useMemo(() => {
    const positiveTerms = uniqueSorted(
      analysis.atoms.flatMap((atom) =>
        atom.normalized_terms.filter((term) => !term.is_negated).map((term) => term.term),
      ),
    )
    const negatedTerms = uniqueSorted(
      analysis.atoms.flatMap((atom) =>
        atom.normalized_terms.filter((term) => term.is_negated).map((term) => term.term),
      ),
    )
    const matchedTags = uniqueSorted(analysis.clusters.flatMap((cluster) => cluster.matched_tags))
    const suggestedTerms = uniqueSorted(
      Array.from(suggestedTermsByCluster.values()).flatMap((terms) => terms),
    )

    return {
      positiveTermCount: positiveTerms.length,
      negatedTermCount: negatedTerms.length,
      matchedTagCount: matchedTags.length,
      suggestedTermCount: suggestedTerms.length,
    }
  }, [analysis, suggestedTermsByCluster])

  const reviewedCount = reviewedClusterIds.size
  const excludedClusterCount = excludedClusterIds.size
  const usefulTermCount = Object.values(termStatuses).filter((status) => status === 'useful').length
  const noiseTermCount = Object.values(termStatuses).filter((status) => status === 'noise').length

  useEffect(() => {
    if (!onReviewChange) {
      return
    }

    const { usefulTerms, noiseTerms } = splitTermStatuses(termStatuses)
    const draft = {
      reviewedClusterIds: Array.from(reviewedClusterIds),
      excludedClusterIds: Array.from(excludedClusterIds),
      usefulTerms,
      noiseTerms,
    }

    onReviewChange(
      buildReviewedRequirementAnalysis(analysis, draft),
      buildRequirementReviewOverride(analysis, draft),
    )
  }, [analysis, excludedClusterIds, onReviewChange, reviewedClusterIds, termStatuses])

  const toggleClusterReviewed = (clusterId: string, checked: boolean) => {
    setReviewedClusterIds((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(clusterId)
      } else {
        next.delete(clusterId)
      }
      return next
    })
  }

  const setTermStatus = (term: string, status: TermReviewStatus) => {
    setTermStatuses((current) => {
      if (current[term] === status) {
        const next = { ...current }
        delete next[term]
        return next
      }

      return { ...current, [term]: status }
    })
  }

  const toggleClusterIncluded = (clusterId: string, checked: boolean) => {
    setExcludedClusterIds((current) => {
      const next = new Set(current)
      if (checked) {
        next.delete(clusterId)
      } else {
        next.add(clusterId)
      }
      return next
    })
  }

  const goToCluster = (index: number) => {
    const nextClusterId = reviewItems[index]?.cluster.cluster_id
    if (nextClusterId) {
      setActiveClusterId(nextClusterId)
    }
  }

  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-base">Requirement Review</CardTitle>
          {currentItem && (
            <CardDescription>
              Cluster {currentClusterIndex + 1} of {reviewItems.length}
            </CardDescription>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div>
            <div className="text-sm text-muted-foreground">Clusters reviewed</div>
            <div className="font-medium">{reviewedCount} / {analysis.clusters.length}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Clusters excluded</div>
            <div className="font-medium">{excludedClusterCount}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Suggested terms</div>
            <div className="font-medium">{reviewSummary.suggestedTermCount}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Matched tags</div>
            <div className="font-medium">{reviewSummary.matchedTagCount}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Useful terms</div>
            <div className="font-medium">{usefulTermCount}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Noise terms</div>
            <div className="font-medium">{noiseTermCount}</div>
          </div>
        </div>

        {analysis.clusters.length === 0 ? (
          <Alert>
            <AlertDescription>No requirement clusters were extracted from this posting.</AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="space-y-2">
              {reviewItems.map((item, index) => {
                const reviewed = reviewedClusterIds.has(item.cluster.cluster_id)
                const included = !excludedClusterIds.has(item.cluster.cluster_id)
                const selected = item.cluster.cluster_id === currentItem?.cluster.cluster_id
                const reviewedTermCount = countReviewedTerms(item.suggestedTerms, termStatuses)

                return (
                  <button
                    key={item.cluster.cluster_id}
                    type="button"
                    aria-label={`Open ${item.cluster.label} review`}
                    aria-current={selected ? 'step' : undefined}
                    onClick={() => setActiveClusterId(item.cluster.cluster_id)}
                    disabled={disabled}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      selected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'bg-background hover:bg-muted/30',
                      !included && 'opacity-70',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="truncate font-medium text-foreground">{item.cluster.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatRequirementKind(item.cluster.kind)} · {item.atoms.length} atoms
                        </div>
                      </div>
                      <Badge variant="outline">#{index + 1}</Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {reviewed && <Badge variant="secondary">Reviewed</Badge>}
                      {!included && <Badge variant="outline">Excluded</Badge>}
                      <Badge variant="outline">
                        {reviewedTermCount}/{item.suggestedTerms.length} terms
                      </Badge>
                    </div>
                  </button>
                )
              })}
            </div>

            {currentItem && (
              <div
                className={cn(
                  'space-y-4 rounded-lg border bg-muted/20 p-4 text-sm',
                  excludedClusterIds.has(currentItem.cluster.cluster_id) && 'opacity-70',
                )}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Cluster {currentClusterIndex + 1} of {reviewItems.length}
                    </div>
                    <div className="text-lg font-semibold text-foreground">
                      {currentItem.cluster.label}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {formatRequirementKind(currentItem.cluster.kind)}
                      </Badge>
                      <Badge variant="outline">Priority {currentItem.cluster.priority_rank}</Badge>
                      <Badge variant="outline">{currentItem.atoms.length} atoms</Badge>
                      <Badge variant="outline">
                        {currentItem.positiveTerms.length} positive · {currentItem.negatedTerms.length} negated
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => goToCluster(currentClusterIndex - 1)}
                      disabled={disabled || currentClusterIndex <= 0}
                      aria-label="Previous cluster"
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => goToCluster(currentClusterIndex + 1)}
                      disabled={disabled || currentClusterIndex >= reviewItems.length - 1}
                      aria-label="Next cluster"
                    >
                      Next
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex items-center gap-2 rounded-md border bg-background/70 px-3 py-2">
                    <input
                      id={`include-${currentItem.cluster.cluster_id}`}
                      type="checkbox"
                      aria-label={`Use ${currentItem.cluster.label} in generation`}
                      title={`Use ${currentItem.cluster.label} in generation`}
                      checked={!excludedClusterIds.has(currentItem.cluster.cluster_id)}
                      onChange={(event) =>
                        toggleClusterIncluded(currentItem.cluster.cluster_id, event.target.checked)
                      }
                      disabled={disabled}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <Label htmlFor={`include-${currentItem.cluster.cluster_id}`} className="text-xs">
                      Use in generation
                    </Label>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border bg-background/70 px-3 py-2">
                    <input
                      id={`review-${currentItem.cluster.cluster_id}`}
                      type="checkbox"
                      aria-label={`Mark ${currentItem.cluster.label} reviewed`}
                      title={`Mark ${currentItem.cluster.label} reviewed`}
                      checked={reviewedClusterIds.has(currentItem.cluster.cluster_id)}
                      onChange={(event) =>
                        toggleClusterReviewed(currentItem.cluster.cluster_id, event.target.checked)
                      }
                      disabled={disabled}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <Label htmlFor={`review-${currentItem.cluster.cluster_id}`} className="text-xs">
                      Reviewed
                    </Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Suggested taxonomy terms</div>
                  {currentItem.suggestedTerms.length === 0 ? (
                    <div className="rounded-md border bg-background/70 p-3 text-sm text-muted-foreground">
                      No suggested taxonomy terms in this cluster.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {currentItem.suggestedTerms.map((term) => {
                        const status = termStatuses[term]

                        return (
                          <div
                            key={termKey(currentItem.cluster.cluster_id, term)}
                            className="grid gap-3 rounded-lg border bg-background/70 p-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-center"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="mono truncate text-sm font-medium text-foreground">
                                {term}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {currentItem.cluster.label}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8 px-3 text-xs"
                              onClick={() =>
                                onSuggestedTermClick(term, currentItem.cluster.matched_tags)
                              }
                              disabled={disabled}
                            >
                              <span className="mono">{term}</span>
                            </Button>
                            <Button
                              type="button"
                              variant={status === 'useful' ? 'default' : 'ghost'}
                              size="sm"
                              aria-label={`Mark ${term} useful`}
                              aria-pressed={status === 'useful' ? 'true' : 'false'}
                              className={cn(
                                'h-8 px-3 text-xs',
                                status === 'useful' && 'text-primary-foreground',
                              )}
                              onClick={() => setTermStatus(term, 'useful')}
                              disabled={disabled}
                            >
                              Useful
                            </Button>
                            <Button
                              type="button"
                              variant={status === 'noise' ? 'default' : 'ghost'}
                              size="sm"
                              aria-label={`Mark ${term} noise`}
                              aria-pressed={status === 'noise' ? 'true' : 'false'}
                              className={cn(
                                'h-8 px-3 text-xs',
                                status === 'noise' && 'text-primary-foreground',
                              )}
                              onClick={() => setTermStatus(term, 'noise')}
                              disabled={disabled}
                            >
                              Noise
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {currentItem.cluster.matched_tags.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      Matched taxonomy tags
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {currentItem.cluster.matched_tags.map((tag) => (
                        <Badge
                          key={`${currentItem.cluster.cluster_id}-${tag}`}
                          variant="outline"
                          className="mono border-green-600/40 text-green-700 dark:border-green-500/40 dark:text-green-400"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      Extracted positive terms
                    </div>
                    {currentItem.positiveTerms.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No positive terms extracted for this cluster.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {currentItem.positiveTerms.map((term) => (
                          <Badge
                            key={`${currentItem.cluster.cluster_id}-positive-${term}`}
                            variant="outline"
                            className="mono"
                          >
                            {term}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Negated terms</div>
                    {currentItem.negatedTerms.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No negated terms extracted for this cluster.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {currentItem.negatedTerms.map((term) => (
                          <Badge
                            key={`${currentItem.cluster.cluster_id}-negated-${term}`}
                            variant="secondary"
                            className="mono"
                          >
                            {term}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Requirement atoms</div>
                  <div className="space-y-2">
                    {currentItem.atoms.map((atom) => (
                      <div key={atom.requirement_id} className="rounded-md border bg-background/70 p-3">
                        <div className="text-sm text-foreground">{atom.text}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="secondary">{formatRequirementKind(atom.kind)}</Badge>
                          {atom.has_quantifier && <Badge variant="outline">Quantified</Badge>}
                          {atom.experience_years && (
                            <Badge variant="outline">
                              {atom.experience_years.min_years}
                              {atom.experience_years.max_years
                                ? `-${atom.experience_years.max_years}`
                                : '+'}{' '}
                              years
                            </Badge>
                          )}
                          {atom.subject && <Badge variant="outline">{atom.subject}</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}