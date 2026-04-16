import { useEffect, useRef, useState, type ReactNode } from 'react'
import { careerService } from '@/lib/service'
import type {
  Evidence,
  EvidenceFormData,
  EvidenceInferenceComparison,
  EvidenceSaveDecision,
  EvidenceValueSource,
} from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import { AlertTriangle as Warning } from 'lucide-react'

type EvidenceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  evidence: Evidence | null
  recordId: string
  onSave: () => Promise<void> | void
}

function parseList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildDefaultDecision(
  comparison: EvidenceInferenceComparison
): EvidenceSaveDecision {
  return {
    tagsSource:
      comparison.inferredTags.length > 0 &&
      (comparison.manualTags.length === 0 || comparison.unknownManualTags.length > 0)
        ? 'inferred'
        : 'manual',
  }
}

function ChoiceBlock({
  title,
  selected,
  onSelect,
  disabledManual,
  disabledInferred,
  manualLabel,
  inferredLabel,
}: {
  title: string
  selected: EvidenceValueSource
  onSelect: (value: EvidenceValueSource) => void
  disabledManual?: boolean
  disabledInferred?: boolean
  manualLabel: ReactNode
  inferredLabel: ReactNode
}) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="text-sm font-medium">{title}</div>
      <RadioGroup value={selected} onValueChange={(value) => onSelect(value as EvidenceValueSource)}>
        <div className="space-y-2 rounded-md border border-border/70 p-3">
          <div className="flex items-start gap-3">
            <RadioGroupItem value="manual" id={`${title}-manual`} disabled={disabledManual} />
            <div className="space-y-1">
              <Label htmlFor={`${title}-manual`} className={disabledManual ? 'text-muted-foreground' : ''}>
                Keep manual value
              </Label>
              <div className="text-xs text-muted-foreground">{manualLabel}</div>
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-md border border-border/70 p-3">
          <div className="flex items-start gap-3">
            <RadioGroupItem value="inferred" id={`${title}-inferred`} disabled={disabledInferred} />
            <div className="space-y-1">
              <Label htmlFor={`${title}-inferred`} className={disabledInferred ? 'text-muted-foreground' : ''}>
                Use inferred value
              </Label>
              <div className="text-xs text-muted-foreground">{inferredLabel}</div>
            </div>
          </div>
        </div>
      </RadioGroup>
    </div>
  )
}

