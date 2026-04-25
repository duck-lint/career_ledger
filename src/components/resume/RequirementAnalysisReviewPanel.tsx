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

function termFromKey(value: string): string {
  return value.split('::').slice(1).join('::')
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

    const { usefulTerms, noiseTerms } = splitTermStatuses(
      Object.fromEntries(
        Object.entries(termStatuses).map(([key, status]) => [termFromKey(key), status]),
      ),
    )
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

  const setTermStatus = (clusterId: string, term: string, status: TermReviewStatus) => {
    setTermStatuses((current) => ({ ...current, [termKey(clusterId, term)]: status }))
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

  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Requirement Review</CardTitle>
        <CardDescription>
          Local extraction view for requirement clusters, normalized terms, taxonomy matches, and per-run review notes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            This review reflects local surface-term extraction and taxonomy matching. Included clusters and noise-term choices flow into generation for this run when reviewed analysis is available.
          </AlertDescription>
        </Alert>

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
            <div className="text-sm text-muted-foreground">Positive terms</div>
            <div className="font-medium">{reviewSummary.positiveTermCount}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Negated terms</div>
            <div className="font-medium">{reviewSummary.negatedTermCount}</div>
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
          <div className="space-y-3">
            {analysis.clusters.map((cluster) => {
              const atoms = clusterAtoms(cluster, analysis.atoms)
              const positiveTerms = atomTerms(atoms, false)
              const negatedTerms = atomTerms(atoms, true)
              const suggestedTerms = suggestedTermsByCluster.get(cluster.cluster_id) ?? []
              const reviewed = reviewedClusterIds.has(cluster.cluster_id)
              const included = !excludedClusterIds.has(cluster.cluster_id)

              return (
                <div key={cluster.cluster_id} className={cn('space-y-3 rounded-lg border bg-muted/20 p-3 text-sm', !included && 'opacity-70')}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="font-medium text-foreground">{cluster.label}</div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{formatRequirementKind(cluster.kind)}</Badge>
                        <Badge variant="outline">Priority {cluster.priority_rank}</Badge>
                        <Badge variant="outline">{atoms.length} atoms</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-2 rounded-md border bg-background/70 px-3 py-2">
                        <input
                          id={`include-${cluster.cluster_id}`}
                          type="checkbox"
                          aria-label={`Use ${cluster.label} in generation`}
                          title={`Use ${cluster.label} in generation`}
                          checked={included}
                          onChange={(event) => toggleClusterIncluded(cluster.cluster_id, event.target.checked)}
                          disabled={disabled}
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                        <Label htmlFor={`include-${cluster.cluster_id}`} className="text-xs">Use in generation</Label>
                      </div>
                      <div className="flex items-center gap-2 rounded-md border bg-background/70 px-3 py-2">
                        <input
                          id={`review-${cluster.cluster_id}`}
                          type="checkbox"
                          aria-label={`Mark ${cluster.label} reviewed`}
                          title={`Mark ${cluster.label} reviewed`}
                          checked={reviewed}
                          onChange={(event) => toggleClusterReviewed(cluster.cluster_id, event.target.checked)}
                          disabled={disabled}
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                        <Label htmlFor={`review-${cluster.cluster_id}`} className="text-xs">Reviewed</Label>
                      </div>
                    </div>
                  </div>

                  {cluster.matched_tags.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">Matched taxonomy tags</div>
                      <div className="flex flex-wrap gap-2">
                        {cluster.matched_tags.map((tag) => (
                          <Badge key={`${cluster.cluster_id}-${tag}`} variant="outline" className="mono border-green-600/40 text-green-700 dark:border-green-500/40 dark:text-green-400">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Extracted positive terms</div>
                      {positiveTerms.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No positive terms extracted for this cluster.</div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {positiveTerms.map((term) => (
                            <Badge key={`${cluster.cluster_id}-positive-${term}`} variant="outline" className="mono">
                              {term}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Negated terms</div>
                      {negatedTerms.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No negated terms extracted for this cluster.</div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {negatedTerms.map((term) => (
                            <Badge key={`${cluster.cluster_id}-negated-${term}`} variant="secondary" className="mono">
                              {term}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {suggestedTerms.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Suggested taxonomy terms</div>
                      <div className="flex flex-wrap gap-2">
                        {suggestedTerms.map((term) => {
                          const status = termStatuses[termKey(cluster.cluster_id, term)]
                          return (
                            <div key={`${cluster.cluster_id}-suggested-${term}`} className="flex items-center gap-1 rounded-md border bg-background/70 p-1">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => onSuggestedTermClick(term, cluster.matched_tags)}
                                disabled={disabled}
                              >
                                <span className="mono">{term}</span>
                              </Button>
                              <Button
                                type="button"
                                variant={status === 'useful' ? 'default' : 'ghost'}
                                size="sm"
                                className={cn('h-7 px-2 text-xs', status === 'useful' && 'text-primary-foreground')}
                                onClick={() => setTermStatus(cluster.cluster_id, term, 'useful')}
                                disabled={disabled}
                              >
                                Useful
                              </Button>
                              <Button
                                type="button"
                                variant={status === 'noise' ? 'default' : 'ghost'}
                                size="sm"
                                className={cn('h-7 px-2 text-xs', status === 'noise' && 'text-primary-foreground')}
                                onClick={() => setTermStatus(cluster.cluster_id, term, 'noise')}
                                disabled={disabled}
                              >
                                Noise
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Requirement atoms</div>
                    <div className="space-y-2">
                      {atoms.map((atom) => (
                        <div key={atom.requirement_id} className="rounded-md border bg-background/70 p-3">
                          <div className="text-sm text-foreground">{atom.text}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="secondary">{formatRequirementKind(atom.kind)}</Badge>
                            {atom.has_quantifier && <Badge variant="outline">Quantified</Badge>}
                            {atom.experience_years && (
                              <Badge variant="outline">
                                {atom.experience_years.min_years}{atom.experience_years.max_years ? `-${atom.experience_years.max_years}` : '+'} years
                              </Badge>
                            )}
                            {atom.subject && <Badge variant="outline">{atom.subject}</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}