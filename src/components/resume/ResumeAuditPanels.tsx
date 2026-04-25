import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  ConstraintFlag,
  ConstraintFlagStatus,
  GapReport,
  PartiallySupportedRequirement,
  SupportedRequirement,
  SupportingSource,
  UnsupportedRequirement,
} from '@/lib/types'
import { cn } from '@/lib/utils'

type ResumeGapReportPanelProps = {
  gapReport: GapReport
}

type ResumeAssemblyAuditPanelProps = {
  constraintFlags: ConstraintFlag[]
  notes: string[]
}

function sourceLabel(source: SupportingSource): string {
  return `${source.source_type}: ${source.source_id}`
}

function RequirementSources({ sources }: { sources: SupportingSource[] }) {
  if (sources.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-1">
      {sources.map((source) => (
        <Badge
          key={`${source.source_type}-${source.source_id}`}
          variant="outline"
          className="mono text-[10px]"
        >
          {sourceLabel(source)}
        </Badge>
      ))}
    </div>
  )
}

function SupportedRequirementItem({ item }: { item: SupportedRequirement }) {
  return (
    <li className="space-y-2 rounded-md border bg-green-500/5 p-3">
      <div className="text-sm text-foreground">{item.requirement}</div>
      <RequirementSources sources={item.supporting_sources} />
    </li>
  )
}

function PartialRequirementItem({ item }: { item: PartiallySupportedRequirement }) {
  return (
    <li className="space-y-2 rounded-md border bg-yellow-500/10 p-3">
      <div className="text-sm text-foreground">{item.requirement}</div>
      <div className="text-xs text-muted-foreground">{item.limitation}</div>
      <RequirementSources sources={item.supporting_sources} />
    </li>
  )
}

function UnsupportedRequirementItem({ item }: { item: UnsupportedRequirement }) {
  return (
    <li className="space-y-2 rounded-md border bg-destructive/5 p-3">
      <div className="text-sm text-foreground">{item.requirement}</div>
      <div className="text-xs text-muted-foreground">{item.reason}</div>
    </li>
  )
}

function EmptyRequirementState({ label }: { label: string }) {
  return <p className="text-sm text-muted-foreground">{label}</p>
}

export function ResumeGapReportPanel({ gapReport }: ResumeGapReportPanelProps) {
  const supportedCount = gapReport.supported_requirements.length
  const partialCount = gapReport.partially_supported_requirements.length
  const unsupportedCount = gapReport.unsupported_requirements.length

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Gap Report</CardTitle>
            <CardDescription>
              Requirement support from selected evidence, education, and certification sources.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{supportedCount} supported</Badge>
            <Badge variant="outline">{partialCount} partial</Badge>
            <Badge variant={unsupportedCount > 0 ? 'destructive' : 'outline'}>
              {unsupportedCount} unsupported
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {gapReport.risk_flags.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                {gapReport.risk_flags.map((flag) => (
                  <div key={flag}>{flag}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 xl:grid-cols-3">
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Supported</h3>
            {supportedCount === 0 ? (
              <EmptyRequirementState label="No fully supported requirements reported." />
            ) : (
              <ul className="space-y-2">
                {gapReport.supported_requirements.map((item) => (
                  <SupportedRequirementItem key={item.requirement} item={item} />
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Partial</h3>
            {partialCount === 0 ? (
              <EmptyRequirementState label="No partially supported requirements reported." />
            ) : (
              <ul className="space-y-2">
                {gapReport.partially_supported_requirements.map((item) => (
                  <PartialRequirementItem key={item.requirement} item={item} />
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Unsupported</h3>
            {unsupportedCount === 0 ? (
              <EmptyRequirementState label="No unsupported requirements reported." />
            ) : (
              <ul className="space-y-2">
                {gapReport.unsupported_requirements.map((item) => (
                  <UnsupportedRequirementItem key={item.requirement} item={item} />
                ))}
              </ul>
            )}
          </section>
        </div>

        {gapReport.compensation_strategy.length > 0 && (
          <section className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <h3 className="text-sm font-medium">Compensation Strategy</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {gapReport.compensation_strategy.map((item) => (
                <li key={item} className="flex gap-2">
                  <span>-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  )
}

function statusClassName(status: ConstraintFlagStatus): string {
  switch (status) {
    case 'passed':
      return 'border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-400'
    case 'warning':
      return 'border-yellow-600/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
    case 'failed':
      return 'border-destructive/40 bg-destructive/5 text-destructive'
  }
}

function StatusIcon({ status }: { status: ConstraintFlagStatus }) {
  if (status === 'passed') return <CheckCircle2 className="h-3.5 w-3.5" />
  if (status === 'warning') return <AlertTriangle className="h-3.5 w-3.5" />
  return <XCircle className="h-3.5 w-3.5" />
}

export function ResumeAssemblyAuditPanel({ constraintFlags, notes }: ResumeAssemblyAuditPanelProps) {
  if (constraintFlags.length === 0 && notes.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assembly Audit</CardTitle>
        <CardDescription>
          Constraint checks and assembler notes for this generated preview.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-3">
          <h3 className="text-sm font-medium">Constraint Flags</h3>
          {constraintFlags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No constraint flags reported.</p>
          ) : (
            <ul className="space-y-2">
              {constraintFlags.map((flag) => (
                <li key={`${flag.rule}-${flag.note}`} className="rounded-md border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={cn('border', statusClassName(flag.status))} variant="outline">
                      <StatusIcon status={flag.status} />
                      <span className="ml-1 capitalize">{flag.status}</span>
                    </Badge>
                    <span className="text-sm font-medium text-foreground">{flag.rule}</span>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">{flag.note}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Assembler Notes</h3>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assembly notes reported.</p>
          ) : (
            <ul className="space-y-2">
              {notes.map((note) => (
                <li key={note} className="flex gap-2 rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                  <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  )
}