export default function EvidenceDialog({
  open,
  onOpenChange,
  evidence,
  recordId,
  onSave,
}: EvidenceDialogProps) {
  const [claim, setClaim] = useState('')
  const [dateRange, setDateRange] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [evidenceNote, setEvidenceNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<EvidenceInferenceComparison | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingData, setPendingData] = useState<EvidenceFormData | null>(null)
  const [pendingComparison, setPendingComparison] = useState<EvidenceInferenceComparison | null>(null)
  const [decision, setDecision] = useState<EvidenceSaveDecision>({
    tagsSource: 'manual',
  })
  const snapshotRef = useRef('')

  const formFingerprint = () => JSON.stringify([claim, dateRange, tagsInput, evidenceNote])

  const buildFormData = (): EvidenceFormData => ({
    claim: claim.trim(),
    date_range: dateRange.trim() || null,
    tags: parseList(tagsInput),
    evidence_note: evidenceNote.trim() || null,
  })

  useEffect(() => {
    if (evidence) {
      setClaim(evidence.claim)
      setDateRange(evidence.date_range || '')
      setTagsInput(evidence.tags.join(', '))
      setEvidenceNote(evidence.evidence_note || '')
    } else {
      setClaim('')
      setDateRange('')
      setTagsInput('')
      setEvidenceNote('')
    }

    setErrors({})
    setPreview(null)
    setPreviewError(null)
    setConfirmOpen(false)
    setPendingData(null)
    setPendingComparison(null)
    setDecision({ tagsSource: 'manual' })
    queueMicrotask(() => {
      snapshotRef.current = evidence
        ? JSON.stringify([evidence.claim, evidence.date_range || '', evidence.tags.join(', '), evidence.evidence_note || ''])
        : JSON.stringify(['', '', '', ''])
    })
  }, [evidence, open])

  const isDirty = () => formFingerprint() !== snapshotRef.current

  const guardedOpenChange = (next: boolean) => {
    if (!next && isDirty()) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return
    }
    onOpenChange(next)
  }

  useEffect(() => {
    if (!open) {
      return
    }

    const data = buildFormData()
    if (
      !data.claim &&
      data.tags.length === 0 &&
      !data.evidence_note
    ) {
      setPreview(null)
      setPreviewError(null)
      return
    }

    let cancelled = false
    setPreviewLoading(true)

    careerService
      .previewEvidenceInference(recordId, data)
      .then((result) => {
        if (!cancelled) {
          setPreview(result)
          setPreviewError(null)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPreview(null)
          setPreviewError(error instanceof Error ? error.message : 'Failed to preview inference')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, recordId, claim, dateRange, tagsInput, evidenceNote])

  const validate = () => {
    const nextErrors: Record<string, string> = {}

    if (!claim.trim()) {
      nextErrors.claim = 'Claim is required'
    }

    if (preview && preview.manualTags.length === 0 && preview.inferredTags.length === 0) {
      nextErrors.tags =
        'Add manual tags or revise the claim text so inference resolves at least one canonical tag.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const persistEvidence = async (
    data: EvidenceFormData,
    selectedDecision?: EvidenceSaveDecision
  ) => {
    return evidence
      ? careerService.updateEvidence(evidence.id, data, selectedDecision)
      : careerService.createEvidence(recordId, data, selectedDecision)
  }

  const finalizeSave = async (data: EvidenceFormData, selectedDecision?: EvidenceSaveDecision) => {
    const result = await persistEvidence(data, selectedDecision)

    if (result.status === 'confirmation_required') {
      setPendingData(data)
      setPendingComparison(result.comparison)
      setDecision(buildDefaultDecision(result.comparison))
      setConfirmOpen(true)
      return false
    }

    if (!result.evidence) {
      throw new Error('Evidence save completed without a returned evidence item.')
    }

    toast.success(evidence ? 'Evidence updated' : 'Evidence created')
    await onSave()
    return true
  }

  const handleSave = async () => {
    if (!validate()) {
      return
    }

    setSaving(true)
    try {
      await finalizeSave(buildFormData())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save evidence')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmSave = async () => {
    if (!pendingData) {
      return
    }

    setSaving(true)
    try {
      const saved = await finalizeSave(pendingData, decision)
      if (saved) {
        setConfirmOpen(false)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save evidence')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={guardedOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{evidence ? 'Edit Evidence' : 'New Evidence'}</DialogTitle>
            <DialogDescription>
              {evidence
                ? 'Update the evidence item details and confirm any inference changes.'
                : 'Create a new evidence item with live inference preview.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="claim">
                Claim <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="claim"
                value={claim}
                onChange={(event) => setClaim(event.target.value)}
                placeholder="Enter the claim text..."
                rows={3}
                className={errors.claim ? 'border-destructive' : ''}
              />
              {errors.claim && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <Warning className="h-3 w-3" />
                  {errors.claim}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Manual Tags</Label>
              <Input
                id="tags"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                placeholder="tag1, tag2, tag3"
                className={errors.tags ? 'border-destructive' : ''}
              />
              <p className="text-xs text-muted-foreground">
                Optional manual tags. If they diverge from inferred tags, the save flow will ask which set to keep.
              </p>
              {errors.tags && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <Warning className="h-3 w-3" />
                  {errors.tags}
                </p>
              )}
              {preview && preview.manualTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {preview.manualTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="mono text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              {preview && preview.unknownManualTags.length > 0 && (
                <Alert variant="destructive">
                  <Warning className="h-4 w-4" />
                  <AlertDescription>
                    Unknown manual tags: {preview.unknownManualTags.join(', ')}. You can still save by choosing inferred tags if the suggestion is valid.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateRange">Date Range</Label>
                <Input
                  id="dateRange"
                  value={dateRange}
                  onChange={(event) => setDateRange(event.target.value)}
                  placeholder="e.g., 2024-01 to 2024-06"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="evidenceNote">Evidence Note</Label>
                <Textarea
                  id="evidenceNote"
                  value={evidenceNote}
                  onChange={(event) => setEvidenceNote(event.target.value)}
                  placeholder="Optional note about this evidence..."
                  rows={2}
                />
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div>
                <h4 className="text-sm font-medium">Inference Preview</h4>
                <p className="text-xs text-muted-foreground">
                  Preview updates as you edit. Confirmation is only required when manual and inferred values differ.
                </p>
              </div>

              {previewLoading && (
                <Alert>
                  <AlertDescription>Refreshing inference preview…</AlertDescription>
                </Alert>
              )}

              {previewError && (
                <Alert variant="destructive">
                  <Warning className="h-4 w-4" />
                  <AlertDescription>{previewError}</AlertDescription>
                </Alert>
              )}

              {preview && !previewLoading && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Tags</div>
                      <Badge variant={preview.tagsMatch ? 'secondary' : 'default'}>
                        {preview.tagsMatch ? 'Aligned' : 'Review required'}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div>
                        <div className="mb-1 font-medium text-foreground">Manual</div>
                        <div className="flex flex-wrap gap-1">
                          {preview.manualTags.length > 0 ? (
                            preview.manualTags.map((tag) => (
                              <Badge key={`manual-${tag}`} variant="outline" className="mono text-xs">
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <span>None</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 font-medium text-foreground">Inferred</div>
                        <div className="flex flex-wrap gap-1">
                          {preview.inferredTags.length > 0 ? (
                            preview.inferredTags.map((tag) => (
                              <Badge key={`inferred-${tag}`} variant="secondary" className="mono text-xs">
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <span>None</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || previewLoading}>
              {evidence ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm inferred evidence values</AlertDialogTitle>
            <AlertDialogDescription>
              Manual and inferred values differ. Choose which version to persist for each field.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingComparison && (
            <div className="space-y-4">
              <ChoiceBlock
                title="Tags"
                selected={decision.tagsSource ?? 'manual'}
                onSelect={(value) => setDecision((current) => ({ ...current, tagsSource: value }))}
                disabledManual={pendingComparison.unknownManualTags.length > 0}
                disabledInferred={pendingComparison.inferredTags.length === 0}
                manualLabel={
                  pendingComparison.manualTags.length > 0
                    ? pendingComparison.manualTags.join(', ')
                    : pendingComparison.unknownManualTags.length > 0
                      ? `Unavailable because of unknown tags: ${pendingComparison.unknownManualTags.join(', ')}`
                      : 'No manual tags'
                }
                inferredLabel={
                  pendingComparison.inferredTags.length > 0
                    ? pendingComparison.inferredTags.join(', ')
                    : 'No inferred tags available'
                }
              />

            </div>
          )}

          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSave} disabled={saving}>
              Save with selected values
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}