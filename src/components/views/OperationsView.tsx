import { useEffect, useMemo, useState } from 'react'
import { careerService } from '@/lib/service'
import type { Anomaly, Evidence, ExperienceRecord, GenerationManifest } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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

function renderJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export default function OperationsView() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [manifests, setManifests] = useState<GenerationManifest[]>([])
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null)
  const [selectedManifestId, setSelectedManifestId] = useState<string | null>(null)
  const [auditTarget, setAuditTarget] = useState<AnomalyAuditTarget | null>(null)
  const [loading, setLoading] = useState(true)
  const [auditLoading, setAuditLoading] = useState(false)

  const selectedAnomaly = useMemo(
    () => anomalies.find((item) => item.id === selectedAnomalyId) ?? null,
    [anomalies, selectedAnomalyId]
  )

  const selectedManifest = useMemo(
    () => manifests.find((manifest) => manifest.id === selectedManifestId) ?? null,
    [manifests, selectedManifestId]
  )

  const loadData = async () => {
    setLoading(true)
    try {
      const [anomalyData, manifestData] = await Promise.all([
        careerService.getAnomalies(),
        careerService.getGenerationManifests(),
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
          const record = await careerService.getRecord(selectedAnomaly.entityId)
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
          const evidence = await careerService.getEvidence(selectedAnomaly.entityId)
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

          const parentRecord = await careerService.getRecord(evidence.experience_record_id)
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
        await careerService.reopenAnomaly(item.id)
        toast.success('Anomaly reopened')
      } else {
        await careerService.resolveAnomaly(item.id)
        toast.success('Anomaly resolved')
      }
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update anomaly state')
    }
  }

  const handleDeleteAnomaly = async (item: Anomaly) => {
    try {
      await careerService.deleteAnomaly(item.id)
      await loadData()
      toast.success('Anomaly deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete anomaly')
    }
  }

  const handleDeleteManifest = async (item: GenerationManifest) => {
    try {
      await careerService.deleteGenerationManifest(item.id)
      await loadData()
      toast.success('Generation manifest deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete generation manifest')
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

          <Card>
            <CardHeader>
              <CardTitle>Current Anomalies</CardTitle>
            </CardHeader>
            <CardContent>
              {anomalies.length === 0 ? (
                <Alert>
                  <AlertDescription>No anomalies recorded.</AlertDescription>
                </Alert>
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
                    {anomalies.map((item) => (
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
          <Card>
            <CardHeader>
              <CardTitle>Generation Manifests</CardTitle>
            </CardHeader>
            <CardContent>
              {manifests.length === 0 ? (
                <Alert>
                  <AlertDescription>No generation manifests stored yet.</AlertDescription>
                </Alert>
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
                    {manifests.map((item) => (
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

                {selectedManifest.notes && (
                  <div>
                    <div className="font-medium">Notes</div>
                    <div className="mt-1 rounded-md border bg-muted/30 p-3 text-muted-foreground">
                      {selectedManifest.notes}
                    </div>
                  </div>
                )}

                {selectedManifest.selectedRecordIds !== null && (
                  <div>
                    <div className="font-medium">Selected Record Ids</div>
                    <pre className="mt-1 overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs">
                      {renderJson(selectedManifest.selectedRecordIds)}
                    </pre>
                  </div>
                )}

                {selectedManifest.selectedEvidenceIds !== null && (
                  <div>
                    <div className="font-medium">Selected Evidence Ids</div>
                    <pre className="mt-1 overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs">
                      {renderJson(selectedManifest.selectedEvidenceIds)}
                    </pre>
                  </div>
                )}

                {selectedManifest.artifactPaths !== null && (
                  <div>
                    <div className="font-medium">Artifact Paths</div>
                    <pre className="mt-1 overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs">
                      {renderJson(selectedManifest.artifactPaths)}
                    </pre>
                  </div>
                )}

                {selectedManifest.artifactHashes !== null && (
                  <div>
                    <div className="font-medium">Artifact Hashes</div>
                    <pre className="mt-1 overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs">
                      {renderJson(selectedManifest.artifactHashes)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}