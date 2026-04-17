import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { careerService } from '@/lib/service'
import type { CanonicalTag, TagInferenceMarkerInput } from '@/lib/types'
import {
  tagInferenceMarkersToDrafts,
  tagInferenceMarkerDraftsToInputs,
} from '@/lib/tag-inference-marker-drafts'
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
import { Badge } from '@/components/ui/badge'

type AdoptTagDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The unrecognized term being triaged */
  term: string | null
  /** Canonical tags already matched in the same cluster — used for relevance sorting */
  clusterMatchedTags: string[]
  /** Called after successfully adding a marker to an existing tag */
  onAdopt: () => void
  /** Called when the user wants to create a new tag instead */
  onCreate: () => void
}

/**
 * Scores a canonical tag for relevance to the given term and cluster context.
 * Lower score = higher relevance.
 *   0: tag is already matched in the same cluster (strong contextual signal)
 *   1: tag name shares word segments with the term
 *   2: everything else (alphabetical fallback)
 */
function relevanceScore(tag: CanonicalTag, termWords: Set<string>, clusterTagSet: Set<string>): number {
  if (clusterTagSet.has(tag.tag)) return 0
  const tagWords = tag.tag.split('_')
  if (tagWords.some((word) => termWords.has(word))) return 1
  return 2
}

export default function AdoptTagDialog({
  open,
  onOpenChange,
  term,
  clusterMatchedTags,
  onAdopt,
  onCreate,
}: AdoptTagDialogProps) {
  const [allTags, setAllTags] = useState<CanonicalTag[]>([])
  const [filter, setFilter] = useState('')
  const [adopting, setAdopting] = useState<string | null>(null)

  // Fetch tags when dialog opens
  useEffect(() => {
    if (!open) {
      setFilter('')
      setAdopting(null)
      return
    }
    careerService.getCanonicalTags().then(setAllTags).catch(() => {
      toast.error('Failed to load canonical tags')
    })
  }, [open])

  const clusterTagSet = useMemo(() => new Set(clusterMatchedTags), [clusterMatchedTags])

  // Word segments from the term, for relevance scoring
  const termWords = useMemo(() => {
    if (!term) return new Set<string>()
    return new Set(term.split(/[\s_-]+/).filter(Boolean))
  }, [term])

  // Sorted and filtered tag list
  const displayTags = useMemo(() => {
    const lowerFilter = filter.toLowerCase().trim()
    const filtered = lowerFilter
      ? allTags.filter(
          (tag) =>
            tag.tag.includes(lowerFilter) ||
            (tag.display_label?.toLowerCase().includes(lowerFilter) ?? false)
        )
      : allTags

    return [...filtered].sort((a, b) => {
      const scoreA = relevanceScore(a, termWords, clusterTagSet)
      const scoreB = relevanceScore(b, termWords, clusterTagSet)
      if (scoreA !== scoreB) return scoreA - scoreB
      return a.tag.localeCompare(b.tag)
    })
  }, [allTags, filter, termWords, clusterTagSet])

  const handleAdopt = async (tag: CanonicalTag) => {
    if (!term || adopting) return
    setAdopting(tag.tag)

    try {
      // Get existing markers, convert to inputs, append the new literal
      const existingMarkers = await careerService.getTagInferenceMarkers(tag.tag)
      const existingInputs = tagInferenceMarkerDraftsToInputs(
        tagInferenceMarkersToDrafts(existingMarkers)
      )
      const newMarker: TagInferenceMarkerInput = {
        markerKind: 'literal',
        literalValue: term,
        allOf: [],
        anyOf: [],
      }
      await careerService.replaceTagInferenceMarkers(tag.tag, [...existingInputs, newMarker])

      toast.success(`Added "${term}" as inference marker on ${tag.display_label ?? tag.tag}`)
      onAdopt()
    } catch (error) {
      toast.error(`Failed to adopt term: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setAdopting(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Add <span className="mono font-semibold">{term}</span> to existing tag?
          </DialogTitle>
          <DialogDescription>
            Select a canonical tag to add this term as an inference marker, or create a new tag instead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Filter tags…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
          />

          <div className="max-h-60 space-y-1 overflow-y-auto rounded-md border p-2">
            {displayTags.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {allTags.length === 0 ? 'No canonical tags exist yet.' : 'No tags match the filter.'}
              </div>
            ) : (
              displayTags.map((tag) => {
                const score = relevanceScore(tag, termWords, clusterTagSet)
                return (
                  <button
                    key={tag.tag}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
                    onClick={() => handleAdopt(tag)}
                    disabled={adopting !== null}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="mono block truncate font-medium">
                        {tag.display_label ?? tag.tag}
                      </span>
                      {tag.category && (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {tag.category}
                        </span>
                      )}
                    </div>
                    {score === 0 && (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        in cluster
                      </Badge>
                    )}
                    {score === 1 && (
                      <Badge variant="secondary" className="shrink-0 text-[10px] opacity-60">
                        related
                      </Badge>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCreate} disabled={adopting !== null}>
            Create New Tag Instead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
