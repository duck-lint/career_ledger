import { useState, useMemo, useEffect, useCallback } from 'react'
import { libraryService } from '@/lib/service'
import type { DeleteEvidenceItemsPreview, Evidence, ExperienceRecord } from '@/lib/types'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Plus, FileText, Pencil, Trash2 as Trash, Search as MagnifyingGlass, AlertTriangle as Warning, X } from 'lucide-react'
import { toast } from 'sonner'
import EvidenceDialog from '@/components/dialogs/EvidenceDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type EvidenceSortKey = 'updated_at' | 'claim' | 'date_range'

type EvidenceViewProps = {
  selectedRecordId: string | null
  onRecordSelect: (recordId: string | null) => void
}

export default function EvidenceView({ selectedRecordId, onRecordSelect }: EvidenceViewProps) {
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [records, setRecords] = useState<ExperienceRecord[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [hasLoaded, setHasLoaded] = useState(false)
  const [evidencePendingDelete, setEvidencePendingDelete] = useState<Evidence | null>(null)
  const [sortKey, setSortKey] = useState<EvidenceSortKey>('updated_at')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeletePreview, setBulkDeletePreview] = useState<DeleteEvidenceItemsPreview | null>(null)
  const [bulkDeletePreviewLoading, setBulkDeletePreviewLoading] = useState(false)

  const multiSelectActive = selectedIds.size > 0

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [evidenceData, recordsData] = await Promise.all([
        libraryService.getAllEvidence(),
        libraryService.getRecords(),
      ])
      setEvidence(evidenceData)
      setRecords(recordsData)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load evidence view')
    } finally {
      setHasLoaded(true)
    }
  }

  const selectedRecord = records.find((r) => r.id === selectedRecordId)
  const hasRecords = records.length > 0
  const hasStaleSelection = hasLoaded && selectedRecordId !== null && !selectedRecord

  const filteredEvidence = useMemo(() => {
    let filtered = evidence.filter((e) => e.experience_record_id === selectedRecordId)

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (e) =>
          e.claim.toLowerCase().includes(query) ||
          e.tags.some((t) => t.toLowerCase().includes(query)) ||
          (e.evidence_note && e.evidence_note.toLowerCase().includes(query))
      )
    }

    filtered.sort((a, b) => {
      switch (sortKey) {
        case 'claim':
          return a.claim.localeCompare(b.claim)
        case 'date_range':
          return (a.date_range ?? '').localeCompare(b.date_range ?? '')
        case 'updated_at':
        default:
          return b.updated_at.localeCompare(a.updated_at)
      }
    })

    return filtered
  }, [evidence, selectedRecordId, searchQuery, sortKey])

  const handleCreate = () => {
    setEditingEvidence(null)
    setDialogOpen(true)
  }

  const handleEdit = (item: Evidence) => {
    setEditingEvidence(item)
    setDialogOpen(true)
  }

  const handleDelete = async (item: Evidence) => {
    await libraryService.deleteEvidence(item.id)
    await loadData()
    toast.success('Evidence deleted')
  }

  const resetBulkDeleteState = () => {
    setBulkDeleteOpen(false)
    setBulkDeletePreview(null)
    setBulkDeletePreviewLoading(false)
  }

  const handleSave = async () => {
    await loadData()
    setDialogOpen(false)
  }

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleBulkDelete = async () => {
    try {
      const result = await libraryService.deleteEvidenceItems(Array.from(selectedIds), {
        strict: true,
      })
      setSelectedIds(new Set())
      await loadData()
      toast.success(
        `Deleted ${result.deletedEvidenceCount} evidence item${result.deletedEvidenceCount === 1 ? '' : 's'}`
      )
      resetBulkDeleteState()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete evidence')
    }
  }

  const handleBulkDeleteIntent = async () => {
    if (selectedIds.size === 0) {
      return
    }

    setBulkDeleteOpen(true)
    setBulkDeletePreview(null)
    setBulkDeletePreviewLoading(true)

    try {
      const preview = await libraryService.previewDeleteEvidenceItems(Array.from(selectedIds))
      setBulkDeletePreview(preview)
    } catch (error) {
      resetBulkDeleteState()
      toast.error(error instanceof Error ? error.message : 'Failed to preview evidence deletion')
      return
    }

    setBulkDeletePreviewLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Evidence Items</h2>
          {!hasLoaded ? (
            <p className="text-sm text-muted-foreground mt-1">Loading records and evidence...</p>
          ) : selectedRecord ? (
            <p className="text-sm text-muted-foreground mt-1">
              {filteredEvidence.length} item{filteredEvidence.length !== 1 ? 's' : ''} for{' '}
              <span className="mono">{selectedRecord.slug}</span>
            </p>
          ) : hasRecords ? (
            <p className="text-sm text-muted-foreground mt-1">
              Choose a record to review or add evidence.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              Create a record first, then add supporting evidence.
            </p>
          )}
        </div>
        <div className="flex gap-2 items-center">
          {selectedRecord && (
            <>
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search evidence..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && searchQuery) {
                      e.preventDefault()
                      setSearchQuery('')
                    }
                  }}
                  className="pl-9 pr-9 w-64"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {filteredEvidence.length > 1 && (
                <Select value={sortKey} onValueChange={(v) => setSortKey(v as EvidenceSortKey)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated_at">Last updated</SelectItem>
                    <SelectItem value="claim">Claim</SelectItem>
                    <SelectItem value="date_range">Date range</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {multiSelectActive && (
                <Button variant="destructive" size="sm" onClick={() => void handleBulkDeleteIntent()}>
                  <Trash className="mr-2 h-4 w-4" />
                  Delete {selectedIds.size}
                </Button>
              )}
              <Button onClick={handleCreate}>
                <Plus className="mr-2" />
                New Evidence
              </Button>
            </>
          )}
        </div>
      </div>

      {!hasLoaded && (
        <Alert>
          <AlertDescription>
            Loading records and evidence...
          </AlertDescription>
        </Alert>
      )}

      {hasLoaded && !hasRecords && (
        <Alert>
          <AlertDescription>
            No records exist yet. Create a record in the Records tab before adding evidence.
          </AlertDescription>
        </Alert>
      )}

      {hasRecords && (
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <span className="text-sm text-muted-foreground">Record:</span>
          <Select value={selectedRecord?.id ?? undefined} onValueChange={onRecordSelect}>
            <SelectTrigger className="w-full md:w-[420px]">
              <SelectValue placeholder="Choose a record" />
            </SelectTrigger>
            <SelectContent>
              {records.map((record) => (
                <SelectItem key={record.id} value={record.id}>
                  <span className="mono text-sm">{record.slug}</span>
                  <span className="text-muted-foreground ml-2">- {record.title}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {hasStaleSelection && (
        <Alert variant="destructive">
          <Warning className="h-4 w-4" />
          <AlertDescription>
            The previously selected record is no longer available. Choose a different record to continue.
          </AlertDescription>
        </Alert>
      )}

      {hasLoaded && hasRecords && !selectedRecord && !hasStaleSelection && (
        <Alert>
          <AlertDescription>
            Choose a record from the selector above to review existing evidence or create a new item.
          </AlertDescription>
        </Alert>
      )}

      {selectedRecord && (
        filteredEvidence.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={searchQuery ? 'No matches' : 'No evidence yet'}
            description={
              searchQuery
                ? 'No evidence items match your search. Try a different query or clear the filter.'
                : 'Add your first evidence item for this record to capture claims, tags, and notes.'
            }
            action={
              searchQuery ? (
                <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                  Clear search
                </Button>
              ) : (
                <Button size="sm" onClick={handleCreate}>
                  <Plus className="mr-2" />
                  New evidence
                </Button>
              )
            }
          />
        ) : (
          <div className="space-y-4">
            {filteredEvidence.map((item) => (
              <Card key={item.id} className={selectedIds.has(item.id) ? 'ring-2 ring-primary/40' : ''}>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      aria-label={`Select evidence: ${item.claim.slice(0, 40)}`}
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="mt-1.5 h-4 w-4 rounded border-border accent-primary"
                    />
                    <FileText className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed">{item.claim}</p>
                      {item.date_range && (
                        <p className="mt-1 text-xs text-muted-foreground">{item.date_range}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-3">
                        {item.tags.map((tag) => (
                          <Badge key={tag} variant="mono">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      {item.evidence_note && (
                        <div className="mt-3 p-2 bg-muted rounded text-xs text-muted-foreground">
                          <span className="font-medium">Note:</span> {item.evidence_note}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} aria-label="Edit evidence">
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEvidencePendingDelete(item)} aria-label="Delete evidence">
                        <Trash />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )
      )}

      <ConfirmDialog
        open={evidencePendingDelete !== null}
        onOpenChange={(next) => !next && setEvidencePendingDelete(null)}
        title="Delete evidence item?"
        description={
          <span>
            This permanently removes the evidence entry
            {evidencePendingDelete?.claim ? (
              <>
                {' '}&mdash;{' '}
                <span className="mono text-xs text-foreground">
                  {evidencePendingDelete.claim.slice(0, 80)}
                  {evidencePendingDelete.claim.length > 80 ? '\u2026' : ''}
                </span>
              </>
            ) : null}
            . Records and other evidence are unaffected.
          </span>
        }
        confirmLabel="Delete evidence"
        destructive
        onConfirm={async () => {
          if (!evidencePendingDelete) return
          try {
            await handleDelete(evidencePendingDelete)
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete evidence')
            throw error
          }
        }}
      />

      {selectedRecord && (
        <EvidenceDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          evidence={editingEvidence}
          recordId={selectedRecord.id}
          onSave={handleSave}
        />
      )}

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(next) => {
          if (!next) {
            resetBulkDeleteState()
            return
          }

          setBulkDeleteOpen(true)
        }}
        title={`Delete ${selectedIds.size} evidence item${selectedIds.size === 1 ? '' : 's'}?`}
        description={
          <div className="space-y-3">
            <p>This permanently removes the selected evidence items. Records are unaffected.</p>
            <Alert>
              <AlertDescription>
                {bulkDeletePreviewLoading
                  ? 'Loading evidence delete preview...'
                  : bulkDeletePreview?.missingIds.length
                    ? `Strict batch delete is blocked because ${bulkDeletePreview.missingIds.length} selected evidence item id${bulkDeletePreview.missingIds.length === 1 ? ' is' : 's are'} missing: ${bulkDeletePreview.missingIds.join(', ')}`
                    : bulkDeletePreview
                      ? `Preview loaded for ${bulkDeletePreview.foundCount} evidence item${bulkDeletePreview.foundCount === 1 ? '' : 's'} across ${new Set(bulkDeletePreview.evidenceItems.map((item) => item.recordSlug ?? item.experienceRecordId)).size} record${new Set(bulkDeletePreview.evidenceItems.map((item) => item.recordSlug ?? item.experienceRecordId)).size === 1 ? '' : 's'}.`
                      : 'Preview unavailable.'}
              </AlertDescription>
            </Alert>
            {bulkDeletePreview && bulkDeletePreview.evidenceItems.length > 0 && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <div className="space-y-1">
                  {bulkDeletePreview.evidenceItems.slice(0, 3).map((item) => (
                    <div key={item.id}>
                      <span className="mono text-foreground">{item.recordSlug ?? item.experienceRecordId}</span>
                      {' · '}
                      {item.claim.slice(0, 72)}
                      {item.claim.length > 72 ? '...' : ''}
                    </div>
                  ))}
                  {bulkDeletePreview.evidenceItems.length > 3 && (
                    <div>
                      + {bulkDeletePreview.evidenceItems.length - 3} more selected evidence item{bulkDeletePreview.evidenceItems.length - 3 === 1 ? '' : 's'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        }
        confirmLabel={`Delete ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}`}
        confirmDisabled={
          bulkDeletePreviewLoading ||
          !bulkDeletePreview ||
          bulkDeletePreview.foundCount === 0 ||
          bulkDeletePreview.missingIds.length > 0
        }
        destructive
        onConfirm={handleBulkDelete}
      />
    </div>
  )
}
