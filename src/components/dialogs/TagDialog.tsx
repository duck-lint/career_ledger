import { useEffect, useState } from 'react'
import TagInferenceMarkerEditor from '@/components/taxonomy/TagInferenceMarkerEditor'
import { careerService } from '@/lib/service'
import {
  buildDefaultTagInferenceMarkerDrafts,
  cloneTagInferenceMarkerDrafts,
  tagInferenceMarkerDraftsEqual,
  tagInferenceMarkerDraftsToInputs,
  tagInferenceMarkersToDrafts,
  type TagInferenceMarkerDraft,
} from '@/lib/tag-inference-marker-drafts'
import type {
  CanonicalTag,
  DeliveryToolkitCategory,
  TagDialogCreateDraft,
} from '@/lib/types'
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { AlertTriangle as Warning } from 'lucide-react'

type TagDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tag: CanonicalTag | null
  draft?: TagDialogCreateDraft | null
  onSave: () => Promise<void> | void
}

export default function TagDialog({ open, onOpenChange, tag, draft = null, onSave }: TagDialogProps) {
  const [tagValue, setTagValue] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [displayLabel, setDisplayLabel] = useState('')
  const [markerDrafts, setMarkerDrafts] = useState<TagInferenceMarkerDraft[]>(() =>
    buildDefaultTagInferenceMarkerDrafts('')
  )
  const [markerBaseline, setMarkerBaseline] = useState<TagInferenceMarkerDraft[]>(() =>
    buildDefaultTagInferenceMarkerDrafts('')
  )
  const [markerSyncMode, setMarkerSyncMode] = useState<'auto' | 'manual'>('auto')
  const [markersExpanded, setMarkersExpanded] = useState(false)
  const [markersLoading, setMarkersLoading] = useState(false)
  const [categories, setCategories] = useState<DeliveryToolkitCategory[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [normalizedPreview, setNormalizedPreview] = useState('')

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    const loadCategories = async () => {
      try {
        const availableCategories = await careerService.getDeliveryToolkitCategories()
        if (!cancelled) {
          setCategories(availableCategories)
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load categories')
        }
      }
    }

    void loadCategories()

    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    const normalizedTag = careerService.normalizeTag(tag?.tag ?? draft?.tagValue ?? '')

    if (tag) {
      setTagValue(tag.tag)
      setDescription(tag.description || '')
      setCategory(tag.category || '')
      setDisplayLabel(tag.display_label || '')
      setNormalizedPreview(tag.tag)
      setMarkerDrafts(buildDefaultTagInferenceMarkerDrafts(normalizedTag))
      setMarkerBaseline(buildDefaultTagInferenceMarkerDrafts(normalizedTag))
      setMarkerSyncMode('manual')
      setMarkersLoading(true)
    } else if (draft) {
      setTagValue(draft.tagValue)
      setDescription(draft.description)
      setCategory(draft.categoryName ?? '')
      setDisplayLabel(draft.displayLabel)
      setNormalizedPreview(careerService.normalizeTag(draft.tagValue))
      const nextDefaults = buildDefaultTagInferenceMarkerDrafts(normalizedTag)
      setMarkerDrafts(nextDefaults)
      setMarkerBaseline(nextDefaults)
      setMarkerSyncMode('auto')
      setMarkersLoading(false)
    } else {
      setTagValue('')
      setDescription('')
      setCategory('')
      setDisplayLabel('')
      setNormalizedPreview('')
      const nextDefaults = buildDefaultTagInferenceMarkerDrafts('')
      setMarkerDrafts(nextDefaults)
      setMarkerBaseline(nextDefaults)
      setMarkerSyncMode('auto')
      setMarkersLoading(false)
    }

    setMarkersExpanded(false)
    setErrors({})
  }, [tag, draft, open])

  useEffect(() => {
    if (!open || !tag) {
      return
    }

    let cancelled = false

    const loadMarkers = async () => {
      try {
        const markers = await careerService.getTagInferenceMarkers(tag.tag)
        if (!cancelled) {
          const nextDrafts = tagInferenceMarkersToDrafts(markers)
          setMarkerDrafts(nextDrafts)
          setMarkerBaseline(nextDrafts)
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load inference markers')
        }
      } finally {
        if (!cancelled) {
          setMarkersLoading(false)
        }
      }
    }

    void loadMarkers()

    return () => {
      cancelled = true
    }
  }, [open, tag])

  useEffect(() => {
    if (!open || tag || categories.length === 0) {
      return
    }

    const currentCategoryExists = categories.some((item) => item.name === category)
    if (currentCategoryExists) {
      return
    }

    const draftCategory = draft?.categoryName?.trim() ?? ''
    const nextCategory = categories.some((item) => item.name === draftCategory)
      ? draftCategory
      : categories[0].name

    if (nextCategory) {
      setCategory(nextCategory)
    }
  }, [open, tag, draft, category, categories])

  useEffect(() => {
    if (tagValue) {
      const normalized = careerService.normalizeTag(tagValue)
      setNormalizedPreview(normalized)
    } else {
      setNormalizedPreview('')
    }
  }, [tagValue])

  useEffect(() => {
    if (!open || tag || markerSyncMode !== 'auto') {
      return
    }

    const nextDefaults = buildDefaultTagInferenceMarkerDrafts(normalizedPreview)
    setMarkerDrafts(nextDefaults)
    setMarkerBaseline(nextDefaults)
  }, [open, tag, markerSyncMode, normalizedPreview])

  const handleMarkerDraftsChange = (nextDrafts: TagInferenceMarkerDraft[]) => {
    setMarkerDrafts(nextDrafts)
    setMarkerSyncMode('manual')
  }

  const handleResetMarkersToDefaults = () => {
    const nextDefaults = buildDefaultTagInferenceMarkerDrafts(normalizedPreview)
    setMarkerDrafts(nextDefaults)
    if (tag) {
      setMarkerSyncMode('manual')
    } else {
      setMarkerBaseline(nextDefaults)
      setMarkerSyncMode('auto')
    }
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!tagValue.trim()) {
      newErrors.tag = 'Tag is required'
    }

    if (categories.length === 0) {
      newErrors.category = 'Create a delivery toolkit category in Taxonomy before creating tags'
    } else if (!category) {
      newErrors.category = 'Category is required'
    }

    if (!displayLabel.trim()) {
      newErrors.displayLabel = 'Display label is required'
    }

    const markerDraftsChanged = !tagInferenceMarkerDraftsEqual(markerDrafts, markerBaseline)
    if (markerDraftsChanged) {
      try {
        tagInferenceMarkerDraftsToInputs(markerDrafts)
      } catch (error) {
        newErrors.markers =
          error instanceof Error ? error.message : 'Invalid inference marker configuration'
        setMarkersExpanded(true)
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return

    const markerDraftsChanged = !tagInferenceMarkerDraftsEqual(markerDrafts, markerBaseline)

    try {
      let savedTag: CanonicalTag

      if (tag) {
        savedTag = await careerService.updateCanonicalTag(
          tag.tag,
          tagValue,
          description.trim() || null,
          category,
          displayLabel.trim()
        )
        toast.success(`Tag updated to "${normalizedPreview}"`)
      } else {
        savedTag = await careerService.createCanonicalTag(
          tagValue,
          description.trim() || null,
          category,
          displayLabel.trim()
        )
        toast.success(`Tag "${normalizedPreview}" created`)
      }

      if (markerDraftsChanged) {
        await careerService.replaceTagInferenceMarkers(
          savedTag.tag,
          tagInferenceMarkerDraftsToInputs(markerDrafts)
        )
      }

      setMarkerBaseline(cloneTagInferenceMarkerDrafts(markerDrafts))

      await onSave()
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        setErrors({ tag: error.message })
      } else if (error instanceof Error && error.message.includes('marker')) {
        setErrors((current) => ({ ...current, markers: error.message }))
        setMarkersExpanded(true)
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to save tag')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tag ? 'Edit Canonical Tag' : 'New Canonical Tag'}</DialogTitle>
          <DialogDescription>
            {tag
              ? 'Update the canonical tag details.'
              : 'Create a new canonical tag for evidence classification.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag">
              Tag <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tag"
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              placeholder="tag_name"
              className={`mono ${errors.tag ? 'border-destructive' : ''}`}
            />
            <p className="text-xs text-muted-foreground">
              Will be normalized to lowercase snake_case
            </p>
            {normalizedPreview && normalizedPreview !== tagValue && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Normalized:</span>
                <Badge className="mono">{normalizedPreview}</Badge>
              </div>
            )}
            {errors.tag && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <Warning className="h-3 w-3" />
                {errors.tag}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this tag..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Optional description to help users understand when to use this tag
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">
                Delivery Toolkit Category <span className="text-destructive">*</span>
              </Label>
              {categories.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No categories exist yet. Create the first delivery toolkit category in Taxonomy before you create a tag here.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category" className={errors.category ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((item) => (
                      <SelectItem key={item.name} value={item.name}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                Categories are managed from Taxonomy and reused here.
              </p>
              {errors.category && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <Warning className="h-3 w-3" />
                  {errors.category}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayLabel">
                Display Label <span className="text-destructive">*</span>
              </Label>
              <Input
                id="displayLabel"
                value={displayLabel}
                onChange={(e) => setDisplayLabel(e.target.value)}
                placeholder="Human-readable label"
                className={errors.displayLabel ? 'border-destructive' : ''}
              />
              {errors.displayLabel && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <Warning className="h-3 w-3" />
                  {errors.displayLabel}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="font-medium text-foreground">Advanced Inference Markers</div>
                <p className="text-sm text-muted-foreground">
                  Keep the default markers for quick tag creation, or expand this section to define custom literal and compound marker rules now.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMarkersExpanded((current) => !current)}
                  disabled={markersLoading}
                >
                  {markersExpanded ? 'Hide Advanced' : 'Customize Markers'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetMarkersToDefaults}
                  disabled={markersLoading}
                >
                  Reset to Defaults
                </Button>
              </div>
            </div>

            {!markersExpanded && (
              <p className="text-xs text-muted-foreground">
                Default markers follow the normalized tag value unless you customize them here.
              </p>
            )}

            {markersExpanded && (
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Every canonical tag must keep at least one marker. Literal markers match one phrase. Compound markers require one or more all-of or any-of terms.
                  </AlertDescription>
                </Alert>

                {markersLoading ? (
                  <Alert>
                    <AlertDescription>Loading existing markers…</AlertDescription>
                  </Alert>
                ) : (
                  <TagInferenceMarkerEditor
                    drafts={markerDrafts}
                    onChange={handleMarkerDraftsChange}
                  />
                )}
              </div>
            )}

            {errors.markers && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <Warning className="h-3 w-3" />
                {errors.markers}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={markersLoading || (!tag && categories.length === 0)}>
            {tag ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
