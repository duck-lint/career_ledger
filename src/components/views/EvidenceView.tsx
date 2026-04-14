import { useState, useMemo, useEffect } from 'react'
import { careerService } from '@/lib/service'
import type { Evidence, ExperienceRecord } from '@/lib/types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Plus } from '@phosphor-icons/react/dist/icons/Plus'
import { FileText } from '@phosphor-icons/react/dist/icons/FileText'
import { Pencil } from '@phosphor-icons/react/dist/icons/Pencil'
import { Trash } from '@phosphor-icons/react/dist/icons/Trash'
import { MagnifyingGlass } from '@phosphor-icons/react/dist/icons/MagnifyingGlass'
import { Warning } from '@phosphor-icons/react/dist/icons/Warning'
import { toast } from 'sonner'
import EvidenceDialog from '@/components/dialogs/EvidenceDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [evidenceData, recordsData] = await Promise.all([
        careerService.getAllEvidence(),
        careerService.getRecords(),
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

    return filtered
  }, [evidence, selectedRecordId, searchQuery])

  const handleCreate = () => {
    setEditingEvidence(null)
    setDialogOpen(true)
  }

  const handleEdit = (item: Evidence) => {
    setEditingEvidence(item)
    setDialogOpen(true)
  }

  const handleDelete = async (item: Evidence) => {
    try {
      await careerService.deleteEvidence(item.id)
      await loadData()
      toast.success('Evidence deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete evidence')
    }
  }

  const handleSave = async () => {
    await loadData()
    setDialogOpen(false)
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
                  className="pl-9 w-64"
                />
              </div>
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
          <Alert>
            <AlertDescription>
              {searchQuery
                ? 'No evidence items match your search.'
                : 'No evidence items for this record. Create your first evidence item to get started.'}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {filteredEvidence.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed">{item.claim}</p>
                      <div className="flex flex-wrap gap-1 mt-3">
                        {item.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="mono text-xs">
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
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item)}>
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

      {selectedRecord && (
        <EvidenceDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          evidence={editingEvidence}
          recordId={selectedRecord.id}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
