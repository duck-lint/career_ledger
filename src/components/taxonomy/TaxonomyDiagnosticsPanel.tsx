import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { libraryService, taxonomyService } from '@/lib/service'
import { getStoredJobPostingText } from '@/lib/runtime-settings'
import {
  buildTaxonomyDiagnostics,
  taxonomyDiagnosticsIssueCount,
  type TaxonomyDiagnostics,
} from '@/lib/taxonomy-diagnostics'
import { cn } from '@/lib/utils'

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function previewList(values: string[], emptyLabel: string) {
  if (values.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {values.slice(0, 12).map((value) => (
        <Badge key={value} variant="outline" className="mono text-[10px]">
          {value}
        </Badge>
      ))}
      {values.length > 12 && (
        <Badge variant="secondary" className="text-[10px]">
          +{values.length - 12} more
        </Badge>
      )}
    </div>
  )
}

function ToggleButton({
  expanded,
  total,
  onToggle,
}: {
  expanded: boolean
  total: number
  onToggle: () => void
}) {
  return (
    <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onToggle}>
      {expanded ? 'Show fewer' : `Show all ${total}`}
    </Button>
  )
}

function InteractiveTokenList({
  values,
  emptyLabel,
  expanded,
  onToggleExpanded,
  onItemClick,
  getAriaLabel,
}: {
  values: string[]
  emptyLabel: string
  expanded: boolean
  onToggleExpanded: () => void
  onItemClick?: (value: string) => void
  getAriaLabel?: (value: string) => string
}) {
  if (values.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  const previewCount = 12
  const visibleValues = expanded ? values : values.slice(0, previewCount)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {visibleValues.map((value) =>
          onItemClick ? (
            <Button
              key={value}
              type="button"
              variant="outline"
              size="sm"
              className="mono h-7 px-2 text-[10px]"
              aria-label={getAriaLabel?.(value)}
              onClick={() => onItemClick(value)}
            >
              {value}
            </Button>
          ) : (
            <Badge key={value} variant="outline" className="mono text-[10px]">
              {value}
            </Badge>
          ),
        )}
      </div>
      {values.length > previewCount && (
        <ToggleButton expanded={expanded} total={values.length} onToggle={onToggleExpanded} />
      )}
    </div>
  )
}

