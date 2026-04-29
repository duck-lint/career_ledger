import type { CandidateProfile, CanonicalTag, Evidence, ExperienceRecord, TagInferenceMarker } from './types'

export type MarkerDiagnostic = {
  id: string
  tag: string
  label: string
}

export type StoredPostingCoverage = {
  available: boolean
  matchedTags: string[]
  unmatchedTags: string[]
}

export type TaxonomyDiagnosticsInput = {
  canonicalTags: CanonicalTag[]
  records: ExperienceRecord[]
  evidence: Evidence[]
  candidateProfile: CandidateProfile | undefined
  markersByTag: Record<string, TagInferenceMarker[]>
  storedPostingText?: string | null
}

export type TaxonomyDiagnostics = {
  canonicalTagCount: number
  evidenceCount: number
  tagsWithoutSupportingSources: string[]
  tagsWithoutMarkers: string[]
  tagsWithoutMetadata: string[]
  evidenceWithoutTags: Array<{ id: string; claim: string }>
  markersWithoutLibraryHits: MarkerDiagnostic[]
  storedPostingCoverage: StoredPostingCoverage
  unknownEvidenceTags: string[]
  unknownRecordContextTags: string[]
  unknownCandidateProfileSignalTags: string[]
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function dedupeSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right),
  )
}

function candidateProfileSignalTags(profile: CandidateProfile | undefined): string[] {
  if (!profile?.staticSections) {
    return []
  }

  return [
    ...(profile.staticSections.education ?? []).flatMap((entry) => entry.signalTags ?? []),
    ...(profile.staticSections.certifications ?? []).flatMap((entry) => entry.signalTags ?? []),
  ]
}

function candidateProfileSearchText(profile: CandidateProfile | undefined): string {
  if (!profile?.staticSections) {
    return ''
  }

  return normalizeSearchText(
    [
      ...(profile.staticSections.education ?? []).flatMap((entry) => [
        entry.institution,
        entry.credential,
        entry.fieldNotes.major ?? '',
        entry.fieldNotes.minor ?? '',
        ...(entry.signalTags ?? []),
      ]),
      ...(profile.staticSections.certifications ?? []).flatMap((entry) => [
        entry.name,
        entry.issuer,
        entry.credentialDetail ?? '',
        ...(entry.signalTags ?? []),
      ]),
    ].join(' '),
  )
}

function markerLabel(marker: TagInferenceMarker): string {
  if (marker.markerKind === 'literal') {
    return marker.literalValue?.trim() || 'Empty literal marker'
  }

  const allOf = (marker.terms ?? [])
    .filter((term) => term.termGroup === 'all_of')
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((term) => term.termValue)
  const anyOf = (marker.terms ?? [])
    .filter((term) => term.termGroup === 'any_of')
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((term) => term.termValue)

  return [allOf.length > 0 ? `all: ${allOf.join(', ')}` : '', anyOf.length > 0 ? `any: ${anyOf.join(', ')}` : '']
    .filter(Boolean)
    .join('; ') || 'Empty compound marker'
}

function markerMatchesText(marker: TagInferenceMarker, searchableText: string): boolean {
  if (!searchableText) {
    return false
  }

  if (marker.markerKind === 'literal') {
    const literal = normalizeSearchText(marker.literalValue ?? '')
    return literal.length > 0 && searchableText.includes(literal)
  }

  const allOf = (marker.terms ?? [])
    .filter((term) => term.termGroup === 'all_of')
    .map((term) => normalizeSearchText(term.termValue))
    .filter(Boolean)
  const anyOf = (marker.terms ?? [])
    .filter((term) => term.termGroup === 'any_of')
    .map((term) => normalizeSearchText(term.termValue))
    .filter(Boolean)

  return allOf.every((term) => searchableText.includes(term)) && (
    anyOf.length === 0 || anyOf.some((term) => searchableText.includes(term))
  )
}

function buildLibrarySearchText(
  records: ExperienceRecord[],
  evidence: Evidence[],
  candidateProfile: CandidateProfile | undefined,
): string {
  return normalizeSearchText(
    [
      ...records.flatMap((record) => [
        record.organization,
        record.title,
        record.location ?? '',
        record.employment_type ?? '',
        ...(record.context_tags ?? []),
      ]),
      ...evidence.flatMap((item) => [
        item.claim,
        item.date_range ?? '',
        item.evidence_note ?? '',
        ...(item.tags ?? []),
      ]),
      candidateProfileSearchText(candidateProfile),
    ].join(' '),
  )
}

