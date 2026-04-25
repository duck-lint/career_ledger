import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleDashed, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  libraryService,
  operationsService,
  taxonomyService,
} from '@/lib/service'
import { appRuntime } from '@/lib/runtime'
import type { LibraryTagSyncStatus } from '@/lib/types'
import { buildTaxonomyDiagnostics, taxonomyDiagnosticsIssueCount } from '@/lib/taxonomy-diagnostics'
import { cn } from '@/lib/utils'

type ReadinessTab = 'library' | 'taxonomy' | 'resume' | 'operations' | 'settings'

type ReadinessDashboardProps = {
  onNavigate: (tab: ReadinessTab) => void
}

type ReadinessData = {
  categoryCount: number
  tagCount: number
  recordCount: number
  evidenceCount: number
  hasCandidateProfile: boolean
  tagSyncStatus: LibraryTagSyncStatus | null
  openAnomalyCount: number
  manifestCount: number
  taxonomyDiagnosticIssueCount: number
}

type ReadinessSeverity = 'blocker' | 'warning' | 'ready' | 'info'

type ReadinessItem = {
  id: string
  label: string
  detail: string
  severity: ReadinessSeverity
  actionLabel?: string
  actionTab?: ReadinessTab
}

const emptyReadinessData: ReadinessData = {
  categoryCount: 0,
  tagCount: 0,
  recordCount: 0,
  evidenceCount: 0,
  hasCandidateProfile: false,
  tagSyncStatus: null,
  openAnomalyCount: 0,
  manifestCount: 0,
  taxonomyDiagnosticIssueCount: 0,
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function buildReadinessItems(data: ReadinessData): ReadinessItem[] {
  return [
    data.categoryCount > 0 && data.tagCount > 0
      ? {
          id: 'taxonomy-ready',
          label: 'Taxonomy exists',
          detail: `${pluralize(data.tagCount, 'tag')} across ${pluralize(data.categoryCount, 'category', 'categories')}.`,
          severity: 'ready',
          actionLabel: 'Review taxonomy',
          actionTab: 'taxonomy',
        }
      : {
          id: 'taxonomy-missing',
          label: 'Create or import taxonomy',
          detail: 'Resume matching needs delivery categories and canonical tags before evidence can be meaningfully inferred.',
          severity: 'blocker',
          actionLabel: 'Open Taxonomy',
          actionTab: 'taxonomy',
        },
    data.recordCount > 0
      ? {
          id: 'records-ready',
          label: 'Career records exist',
          detail: `${pluralize(data.recordCount, 'record')} available for resume selection.`,
          severity: 'ready',
          actionLabel: 'Review library',
          actionTab: 'library',
        }
      : {
          id: 'records-missing',
          label: 'Add experience records',
          detail: 'Records give evidence a role, project, organization, and date context.',
          severity: 'blocker',
          actionLabel: 'Open Library',
          actionTab: 'library',
        },
    data.evidenceCount > 0
      ? {
          id: 'evidence-ready',
          label: 'Evidence library has claims',
          detail: `${pluralize(data.evidenceCount, 'evidence item')} available for matching and assembly.`,
          severity: 'ready',
          actionLabel: 'Review evidence',
          actionTab: 'library',
        }
      : {
          id: 'evidence-missing',
          label: 'Add evidence claims',
          detail: 'The resume pipeline can only select from claim-backed evidence items.',
          severity: 'blocker',
          actionLabel: 'Open Library',
          actionTab: 'library',
        },
    data.hasCandidateProfile
      ? {
          id: 'profile-ready',
          label: 'Candidate profile saved',
          detail: 'Identity, contact, education, certification, and profile seed data are available to generation.',
          severity: 'ready',
          actionLabel: 'Review profile',
          actionTab: 'library',
        }
      : {
          id: 'profile-missing',
          label: 'Save candidate profile',
          detail: 'Resume generation requires an active candidate profile before the pipeline can run.',
          severity: 'blocker',
          actionLabel: 'Open Library',
          actionTab: 'library',
        },
    data.tagSyncStatus?.requiresReinference
      ? {
          id: 'tags-stale',
          label: 'Re-infer library tags',
          detail: 'Taxonomy changes have not been backfilled into records and evidence yet.',
          severity: 'warning',
          actionLabel: 'Open Taxonomy',
          actionTab: 'taxonomy',
        }
      : {
          id: 'tags-in-sync',
          label: 'Library tags in sync',
          detail: data.tagSyncStatus
            ? 'Current taxonomy metadata does not require a library tag refresh.'
            : 'Tag sync metadata is not available yet.',
          severity: data.tagSyncStatus ? 'ready' : 'info',
          actionLabel: 'Open Taxonomy',
          actionTab: 'taxonomy',
        },
    data.taxonomyDiagnosticIssueCount > 0
      ? {
          id: 'taxonomy-diagnostics-warning',
          label: 'Review taxonomy diagnostics',
          detail: `${pluralize(data.taxonomyDiagnosticIssueCount, 'taxonomy diagnostic')} may affect matching confidence or repair loops.`,
          severity: 'warning',
          actionLabel: 'Open Taxonomy',
          actionTab: 'taxonomy',
        }
      : {
          id: 'taxonomy-diagnostics-clear',
          label: 'Taxonomy diagnostics clear',
          detail: 'No taxonomy coverage, marker, or orphaned-tag diagnostics are currently open.',
          severity: 'ready',
          actionLabel: 'Open Taxonomy',
          actionTab: 'taxonomy',
        },
    data.openAnomalyCount > 0
      ? {
          id: 'anomalies-open',
          label: 'Review open anomalies',
          detail: `${pluralize(data.openAnomalyCount, 'open anomaly', 'open anomalies')} may indicate import or assembly data quality issues.`,
          severity: 'warning',
          actionLabel: 'Open Operations',
          actionTab: 'operations',
        }
      : {
          id: 'anomalies-clear',
          label: 'No open anomalies',
          detail: 'No unresolved system-generated data quality issues are currently recorded.',
          severity: 'ready',
          actionLabel: 'Open Operations',
          actionTab: 'operations',
        },
    data.manifestCount > 0
      ? {
          id: 'manifests-ready',
          label: 'Generation history exists',
          detail: `${pluralize(data.manifestCount, 'manifest')} recorded for previous resume runs.`,
          severity: 'ready',
          actionLabel: 'Open Resume',
          actionTab: 'resume',
        }
      : {
          id: 'manifests-empty',
          label: 'No resume run recorded yet',
          detail: 'Once the core inputs are ready, run the Resume pipeline to create a first manifest.',
          severity: 'info',
          actionLabel: 'Open Resume',
          actionTab: 'resume',
        },
  ]
}

function summarize(items: ReadinessItem[]) {
  const blockers = items.filter((item) => item.severity === 'blocker').length
  const warnings = items.filter((item) => item.severity === 'warning').length
  if (blockers > 0) {
    return {
      label: 'Setup needed',
      detail: `${pluralize(blockers, 'blocker')} before resume generation is ready.`,
      severity: 'blocker' as const,
    }
  }
  if (warnings > 0) {
    return {
      label: 'Review recommended',
      detail: `${pluralize(warnings, 'warning')} should be checked before relying on the next resume run.`,
      severity: 'warning' as const,
    }
  }
  return {
    label: 'Ready to generate',
    detail: 'Core inputs are present and no readiness warnings are open.',
    severity: 'ready' as const,
  }
}

function readinessIcon(severity: ReadinessSeverity) {
  if (severity === 'ready') return CheckCircle2
  if (severity === 'warning' || severity === 'blocker') return AlertTriangle
  return CircleDashed
}

function severityClassName(severity: ReadinessSeverity): string {
  switch (severity) {
    case 'blocker':
      return 'border-destructive/40 bg-destructive/5 text-destructive'
    case 'warning':
      return 'border-yellow-600/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
    case 'ready':
      return 'border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-400'
    case 'info':
      return 'border-border bg-muted/40 text-muted-foreground'
  }
}

async function loadReadinessData(): Promise<ReadinessData> {
  const [categories, tags, records, evidence, profile, tagSyncStatus, anomalies, manifests] =
    await Promise.all([
      taxonomyService.getDeliveryToolkitCategories(),
      taxonomyService.getCanonicalTags(),
      libraryService.getRecords(),
      libraryService.getAllEvidence(),
      libraryService.getCandidateProfile(),
      taxonomyService.getLibraryTagSyncStatus(),
      operationsService.getAnomalies(),
      operationsService.getGenerationManifests(),
    ])
  const markerEntries = await Promise.all(
    tags.map(async (tag) => {
      const markers = await taxonomyService.getTagInferenceMarkers(tag.tag)
      return [tag.tag, markers] as const
    }),
  )
  const diagnostics = buildTaxonomyDiagnostics({
    canonicalTags: tags,
    records,
    evidence,
    candidateProfile: profile,
    markersByTag: Object.fromEntries(markerEntries),
  })

  return {
    categoryCount: categories.length,
    tagCount: tags.length,
    recordCount: records.length,
    evidenceCount: evidence.length,
    hasCandidateProfile: Boolean(profile),
    tagSyncStatus,
    openAnomalyCount: anomalies.filter((anomaly) => !anomaly.resolvedAt).length,
    manifestCount: manifests.length,
    taxonomyDiagnosticIssueCount: taxonomyDiagnosticsIssueCount(diagnostics),
  }
}

export function ReadinessDashboard({ onNavigate }: ReadinessDashboardProps) {
  const [data, setData] = useState<ReadinessData>(emptyReadinessData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const nextData = await loadReadinessData()
      setData(nextData)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load readiness state')
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
        const nextData = await loadReadinessData()
        if (!cancelled) {
          setData(nextData)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load readiness state')
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

  const items = useMemo(() => buildReadinessItems(data), [data])
  const summary = useMemo(() => summarize(items), [items])
  const SummaryIcon = readinessIcon(summary.severity)

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">Readiness</CardTitle>
              <Badge className={cn('border', severityClassName(summary.severity))} variant="outline">
                <SummaryIcon className="mr-1 h-3.5 w-3.5" />
                {summary.label}
              </Badge>
              {!appRuntime.isTauri && (
                <Badge variant="outline">Browser harness</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{summary.detail}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!appRuntime.isTauri && (
          <Alert>
            <AlertDescription>
              Browser mode is a frontend harness. Desktop-only pipeline, import, and artifact features remain unavailable until the app runs in Tauri.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => {
            const Icon = readinessIcon(item.severity)
            return (
              <div key={item.id} className="rounded-lg border bg-background/60 p-3">
                <div className="flex items-start gap-3">
                  <span className={cn('mt-0.5 rounded-full border p-1', severityClassName(item.severity))}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-foreground">{item.label}</div>
                      <div className="text-xs leading-5 text-muted-foreground">{item.detail}</div>
                    </div>
                    {item.actionLabel && item.actionTab && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => onNavigate(item.actionTab!)}
                      >
                        {item.actionLabel}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}