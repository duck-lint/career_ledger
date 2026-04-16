import { useState, useEffect, useMemo, useCallback } from 'react'
import { careerService } from '@/lib/service'
import type { ExperienceRecord } from '@/lib/types'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Briefcase, FolderOpen, Pencil, Trash2 as Trash } from 'lucide-react'
import { toast } from 'sonner'
import RecordDialog from '@/components/dialogs/RecordDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/EmptyState'
import { cn } from '@/lib/utils'

type SortKey = 'title' | 'organization' | 'start_date' | 'updated_at'

type RecordsViewProps = {
  selectedRecordId: string | null
  onRecordSelect: (recordId: string | null) => void
}

export default function RecordsView({ selectedRecordId, onRecordSelect }: RecordsViewProps) {
  const [records, setRecords] = useState<ExperienceRecord[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<ExperienceRecord | null>(null)
  const [recordPendingDelete, setRecordPendingDelete] = useState<ExperienceRecord | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteEvidenceCount, setDeleteEvidenceCount] = useState(0)
  const [deleteDetailsLoading, setDeleteDetailsLoading] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('updated_at')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleteSubmitting, setBulkDeleteSubmitting] = useState(false)

  const multiSelectActive = selectedIds.size > 0

  useEffect(() => {
    loadRecords()
  }, [])

  const loadRecords = async () => {
    const data = await careerService.getRecords()
    setRecords(data)
  }

  const sortedRecords = useMemo(() => {
    const sorted = [...records]
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'title':
          return a.title.localeCompare(b.title)
        case 'organization':
          return a.organization.localeCompare(b.organization)
        case 'start_date':
          return a.start_date.localeCompare(b.start_date)
        case 'updated_at':
        default:
          return b.updated_at.localeCompare(a.updated_at)
      }
    })
    return sorted
  }, [records, sortKey])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleBulkDelete = async () => {
    setBulkDeleteSubmitting(true)
    try {
      for (const id of selectedIds) {
        await careerService.deleteRecord(id)
      }
      const count = selectedIds.size
      if (selectedRecordId && selectedIds.has(selectedRecordId)) {
        onRecordSelect(null)
      }
      setSelectedIds(new Set())
      await loadRecords()
      toast.success(`Deleted ${count} record${count === 1 ? '' : 's'}`)
      setBulkDeleteOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete records')
    } finally {
      setBulkDeleteSubmitting(false)
    }
  }

  const handleCreate = () => {
    setEditingRecord(null)
    setDialogOpen(true)
  }

  const handleEdit = (record: ExperienceRecord) => {
    setEditingRecord(record)
    setDialogOpen(true)
  }

  const resetDeleteState = () => {
    setRecordPendingDelete(null)
    setDeleteDialogOpen(false)
    setDeleteEvidenceCount(0)
    setDeleteDetailsLoading(false)
    setDeleteSubmitting(false)
  }

  const handleDeleteIntent = async (record: ExperienceRecord) => {
    setRecordPendingDelete(record)
    setDeleteDialogOpen(true)
    setDeleteEvidenceCount(0)
    setDeleteDetailsLoading(true)

    try {
      const linkedEvidence = await careerService.getEvidenceForRecord(record.id)
      setDeleteEvidenceCount(linkedEvidence.length)
    } catch (error) {
      resetDeleteState()
      toast.error(error instanceof Error ? error.message : 'Failed to load linked evidence')
      return
    }

    setDeleteDetailsLoading(false)
  }

  const handleDelete = async () => {
    if (!recordPendingDelete) {
      return
    }

    setDeleteSubmitting(true)

    try {
      await careerService.deleteRecord(recordPendingDelete.id)
      await loadRecords()
      if (selectedRecordId === recordPendingDelete.id) {
        onRecordSelect(null)
      }
      const cascadeSummary =
        deleteEvidenceCount > 0
          ? ` and ${deleteEvidenceCount} linked evidence item${deleteEvidenceCount === 1 ? '' : 's'}`
          : ''
      toast.success(`Record "${recordPendingDelete.slug}"${cascadeSummary} deleted`)
      resetDeleteState()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete record')
      setDeleteSubmitting(false)
    }
  }

  const handleDeleteDialogChange = (open: boolean) => {
    if (deleteSubmitting) {
      return
    }

    if (!open) {
      resetDeleteState()
      return
    }

    setDeleteDialogOpen(true)
  }

  const handleSave = async () => {
    await loadRecords()
    setDialogOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Experience Records</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {records.length} record{records.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {records.length > 1 && (
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_at">Last updated</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="organization">Organization</SelectItem>
                <SelectItem value="start_date">Start date</SelectItem>
              </SelectContent>
            </Select>
          )}
          {multiSelectActive && (
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash className="mr-2 h-4 w-4" />
              Delete {selectedIds.size}
            </Button>
          )}
          <Button onClick={handleCreate}>
            <Plus className="mr-2" />
            New Record
          </Button>
        </div>
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No experience records yet"
          description="Add your first employment or project record to start building a claim-backed career library."
          action={
            <Button size="sm" onClick={handleCreate}>
              <Plus className="mr-2" />
              New record
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {sortedRecords.map((record) => (
            <Card
              key={record.id}
              className={cn(
                'cursor-pointer transition-all hover:border-accent/50',
                selectedRecordId === record.id && 'card-selected',
                selectedIds.has(record.id) && 'ring-2 ring-primary/40'
              )}
              onClick={() => onRecordSelect(record.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <input
                      type="checkbox"
                      aria-label={`Select ${record.slug}`}
                      checked={selectedIds.has(record.id)}
                      onChange={() => toggleSelect(record.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1.5 h-4 w-4 rounded border-border accent-primary"
                    />
                    <div className="mt-1">
                      {record.record_type === 'employment' ? (
                        <Briefcase className="h-5 w-5 text-primary" />
                      ) : (
                        <FolderOpen className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base mb-1">{record.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">{record.organization}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Badge variant="mono">
                          {record.slug}
                        </Badge>
                        <span>•</span>
                        <span>
                          {record.start_date} → {record.end_date}
                        </span>
                        {record.location && (
                          <>
                            <span>•</span>
                            <span>{record.location}</span>
                          </>
                        )}
                        {record.employment_type && (
                          <>
                            <span>•</span>
                            <span>{record.employment_type}</span>
                          </>
                        )}
                      </div>
                      {record.context_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {record.context_tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="mono">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(record)
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDeleteIntent(record)
                      }}
                    >
                      <Trash />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <RecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        record={editingRecord}
        onSave={handleSave}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete record and linked evidence?</AlertDialogTitle>
            <AlertDialogDescription>
              {recordPendingDelete
                ? `This permanently deletes "${recordPendingDelete.slug}" from the library.`
                : 'This permanently deletes the selected record from the library.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Alert>
            <AlertDescription>
              {deleteDetailsLoading
                ? 'Loading linked evidence for cascade preview...'
                : deleteEvidenceCount > 0
                  ? `Cascade delete will remove ${deleteEvidenceCount} linked evidence item${deleteEvidenceCount === 1 ? '' : 's'}.`
                  : 'No linked evidence items will be removed.'}
            </AlertDescription>
          </Alert>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteDetailsLoading || deleteSubmitting}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
            >
              {deleteSubmitting ? 'Deleting...' : 'Delete record'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => !bulkDeleteSubmitting && setBulkDeleteOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} record{selectedIds.size === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the selected records and all their linked evidence. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkDeleteSubmitting}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void handleBulkDelete()
              }}
            >
              {bulkDeleteSubmitting ? 'Deleting...' : `Delete ${selectedIds.size} record${selectedIds.size === 1 ? '' : 's'}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
