import { useEffect, useMemo, useState } from 'react'
import { libraryService, operationsService } from '@/lib/service'
import { ResumeGapReportPanel } from '@/components/resume/ResumeAuditPanels'
import type {
  Anomaly,
  Evidence,
  ExperienceRecord,
  GapReport,
  GenerationManifestArtifactMap,
  GenerationManifest,
  RequirementReviewOverride,
} from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/EmptyState'
import { AlertTriangle, FileText, Search as MagnifyingGlass, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type AnomalyStatusFilter = 'all' | 'open' | 'resolved'
type AnomalySeverityFilter = 'all' | 'error' | 'warning' | 'info'

type AnomalyAuditTarget =
  | {
      kind: 'record'
      record: ExperienceRecord
    }
  | {
      kind: 'evidence'
      evidence: Evidence
      parentRecord: ExperienceRecord | null
    }
  | {
      kind: 'missing'
      message: string
    }
  | {
      kind: 'unsupported'
      message: string
    }

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'n/a'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

function formatShortHash(value: string): string {
  if (value.length <= 20) {
    return value
  }

  return `${value.slice(0, 12)}...${value.slice(-8)}`
}

function formatManifestArtifactLabel(value: string): string {
  return value
    .split('_')
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ')
    .replace(/Json/g, 'JSON')
    .replace(/Docx/g, 'DOCX')
}

function ManifestTokenList({
  title,
  values,
  emptyLabel,
}: {
  title: string
  values: string[]
  emptyLabel: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="font-medium">{title}</div>
        <Badge variant="outline">{values.length}</Badge>
      </div>
      {values.length === 0 ? (
        <div className="text-muted-foreground">{emptyLabel}</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {values.map((value) => (
            <Badge key={value} variant="secondary" className="mono text-xs">
              {value}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function ManifestArtifactFiles({
  paths,
  hashes,
}: {
  paths: GenerationManifestArtifactMap | null
  hashes: GenerationManifestArtifactMap | null
}) {
  const artifactEntries = [
    {
      key: 'assembled_json',
      path: paths?.assembled_json ?? null,
      hash: hashes?.assembled_json ?? null,
    },
    {
      key: 'bundle_json',
      path: paths?.bundle_json ?? null,
      hash: hashes?.bundle_json ?? null,
    },
    {
      key: 'rendered_docx',
      path: paths?.rendered_docx ?? null,
      hash: hashes?.rendered_docx ?? null,
    },
  ].filter((entry) => entry.path || entry.hash)

  if (artifactEntries.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <div className="font-medium">Artifact Outputs</div>
      <div className="grid gap-3 xl:grid-cols-2">
        {artifactEntries.map((artifactEntry) => (
          <div key={artifactEntry.key} className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="font-medium">{formatManifestArtifactLabel(artifactEntry.key)}</div>
            {artifactEntry.path && (
              <div className="break-all text-muted-foreground">{artifactEntry.path}</div>
            )}
            {artifactEntry.hash && (
              <div className="text-xs text-muted-foreground">SHA256: {formatShortHash(artifactEntry.hash)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ManifestRequirementReviewSummary({ review }: { review: RequirementReviewOverride }) {
  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <div className="font-medium">Requirement Review</div>
        <Badge variant="outline">{review.noise_terms.length} noise</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <div className="text-sm text-muted-foreground">Reviewed clusters</div>
          <div className="font-medium">{review.reviewed_cluster_ids.length}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Excluded clusters</div>
          <div className="font-medium">{review.excluded_cluster_ids.length}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Useful terms</div>
          <div className="font-medium">{review.useful_terms.length}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Noise terms</div>
          <div className="font-medium">{review.noise_terms.length}</div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground break-all">
        Source posting SHA256: {review.source_job_posting_sha256}
      </div>
      <ManifestTokenList
        title="Useful Terms"
        values={review.useful_terms}
        emptyLabel="No useful terms were recorded for this manifest."
      />
      <ManifestTokenList
        title="Noise Terms"
        values={review.noise_terms}
        emptyLabel="No noise terms were recorded for this manifest."
      />
      <ManifestTokenList
        title="Excluded Cluster IDs"
        values={review.excluded_cluster_ids}
        emptyLabel="No clusters were excluded for this manifest."
      />
    </div>
  )
}

export default function OperationsView() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [manifests, setManifests] = useState<GenerationManifest[]>([])
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null)
  const [selectedManifestId, setSelectedManifestId] = useState<string | null>(null)
  const [auditTarget, setAuditTarget] = useState<AnomalyAuditTarget | null>(null)
  const [loading, setLoading] = useState(true)
  const [auditLoading, setAuditLoading] = useState(false)
  const [anomalyStatusFilter, setAnomalyStatusFilter] = useState<AnomalyStatusFilter>('all')
  const [anomalySeverityFilter, setAnomalySeverityFilter] = useState<AnomalySeverityFilter>('all')
  const [anomalySearch, setAnomalySearch] = useState('')
  const [manifestSearch, setManifestSearch] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)

  const filteredAnomalies = useMemo(() => {
    let filtered = anomalies

    if (anomalyStatusFilter === 'open') filtered = filtered.filter((a) => !a.resolvedAt)
    else if (anomalyStatusFilter === 'resolved') filtered = filtered.filter((a) => a.resolvedAt)

    if (anomalySeverityFilter !== 'all') {
      filtered = filtered.filter((a) => a.severity === anomalySeverityFilter)
    }

    if (anomalySearch.trim()) {
      const q = anomalySearch.toLowerCase()
      filtered = filtered.filter(
        (a) =>
          a.message.toLowerCase().includes(q) ||
          a.anomalyCode.toLowerCase().includes(q) ||
          a.entityType.toLowerCase().includes(q)
      )
    }

    return filtered
  }, [anomalies, anomalyStatusFilter, anomalySeverityFilter, anomalySearch])

  const filteredManifests = useMemo(() => {
    if (!manifestSearch.trim()) return manifests
    const q = manifestSearch.toLowerCase()
    return manifests.filter(
      (m) =>
        (m.targetRoleFamily && m.targetRoleFamily.toLowerCase().includes(q)) ||
        m.artifactKind.toLowerCase().includes(q) ||
        (m.notes && m.notes.toLowerCase().includes(q))
    )
  }, [manifests, manifestSearch])

  const selectedAnomaly = useMemo(
    () => anomalies.find((item) => item.id === selectedAnomalyId) ?? null,
    [anomalies, selectedAnomalyId]
  )

  const selectedManifest = useMemo(
    () => manifests.find((manifest) => manifest.id === selectedManifestId) ?? null,
    [manifests, selectedManifestId]
  )
  const selectedManifestRecordIds = useMemo(
    () => selectedManifest?.selectedRecordIds ?? [],
    [selectedManifest]
  )
  const selectedManifestEvidenceIds = useMemo(
    () => selectedManifest?.selectedEvidenceIds ?? [],
    [selectedManifest]
  )
  const selectedManifestArtifactPaths = useMemo(
    () => selectedManifest?.artifactPaths ?? null,
    [selectedManifest]
  )
  const selectedManifestArtifactHashes = useMemo(
    () => selectedManifest?.artifactHashes ?? null,
    [selectedManifest]
  )
  const selectedManifestGapReport = useMemo(
    () => selectedManifest?.gapReport ?? null,
    [selectedManifest]
  )
  const selectedManifestRequirementReview = useMemo(
    () => selectedManifest?.requirementReview ?? null,
    [selectedManifest]
  )

  const loadData = async () => {
    setLoading(true)
    try {
      const [anomalyData, manifestData] = await Promise.all([
        operationsService.getAnomalies(),
        operationsService.getGenerationManifests(),
      ])
      setAnomalies(anomalyData)
      setManifests(manifestData)
      setSelectedAnomalyId((current) => {
        if (current && anomalyData.some((item) => item.id === current)) {
          return current
        }
        return anomalyData[0]?.id ?? null
      })
      setSelectedManifestId((current) => {
        if (current && manifestData.some((manifest) => manifest.id === current)) {
          return current
        }
        return manifestData[0]?.id ?? null
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load operations data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadAuditTarget = async () => {
      if (!selectedAnomaly) {
        setAuditTarget(null)
        setAuditLoading(false)
        return
      }

      setAuditLoading(true)

      try {
        if (selectedAnomaly.entityType === 'experience_record') {
          const record = await libraryService.getRecord(selectedAnomaly.entityId)
          if (cancelled) {
            return
          }

          setAuditTarget(
            record
              ? { kind: 'record', record }
              : {
                  kind: 'missing',
                  message: `Experience record ${selectedAnomaly.entityId} no longer exists.`,
                }
          )
          return
        }

        if (selectedAnomaly.entityType === 'evidence_item') {
          const evidence = await libraryService.getEvidence(selectedAnomaly.entityId)
          if (cancelled) {
            return
          }

          if (!evidence) {
            setAuditTarget({
              kind: 'missing',
              message: `Evidence item ${selectedAnomaly.entityId} no longer exists.`,
            })
            return
          }

          const parentRecord = await libraryService.getRecord(evidence.experience_record_id)
          if (cancelled) {
            return
          }

          setAuditTarget({ kind: 'evidence', evidence, parentRecord: parentRecord ?? null })
          return
        }

        setAuditTarget({
          kind: 'unsupported',
          message:
            selectedAnomaly.entityType === 'requirement_analysis'
              ? 'This anomaly points at generated requirement analysis, not a library entity.'
              : `No linked library drill-through is available for ${selectedAnomaly.entityType}.`,
        })
      } catch (error) {
        if (!cancelled) {
          setAuditTarget({
            kind: 'missing',
            message: error instanceof Error ? error.message : 'Failed to load linked entity',
          })
        }
      } finally {
        if (!cancelled) {
          setAuditLoading(false)
        }
      }
    }

    void loadAuditTarget()

    return () => {
      cancelled = true
    }
  }, [selectedAnomaly])

  const handleToggleAnomaly = async (item: Anomaly) => {
    try {
      if (item.resolvedAt) {
        await operationsService.reopenAnomaly(item.id)
        toast.success('Anomaly reopened')
      } else {
        await operationsService.resolveAnomaly(item.id)
        toast.success('Anomaly resolved')
      }
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update anomaly state')
    }
  }

  const handleDeleteAnomaly = async (item: Anomaly) => {
    try {
      await operationsService.deleteAnomaly(item.id)
      await loadData()
      toast.success('Anomaly deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete anomaly')
    }
  }

  const handleDeleteManifest = async (item: GenerationManifest) => {
    try {
      await operationsService.deleteGenerationManifest(item.id)
      await loadData()
      toast.success('Generation manifest deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete generation manifest')
    }
  }

  const handleStartEditNotes = () => {
    setNotesDraft(selectedManifest?.notes ?? '')
    setEditingNotes(true)
  }

  const handleSaveNotes = async () => {
    if (!selectedManifest) return
    setNotesSaving(true)
    try {
      const trimmed = notesDraft.trim()
      await operationsService.updateManifestNotes(selectedManifest.id, trimmed || null)
      await loadData()
      setEditingNotes(false)
      toast.success('Notes updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save notes')
    } finally {
      setNotesSaving(false)
    }
  }

  const renderAuditTarget = () => {
    if (auditLoading) {
      return (
        <Alert>
          <AlertDescription>Loading linked entity drill-through...</AlertDescription>
        </Alert>
      )
    }

    if (!auditTarget) {
      return null
    }

    if (auditTarget.kind === 'missing' || auditTarget.kind === 'unsupported') {
      return (
        <Alert>
          <AlertDescription>{auditTarget.message}</AlertDescription>
        </Alert>
      )
    }

    if (auditTarget.kind === 'record') {
      return (
        <div className="space-y-3 text-sm">
          <div className="font-medium">Linked Record</div>
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="font-medium">{auditTarget.record.title}</div>
            <div className="text-muted-foreground">{auditTarget.record.organization}</div>
            <div className="text-muted-foreground">
              {auditTarget.record.start_date} → {auditTarget.record.end_date}
            </div>
            {auditTarget.record.context_tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {auditTarget.record.context_tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="mono text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-4 text-sm">
        <div className="space-y-3">
          <div className="font-medium">Linked Evidence</div>
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div>{auditTarget.evidence.claim}</div>
            <div className="text-muted-foreground">
              Date Range: {auditTarget.evidence.date_range ?? 'n/a'}
            </div>
            {auditTarget.evidence.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {auditTarget.evidence.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="mono text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            {auditTarget.evidence.evidence_note && (
              <div className="text-muted-foreground">{auditTarget.evidence.evidence_note}</div>
            )}
          </div>
        </div>

        {auditTarget.parentRecord ? (
          <div className="space-y-3">
            <div className="font-medium">Parent Record</div>
            <div className="rounded-md border bg-muted/30 p-3 space-y-1">
              <div className="font-medium">{auditTarget.parentRecord.title}</div>
              <div className="text-muted-foreground">{auditTarget.parentRecord.organization}</div>
              <div className="text-muted-foreground mono">{auditTarget.parentRecord.slug}</div>
            </div>
          </div>
        ) : (
          <Alert>
            <AlertDescription>
              The linked evidence still exists, but its parent record no longer does.
            </AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Operations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Inspect system-generated anomalies and previously generated manifest records.
        </p>
      </div>

      {loading && (
        <Alert>
          <AlertDescription>Loading operations state...</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="anomalies">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
          <TabsTrigger value="manifests">Generation Manifests</TabsTrigger>
        </TabsList>

        <TabsContent value="anomalies" className="mt-0 space-y-6">
          <Alert>
            <AlertDescription>
              Anomalies are generated by import and assembly workflows. Manual anomaly authoring is intentionally disabled; use the audit panel to inspect linked library entities.
            </AlertDescription>
          </Alert>

          {anomalies.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={anomalyStatusFilter} onValueChange={(v) => setAnomalyStatusFilter(v as AnomalyStatusFilter)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <Select value={anomalySeverityFilter} onValueChange={(v) => setAnomalySeverityFilter(v as AnomalySeverityFilter)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1 min-w-[200px] max-w-[320px]">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search anomalies..."
                  value={anomalySearch}
                  onChange={(e) => setAnomalySearch(e.target.value)}
                  className="pl-9 pr-9"
                />
                {anomalySearch && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setAnomalySearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Current Anomalies</CardTitle>
            </CardHeader>
            <CardContent>
              {anomalies.length === 0 ? (
                <EmptyState
                  icon={AlertTriangle}
                  title="No anomalies detected"
                  description="System anomalies appear here after import and assembly workflows flag data-quality issues."
                />
              ) : filteredAnomalies.length === 0 ? (
                <EmptyState
                  icon={AlertTriangle}
                  title="No matching anomalies"
                  description="Try adjusting your filters or clearing the search."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-48">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnomalies.map((item) => (
                      <TableRow
                        key={item.id}
                        className={cn('cursor-pointer', selectedAnomalyId === item.id && 'bg-muted/40')}
                        onClick={() => setSelectedAnomalyId(item.id)}
                      >
                        <TableCell>
                          <Badge variant={item.resolvedAt ? 'outline' : 'default'}>{item.severity}</Badge>
                        </TableCell>
                        <TableCell className="mono text-xs">{item.anomalyCode}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div>{item.entityType}</div>
                          <div className="mono">{item.entityId}</div>
                        </TableCell>
                        <TableCell>{item.message}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.resolvedAt
                            ? `Resolved ${formatDateTime(item.resolvedAt)}`
                            : `Open since ${formatDateTime(item.detectedAt)}`}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleToggleAnomaly(item)
                              }}
                            >
                              {item.resolvedAt ? 'Reopen' : 'Resolve'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleDeleteAnomaly(item)
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {selectedAnomaly && (
            <Card>
              <CardHeader>
                <CardTitle>Anomaly Audit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <div className="font-medium">Code</div>
                    <div className="text-muted-foreground mono">{selectedAnomaly.anomalyCode}</div>
                  </div>
                  <div>
                    <div className="font-medium">Severity</div>
                    <div className="text-muted-foreground">{selectedAnomaly.severity}</div>
                  </div>
                  <div>
                    <div className="font-medium">Entity Type</div>
                    <div className="text-muted-foreground">{selectedAnomaly.entityType}</div>
                  </div>
                  <div>
                    <div className="font-medium">Entity Id</div>
                    <div className="text-muted-foreground mono">{selectedAnomaly.entityId}</div>
                  </div>
                </div>

                <div>
                  <div className="font-medium">Message</div>
                  <div className="mt-1 rounded-md border bg-muted/30 p-3 text-muted-foreground">
                    {selectedAnomaly.message}
                  </div>
                </div>

                {renderAuditTarget()}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="manifests" className="mt-0 space-y-6">
          {manifests.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-[320px]">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search manifests..."
                  value={manifestSearch}
                  onChange={(e) => setManifestSearch(e.target.value)}
                  className="pl-9 pr-9"
                />
                {manifestSearch && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setManifestSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Generation Manifests</CardTitle>
            </CardHeader>
            <CardContent>
              {manifests.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No generation manifests"
                  description="Manifests are created each time you run the resume pipeline with persistence enabled."
                />
              ) : filteredManifests.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No matching manifests"
                  description="Try adjusting your search query."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artifact</TableHead>
                      <TableHead>Target Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredManifests.map((item) => (
                      <TableRow
                        key={item.id}
                        className={cn('cursor-pointer', selectedManifestId === item.id && 'bg-muted/40')}
                        onClick={() => setSelectedManifestId(item.id)}
                      >
                        <TableCell>{item.artifactKind}</TableCell>
                        <TableCell>{item.targetRoleFamily ?? 'n/a'}</TableCell>
                        <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleDeleteManifest(item)
                            }}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {selectedManifest && (
            <>
            <Card>
              <CardHeader>
                <CardTitle>Manifest Detail</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <div className="font-medium">Artifact Kind</div>
                    <div className="text-muted-foreground">{selectedManifest.artifactKind}</div>
                  </div>
                  <div>
                    <div className="font-medium">Created</div>
                    <div className="text-muted-foreground">{formatDateTime(selectedManifest.createdAt)}</div>
                  </div>
                  <div>
                    <div className="font-medium">Target Role</div>
                    <div className="text-muted-foreground">{selectedManifest.targetRoleFamily ?? 'n/a'}</div>
                  </div>
                  <div>
                    <div className="font-medium">Job Posting Path</div>
                    <div className="break-all text-muted-foreground">
                      {selectedManifest.jobPostingPath ?? 'n/a'}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <ManifestTokenList
                    title="Selected Records"
                    values={selectedManifestRecordIds ?? []}
                    emptyLabel="No selected record ids were recorded for this manifest."
                  />
                  <ManifestTokenList
                    title="Selected Evidence"
                    values={selectedManifestEvidenceIds ?? []}
                    emptyLabel="No selected evidence ids were recorded for this manifest."
                  />
                </div>

                {selectedManifest.notes && !editingNotes && (
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">Notes</div>
                      <Button variant="ghost" size="sm" onClick={handleStartEditNotes}>
                        Edit
                      </Button>
                    </div>
                    <div className="mt-1 rounded-md border bg-muted/30 p-3 text-muted-foreground">
                      {selectedManifest.notes}
                    </div>
                  </div>
                )}

                {!selectedManifest.notes && !editingNotes && (
                  <Button variant="outline" size="sm" onClick={handleStartEditNotes}>
                    Add notes
                  </Button>
                )}

                {editingNotes && (
                  <div className="space-y-2">
                    <div className="font-medium">Notes</div>
                    <Textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      rows={3}
                      placeholder="Add notes about this generation run..."
                      disabled={notesSaving}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void handleSaveNotes()} disabled={notesSaving}>
                        {notesSaving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditingNotes(false)} disabled={notesSaving}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {(selectedManifestArtifactPaths || selectedManifestArtifactHashes) && (
                  <ManifestArtifactFiles
                    paths={selectedManifestArtifactPaths}
                    hashes={selectedManifestArtifactHashes}
                  />
                )}

                {selectedManifestRequirementReview && (
                  <ManifestRequirementReviewSummary review={selectedManifestRequirementReview} />
                )}
              </CardContent>
            </Card>
            {selectedManifestGapReport && <ResumeGapReportPanel gapReport={selectedManifestGapReport} />}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}