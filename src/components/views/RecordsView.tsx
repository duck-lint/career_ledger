import { useState, useEffect } from 'react'
import { careerService } from '@/lib/service'
import type { ExperienceRecord } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from '@phosphor-icons/react/dist/icons/Plus'
import { Briefcase } from '@phosphor-icons/react/dist/icons/Briefcase'
import { FolderOpen } from '@phosphor-icons/react/dist/icons/FolderOpen'
import { Pencil } from '@phosphor-icons/react/dist/icons/Pencil'
import { Trash } from '@phosphor-icons/react/dist/icons/Trash'
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
import { cn } from '@/lib/utils'

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

  useEffect(() => {
    loadRecords()
  }, [])

  const loadRecords = async () => {
    const data = await careerService.getRecords()
    setRecords(data)
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
        <Button onClick={handleCreate}>
          <Plus className="mr-2" />
          New Record
        </Button>
      </div>

      {records.length === 0 ? (
        <Alert>
          <AlertDescription>
            No records found. Create your first experience record to get started.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4">
          {records.map((record) => (
            <Card
              key={record.id}
              className={cn(
                'cursor-pointer transition-all hover:border-accent/50',
                selectedRecordId === record.id && 'card-selected'
              )}
              onClick={() => onRecordSelect(record.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
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
                        <Badge variant="outline" className="mono text-xs">
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
                            <Badge key={tag} variant="secondary" className="mono text-xs">
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
    </div>
  )
}
