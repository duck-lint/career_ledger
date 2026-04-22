import { useEffect, useRef, useState } from 'react'
import { libraryService } from '@/lib/service'
import type { ExperienceRecord, RecordType } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { AlertTriangle as Warning } from 'lucide-react'

type RecordDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: ExperienceRecord | null
  onSave: () => Promise<void> | void
}

export default function RecordDialog({ open, onOpenChange, record, onSave }: RecordDialogProps) {
  const [slug, setSlug] = useState('')
  const [recordType, setRecordType] = useState<RecordType>('employment')
  const [organization, setOrganization] = useState('')
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [location, setLocation] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [contextTagsInput, setContextTagsInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tagValidation, setTagValidation] = useState<{
    normalized: string[]
    unknown: string[]
  } | null>(null)
  const snapshotRef = useRef('')

  // Serialize current form state for dirty checking
  const formFingerprint = () =>
    JSON.stringify([slug, recordType, organization, title, startDate, endDate, location, employmentType, contextTagsInput])

  useEffect(() => {
    if (record) {
      setSlug(record.slug)
      setRecordType(record.record_type)
      setOrganization(record.organization)
      setTitle(record.title)
      setStartDate(record.start_date)
      setEndDate(record.end_date)
      setLocation(record.location || '')
      setEmploymentType(record.employment_type || '')
      setContextTagsInput(record.context_tags.join(', '))
      setTagValidation(null)
    } else {
      setSlug('')
      setRecordType('employment')
      setOrganization('')
      setTitle('')
      setStartDate('')
      setEndDate('')
      setLocation('')
      setEmploymentType('')
      setContextTagsInput('')
      setTagValidation(null)
    }
    setErrors({})
    // Snapshot is set after render via a microtask so state has flushed
    queueMicrotask(() => {
      snapshotRef.current = record
        ? JSON.stringify([record.slug, record.record_type, record.organization, record.title, record.start_date, record.end_date, record.location || '', record.employment_type || '', record.context_tags.join(', ')])
        : JSON.stringify(['', 'employment', '', '', '', '', '', '', ''])
    })
  }, [record, open])

  const isDirty = () => formFingerprint() !== snapshotRef.current

  const guardedOpenChange = (next: boolean) => {
    if (!next && isDirty()) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return
    }
    onOpenChange(next)
  }

  useEffect(() => {
    const normalizeTags = async () => {
      if (contextTagsInput) {
        const tags = contextTagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
        if (tags.length > 0) {
          const result = await libraryService.normalizeTags(tags)
          setTagValidation(result)
        } else {
          setTagValidation(null)
        }
      } else {
        setTagValidation(null)
      }
    }
    
    normalizeTags()
  }, [contextTagsInput])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!organization.trim()) {
      newErrors.organization = 'Organization is required'
    }

    if (!title.trim()) {
      newErrors.title = 'Title is required'
    }

    if (contextTagsInput && tagValidation && tagValidation.unknown.length > 0) {
      newErrors.contextTags = `Unknown tags: ${tagValidation.unknown.join(', ')}. Add them to taxonomy first.`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return

    try {
      const data = {
        slug: slug.trim(),
        record_type: recordType,
        organization: organization.trim(),
        title: title.trim(),
        start_date: startDate.trim(),
        end_date: endDate.trim(),
        location: recordType === 'employment' ? (location.trim() || null) : null,
        employment_type: recordType === 'employment' ? (employmentType.trim() || null) : null,
        context_tags: tagValidation?.normalized || [],
      }

      if (record) {
        const savedRecord = await libraryService.updateRecord(record.id, data)
        toast.success(`Record "${savedRecord.slug}" updated`)
      } else {
        const savedRecord = await libraryService.createRecord(data)
        toast.success(`Record "${savedRecord.slug}" created`)
      }

      await onSave()
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        setErrors({ slug: error.message })
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to save record')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={guardedOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? 'Edit Record' : 'New Record'}</DialogTitle>
          <DialogDescription>
            {record ? 'Update the experience record details.' : 'Create a new experience record.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Leave blank to auto-generate"
                className={`mono ${errors.slug ? 'border-destructive' : ''}`}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to generate a slug from organization and title.
              </p>
              {errors.slug && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <Warning className="h-3 w-3" />
                  {errors.slug}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="recordType">
                Record Type <span className="text-destructive">*</span>
              </Label>
              <Select value={recordType} onValueChange={(v) => setRecordType(v as RecordType)}>
                <SelectTrigger id="recordType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employment">Employment</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organization">
              Organization <span className="text-destructive">*</span>
            </Label>
            <Input
              id="organization"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="Company or context"
              className={errors.organization ? 'border-destructive' : ''}
            />
            {errors.organization && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <Warning className="h-3 w-3" />
                {errors.organization}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Role or project title"
              className={errors.title ? 'border-destructive' : ''}
            />
            {errors.title && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <Warning className="h-3 w-3" />
                {errors.title}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="YYYY-MM"
                className={errors.startDate ? 'border-destructive' : ''}
              />
              {errors.startDate && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <Warning className="h-3 w-3" />
                  {errors.startDate}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="YYYY-MM or Present"
                className={errors.endDate ? 'border-destructive' : ''}
              />
              {errors.endDate && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <Warning className="h-3 w-3" />
                  {errors.endDate}
                </p>
              )}
            </div>
          </div>

          {recordType === 'employment' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, State/Province"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employmentType">Employment Type</Label>
                <Input
                  id="employmentType"
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                  placeholder="Full-time, Part-time, Contract, etc."
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="contextTags">Context Tags</Label>
            <Input
              id="contextTags"
              value={contextTagsInput}
              onChange={(e) => setContextTagsInput(e.target.value)}
              placeholder="tag1, tag2, tag3"
              className={errors.contextTags ? 'border-destructive' : ''}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated high-level thematic tags (distinct from evidence tags)
            </p>
            {errors.contextTags && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <Warning className="h-3 w-3" />
                {errors.contextTags}
              </p>
            )}
            {tagValidation && tagValidation.normalized.length > 0 && !errors.contextTags && (
              <div className="flex flex-wrap gap-1">
                {tagValidation.normalized.map((tag) => (
                  <Badge key={tag} variant="secondary" className="mono text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>{record ? 'Update' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
