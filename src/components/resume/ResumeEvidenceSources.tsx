import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type {
  CareerLibraryExportEvidenceItem,
  CareerLibraryExportRecord,
  ResumePipelineResult,
} from '@/lib/types'

type ResumeEvidenceSourcesProps = {
  result: ResumePipelineResult
  evidenceIds: string[]
}

type EvidenceSource = {
  evidence: CareerLibraryExportEvidenceItem
  record: CareerLibraryExportRecord
}

function buildEvidenceSourceLookup(result: ResumePipelineResult): Map<string, EvidenceSource> {
  const lookup = new Map<string, EvidenceSource>()
  const exportsToIndex = [
    result.career_library_export,
    result.preflight_result.career_library_export,
  ]

  for (const libraryExport of exportsToIndex) {
    for (const record of libraryExport.experience_records) {
      for (const evidence of record.evidence) {
        lookup.set(evidence.id, { evidence, record })
      }
    }
  }

  return lookup
}

export function ResumeEvidenceSources({ result, evidenceIds }: ResumeEvidenceSourcesProps) {
  if (evidenceIds.length === 0) {
    return null
  }

  const sourceLookup = buildEvidenceSourceLookup(result)
  const sources = evidenceIds
    .map((evidenceId) => sourceLookup.get(evidenceId))
    .filter((source): source is EvidenceSource => Boolean(source))
  const missingIds = evidenceIds.filter((evidenceId) => !sourceLookup.has(evidenceId))

  return (
    <details className="rounded-md border bg-background/70 px-3 py-2 text-xs">
      <summary className="cursor-pointer select-none font-medium text-foreground">
        Sources ({sources.length}{missingIds.length > 0 ? ` mapped, ${missingIds.length} missing` : ''})
      </summary>
      <div className="mt-3 space-y-3">
        {sources.map(({ evidence, record }) => (
          <div key={evidence.id} className="space-y-2 rounded-md border bg-muted/20 p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="font-medium text-foreground">{record.title}</div>
                <div className="text-muted-foreground">{record.organization}</div>
              </div>
              <Badge variant="outline" className="mono w-fit text-[10px]">
                {record.slug}
              </Badge>
            </div>
            <div className="leading-5 text-foreground">{evidence.claim}</div>
            {evidence.date_range && (
              <div className="text-muted-foreground">Date range: {evidence.date_range}</div>
            )}
            {evidence.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {evidence.tags.map((tag) => (
                  <Badge key={`${evidence.id}-${tag}`} variant="secondary" className="mono text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            {evidence.evidence_note && (
              <div className="rounded bg-background/70 p-2 text-muted-foreground">
                {evidence.evidence_note}
              </div>
            )}
          </div>
        ))}

        {missingIds.length > 0 && (
          <Alert>
            <AlertDescription>
              Missing source evidence ids: {missingIds.join(', ')}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </details>
  )
}