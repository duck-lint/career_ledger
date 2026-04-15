import type { TagInferenceMarker, TagInferenceMarkerInput } from './types'

export type TagInferenceMarkerDraft = {
  markerKind: 'literal' | 'compound'
  literalValue: string
  allOf: string
  anyOf: string
}

export function parseTagInferenceMarkerList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function tagInferenceMarkerToDraft(marker: TagInferenceMarker): TagInferenceMarkerDraft {
  const allOf = marker.terms
    .filter((term) => term.termGroup === 'all_of')
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((term) => term.termValue)
    .join(', ')

  const anyOf = marker.terms
    .filter((term) => term.termGroup === 'any_of')
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((term) => term.termValue)
    .join(', ')

  return {
    markerKind: marker.markerKind === 'compound' ? 'compound' : 'literal',
    literalValue: marker.literalValue ?? '',
    allOf,
    anyOf,
  }
}

export function tagInferenceMarkersToDrafts(
  markers: TagInferenceMarker[]
): TagInferenceMarkerDraft[] {
  return markers.map(tagInferenceMarkerToDraft)
}

export function tagInferenceMarkerDraftToInput(
  draft: TagInferenceMarkerDraft
): TagInferenceMarkerInput {
  return {
    markerKind: draft.markerKind,
    literalValue: draft.markerKind === 'literal' ? draft.literalValue : null,
    allOf: draft.markerKind === 'compound' ? parseTagInferenceMarkerList(draft.allOf) : [],
    anyOf: draft.markerKind === 'compound' ? parseTagInferenceMarkerList(draft.anyOf) : [],
  }
}

export function tagInferenceMarkerDraftsToInputs(
  drafts: TagInferenceMarkerDraft[]
): TagInferenceMarkerInput[] {
  return drafts.map(tagInferenceMarkerDraftToInput)
}

export function cloneTagInferenceMarkerDrafts(
  drafts: TagInferenceMarkerDraft[]
): TagInferenceMarkerDraft[] {
  return drafts.map((draft) => ({ ...draft }))
}

export function buildDefaultTagInferenceMarkerDrafts(
  normalizedTag: string
): TagInferenceMarkerDraft[] {
  if (!normalizedTag) {
    return [
      {
        markerKind: 'literal',
        literalValue: '',
        allOf: '',
        anyOf: '',
      },
    ]
  }

  const phrase = normalizedTag.replace(/_/g, ' ')
  const literals = [phrase]
  if (phrase.includes(' ')) {
    const hyphenated = phrase.replace(/ /g, '-')
    if (!literals.includes(hyphenated)) {
      literals.push(hyphenated)
    }
  }

  return literals.map((literalValue) => ({
    markerKind: 'literal',
    literalValue,
    allOf: '',
    anyOf: '',
  }))
}

export function tagInferenceMarkerDraftsEqual(
  left: TagInferenceMarkerDraft[],
  right: TagInferenceMarkerDraft[]
): boolean {
  try {
    return (
      JSON.stringify(tagInferenceMarkerDraftsToInputs(left)) ===
      JSON.stringify(tagInferenceMarkerDraftsToInputs(right))
    )
  } catch {
    return false
  }
}