function DiagnosticBlock({
  title,
  count,
  actionLabel,
  onAction,
  children,
}: {
  title: string
  count: number
  actionLabel?: string
  onAction?: () => void
  children: ReactNode
}) {
  return (
    <div className="space-y-2 rounded-lg border bg-background/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">{title}</h3>
        <div className="flex items-center gap-2">
          {actionLabel && onAction && count > 0 && (
            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          <Badge variant={count > 0 ? 'outline' : 'secondary'}>{count}</Badge>
        </div>
      </div>
      {children}
    </div>
  )
}

async function loadDiagnostics(): Promise<TaxonomyDiagnostics> {
  const [canonicalTags, records, evidence, candidateProfile] = await Promise.all([
    taxonomyService.getCanonicalTags(),
    libraryService.getRecords(),
    libraryService.getAllEvidence(),
    libraryService.getCandidateProfile(),
  ])
  const markerEntries = await Promise.all(
    canonicalTags.map(async (tag) => {
      const markers = await taxonomyService.getTagInferenceMarkers(tag.tag)
      return [tag.tag, markers] as const
    }),
  )

  return buildTaxonomyDiagnostics({
    canonicalTags,
    records,
    evidence,
    candidateProfile,
    markersByTag: Object.fromEntries(markerEntries),
    storedPostingText: getStoredJobPostingText(),
  })
}

type TaxonomyDiagnosticsPanelProps = {
  onSelectMarkerTag?: (tag: string) => void
  onReviewTags?: () => void
  onEditTag?: (tag: string) => void
  onResolveUnknownTag?: (tag: string) => void
}

export function TaxonomyDiagnosticsPanel({
  onSelectMarkerTag,
  onReviewTags,
  onEditTag,
  onResolveUnknownTag,
}: TaxonomyDiagnosticsPanelProps = {}) {
  const [diagnostics, setDiagnostics] = useState<TaxonomyDiagnostics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  const toggleSection = (section: string) => {
    setExpandedSections((current) => ({ ...current, [section]: !current[section] }))
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDiagnostics(await loadDiagnostics())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load taxonomy diagnostics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const nextDiagnostics = await loadDiagnostics()
        if (!cancelled) {
          setDiagnostics(nextDiagnostics)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load taxonomy diagnostics')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [])

  const issueCount = diagnostics ? taxonomyDiagnosticsIssueCount(diagnostics) : 0
  const ready = diagnostics !== null && issueCount === 0

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Taxonomy Diagnostics</CardTitle>
              {diagnostics && (
                <Badge
                  variant="outline"
                  className={cn(
                    'border',
                    ready
                      ? 'border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-400'
                      : 'border-yellow-600/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
                  )}
                >
                  {ready ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <AlertTriangle className="mr-1 h-3.5 w-3.5" />}
                  {ready ? 'No issues found' : pluralize(issueCount, 'issue')}
                </Badge>
              )}
            </div>
            <CardDescription>
              Ledger-level checks for taxonomy coverage across evidence and candidate profile sources, marker coverage, and orphaned tag strings.
            </CardDescription>
            <p className="text-xs text-muted-foreground">
              Click individual items to jump into tag or marker repair where a direct path exists.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && !diagnostics && (
          <Alert>
            <AlertDescription>Loading taxonomy diagnostics...</AlertDescription>
          </Alert>
        )}

        {diagnostics && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-sm text-muted-foreground">Canonical tags</div>
                <div className="font-medium">{diagnostics.canonicalTagCount}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Evidence items</div>
                <div className="font-medium">{diagnostics.evidenceCount}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Diagnostics</div>
                <div className="font-medium">{pluralize(issueCount, 'issue')}</div>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              <DiagnosticBlock
                title="Tags With No Supporting Sources"
                count={diagnostics.tagsWithoutSupportingSources.length}
              >
                <InteractiveTokenList
                  values={diagnostics.tagsWithoutSupportingSources}
                  emptyLabel="Every canonical tag appears in evidence, education, or certification sources."
                  expanded={expandedSections.tagsWithoutSupportingSources ?? false}
                  onToggleExpanded={() => toggleSection('tagsWithoutSupportingSources')}
                  onItemClick={onEditTag}
                  getAriaLabel={(value) => `Inspect tag ${value}`}
                />
              </DiagnosticBlock>

              <DiagnosticBlock
                title="Tags With No Markers"
                count={diagnostics.tagsWithoutMarkers.length}
                actionLabel="Edit first"
                onAction={() => onSelectMarkerTag?.(diagnostics.tagsWithoutMarkers[0])}
              >
                <InteractiveTokenList
                  values={diagnostics.tagsWithoutMarkers}
                  emptyLabel="Every canonical tag has at least one inference marker."
                  expanded={expandedSections.tagsWithoutMarkers ?? false}
                  onToggleExpanded={() => toggleSection('tagsWithoutMarkers')}
                  onItemClick={onSelectMarkerTag}
                  getAriaLabel={(value) => `Edit markers for ${value}`}
                />
              </DiagnosticBlock>

              <DiagnosticBlock
                title="Tags Missing Toolkit Metadata"
                count={diagnostics.tagsWithoutMetadata.length}
                actionLabel="Review tags"
                onAction={onReviewTags}
              >
                <InteractiveTokenList
                  values={diagnostics.tagsWithoutMetadata}
                  emptyLabel="Every canonical tag has display metadata and category assignment."
                  expanded={expandedSections.tagsWithoutMetadata ?? false}
                  onToggleExpanded={() => toggleSection('tagsWithoutMetadata')}
                  onItemClick={onEditTag}
                  getAriaLabel={(value) => `Edit tag ${value}`}
                />
              </DiagnosticBlock>

              <DiagnosticBlock
                title="Markers With No Source Hits"
                count={diagnostics.markersWithoutLibraryHits.length}
                actionLabel="Test first"
                onAction={() => onSelectMarkerTag?.(diagnostics.markersWithoutLibraryHits[0]?.tag)}
              >
                {diagnostics.markersWithoutLibraryHits.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Every marker currently matches at least one evidence, education, or certification source.</p>
                ) : (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {(expandedSections.markersWithoutLibraryHits
                      ? diagnostics.markersWithoutLibraryHits
                      : diagnostics.markersWithoutLibraryHits.slice(0, 8)
                    ).map((marker) => (
                      <div key={marker.id} className="rounded border bg-muted/20 p-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <Badge variant="outline" className="mono mr-2 text-[10px]">{marker.tag}</Badge>
                            {marker.label}
                          </div>
                          {onSelectMarkerTag && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              aria-label={`Edit markers for ${marker.tag}`}
                              onClick={() => onSelectMarkerTag(marker.tag)}
                            >
                              Edit markers
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {diagnostics.markersWithoutLibraryHits.length > 8 && (
                      <ToggleButton
                        expanded={expandedSections.markersWithoutLibraryHits ?? false}
                        total={diagnostics.markersWithoutLibraryHits.length}
                        onToggle={() => toggleSection('markersWithoutLibraryHits')}
                      />
                    )}
                  </div>
                )}
              </DiagnosticBlock>

              <DiagnosticBlock title="Evidence With No Tags" count={diagnostics.evidenceWithoutTags.length}>
                {diagnostics.evidenceWithoutTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Every evidence item currently has at least one tag.</p>
                ) : (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {(expandedSections.evidenceWithoutTags
                      ? diagnostics.evidenceWithoutTags
                      : diagnostics.evidenceWithoutTags.slice(0, 8)
                    ).map((item) => (
                      <div key={item.id} className="rounded border bg-muted/20 p-2">
                        {item.claim}
                      </div>
                    ))}
                    {diagnostics.evidenceWithoutTags.length > 8 && (
                      <ToggleButton
                        expanded={expandedSections.evidenceWithoutTags ?? false}
                        total={diagnostics.evidenceWithoutTags.length}
                        onToggle={() => toggleSection('evidenceWithoutTags')}
                      />
                    )}
                  </div>
                )}
              </DiagnosticBlock>

              <DiagnosticBlock title="Unknown Evidence Tags" count={diagnostics.unknownEvidenceTags.length}>
                <InteractiveTokenList
                  values={diagnostics.unknownEvidenceTags}
                  emptyLabel="No evidence tags are orphaned from the canonical taxonomy."
                  expanded={expandedSections.unknownEvidenceTags ?? false}
                  onToggleExpanded={() => toggleSection('unknownEvidenceTags')}
                  onItemClick={onResolveUnknownTag}
                  getAriaLabel={(value) => `Resolve unknown tag ${value}`}
                />
              </DiagnosticBlock>

              <DiagnosticBlock title="Unknown Record Context Tags" count={diagnostics.unknownRecordContextTags.length}>
                <InteractiveTokenList
                  values={diagnostics.unknownRecordContextTags}
                  emptyLabel="No record context tags are orphaned from the canonical taxonomy."
                  expanded={expandedSections.unknownRecordContextTags ?? false}
                  onToggleExpanded={() => toggleSection('unknownRecordContextTags')}
                  onItemClick={onResolveUnknownTag}
                  getAriaLabel={(value) => `Resolve unknown tag ${value}`}
                />
              </DiagnosticBlock>

              <DiagnosticBlock title="Unknown Candidate Profile Signal Tags" count={diagnostics.unknownCandidateProfileSignalTags.length}>
                <InteractiveTokenList
                  values={diagnostics.unknownCandidateProfileSignalTags}
                  emptyLabel="Candidate profile signal tags all resolve to canonical tags."
                  expanded={expandedSections.unknownCandidateProfileSignalTags ?? false}
                  onToggleExpanded={() => toggleSection('unknownCandidateProfileSignalTags')}
                  onItemClick={onResolveUnknownTag}
                  getAriaLabel={(value) => `Resolve unknown tag ${value}`}
                />
              </DiagnosticBlock>

              <DiagnosticBlock
                title="Stored Posting Coverage"
                count={diagnostics.storedPostingCoverage.available ? diagnostics.storedPostingCoverage.matchedTags.length : 0}
              >
                {!diagnostics.storedPostingCoverage.available ? (
                  <p className="text-sm text-muted-foreground">No saved job posting text is available for taxonomy coverage checks.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {pluralize(diagnostics.storedPostingCoverage.matchedTags.length, 'canonical tag')} matched the saved posting text by tag name or marker.
                    </p>
                    {previewList(diagnostics.storedPostingCoverage.matchedTags, 'No canonical tags matched the saved posting text.')}
                  </div>
                )}
              </DiagnosticBlock>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}