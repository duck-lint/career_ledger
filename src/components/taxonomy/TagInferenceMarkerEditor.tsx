import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { TagInferenceMarkerDraft } from '@/lib/tag-inference-marker-drafts'
import { Plus, Trash2 as Trash } from 'lucide-react'

type TagInferenceMarkerEditorProps = {
  drafts: TagInferenceMarkerDraft[]
  onChange: (drafts: TagInferenceMarkerDraft[]) => void
  disabled?: boolean
}

export default function TagInferenceMarkerEditor({
  drafts,
  onChange,
  disabled = false,
}: TagInferenceMarkerEditorProps) {
  const updateDraft = (index: number, patch: Partial<TagInferenceMarkerDraft>) => {
    onChange(
      drafts.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft
      )
    )
  }

  const addDraft = (markerKind: 'literal' | 'compound') => {
    onChange([
      ...drafts,
      {
        markerKind,
        literalValue: '',
        allOf: '',
        anyOf: '',
      },
    ])
  }

  const removeDraft = (index: number) => {
    onChange(drafts.filter((_, draftIndex) => draftIndex !== index))
  }

  return (
    <div className="space-y-4">
      {drafts.map((draft, index) => (
        <div key={`marker-draft-${index}`} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline">Marker {index + 1}</Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeDraft(index)}
              disabled={disabled || drafts.length === 1}
            >
              <Trash />
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Marker Type</Label>
            <Select
              value={draft.markerKind}
              onValueChange={(value) =>
                updateDraft(index, {
                  markerKind: value as 'literal' | 'compound',
                  literalValue: value === 'literal' ? draft.literalValue : '',
                  allOf: value === 'compound' ? draft.allOf : '',
                  anyOf: value === 'compound' ? draft.anyOf : '',
                })
              }
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="literal">Literal</SelectItem>
                <SelectItem value="compound">Compound</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {draft.markerKind === 'literal' ? (
            <div className="space-y-2">
              <Label>Literal Value</Label>
              <Input
                value={draft.literalValue}
                onChange={(event) =>
                  updateDraft(index, { literalValue: event.target.value })
                }
                placeholder="workday"
                disabled={disabled}
              />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>All Of Terms</Label>
                <Textarea
                  value={draft.allOf}
                  onChange={(event) =>
                    updateDraft(index, { allOf: event.target.value })
                  }
                  placeholder="time, absence"
                  rows={3}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label>Any Of Terms</Label>
                <Textarea
                  value={draft.anyOf}
                  onChange={(event) =>
                    updateDraft(index, { anyOf: event.target.value })
                  }
                  placeholder="report, reporting"
                  rows={3}
                  disabled={disabled}
                />
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => addDraft('literal')} disabled={disabled}>
          <Plus className="mr-2" />
          Add Literal Marker
        </Button>
        <Button variant="outline" onClick={() => addDraft('compound')} disabled={disabled}>
          <Plus className="mr-2" />
          Add Compound Marker
        </Button>
      </div>
    </div>
  )
}