function buildStoredPostingCoverage(
  canonicalTags: CanonicalTag[],
  markersByTag: Record<string, TagInferenceMarker[]>,
  storedPostingText: string | null | undefined,
): StoredPostingCoverage {
  const searchableText = normalizeSearchText(storedPostingText ?? '')
  if (!searchableText) {
    return { available: false, matchedTags: [], unmatchedTags: [] }
  }

  const matchedTags = canonicalTags
    .map((tag) => tag.tag)
    .filter((tag) => {
      const tagText = normalizeSearchText(tag.replace(/_/g, ' '))
      return searchableText.includes(tagText) || (markersByTag[tag] ?? []).some((marker) => markerMatchesText(marker, searchableText))
    })

  const matchedTagSet = new Set(matchedTags)

  return {
    available: true,
    matchedTags,
    unmatchedTags: canonicalTags.map((tag) => tag.tag).filter((tag) => !matchedTagSet.has(tag)),
  }
}

export function buildTaxonomyDiagnostics(input: TaxonomyDiagnosticsInput): TaxonomyDiagnostics {
  const canonicalTagSet = new Set(input.canonicalTags.map((tag) => tag.tag))
  const evidenceTags = input.evidence.flatMap((item) => item.tags ?? [])
  const evidenceTagSet = new Set(evidenceTags)
  const recordContextTags = input.records.flatMap((record) => record.context_tags ?? [])
  const profileSignalTags = candidateProfileSignalTags(input.candidateProfile)
  const supportingSourceTags = new Set([...evidenceTags, ...profileSignalTags])
  const librarySearchText = buildLibrarySearchText(
    input.records,
    input.evidence,
    input.candidateProfile,
  )

  return {
    canonicalTagCount: input.canonicalTags.length,
    evidenceCount: input.evidence.length,
    tagsWithoutSupportingSources: input.canonicalTags
      .map((tag) => tag.tag)
      .filter((tag) => !supportingSourceTags.has(tag)),
    tagsWithoutMarkers: input.canonicalTags
      .map((tag) => tag.tag)
      .filter((tag) => (input.markersByTag[tag] ?? []).length === 0),
    tagsWithoutMetadata: input.canonicalTags
      .filter((tag) => !tag.category?.trim() || !tag.display_label?.trim())
      .map((tag) => tag.tag),
    evidenceWithoutTags: input.evidence
      .filter((item) => (item.tags ?? []).length === 0)
      .map((item) => ({ id: item.id, claim: item.claim })),
    markersWithoutLibraryHits: input.canonicalTags.flatMap((tag) =>
      (input.markersByTag[tag.tag] ?? [])
        .filter((marker) => !markerMatchesText(marker, librarySearchText))
        .map((marker) => ({ id: marker.id, tag: tag.tag, label: markerLabel(marker) })),
    ),
    storedPostingCoverage: buildStoredPostingCoverage(
      input.canonicalTags,
      input.markersByTag,
      input.storedPostingText,
    ),
    unknownEvidenceTags: dedupeSorted(evidenceTags.filter((tag) => !canonicalTagSet.has(tag))),
    unknownRecordContextTags: dedupeSorted(
      recordContextTags.filter((tag) => !canonicalTagSet.has(tag)),
    ),
    unknownCandidateProfileSignalTags: dedupeSorted(
      profileSignalTags.filter((tag) => !canonicalTagSet.has(tag)),
    ),
  }
}

export function taxonomyDiagnosticsIssueCount(diagnostics: TaxonomyDiagnostics): number {
  return (
    diagnostics.tagsWithoutSupportingSources.length +
    diagnostics.tagsWithoutMarkers.length +
    diagnostics.tagsWithoutMetadata.length +
    diagnostics.evidenceWithoutTags.length +
    diagnostics.markersWithoutLibraryHits.length +
    diagnostics.unknownEvidenceTags.length +
    diagnostics.unknownRecordContextTags.length +
    diagnostics.unknownCandidateProfileSignalTags.length
  )
}