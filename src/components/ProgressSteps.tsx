import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ProgressStepStatus = 'pending' | 'active' | 'done' | 'error'

export type ProgressStep = {
  id: string
  label: string
  status: ProgressStepStatus
  detail?: string
}

type ProgressStepsProps = {
  steps: ProgressStep[]
  className?: string
}

/**
 * Horizontal stepper used to surface multi-stage pipelines (resume generation,
 * taxonomy refresh, etc.). Renders the label, status indicator and optional
 * per-step detail text.
 */
export function ProgressSteps({ steps, className }: ProgressStepsProps) {
  return (
    <ol
      className={cn(
        'flex flex-wrap items-stretch gap-3 rounded-lg border border-border bg-card/60 p-3',
        className,
      )}
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        return (
          <li key={step.id} className="flex min-w-[10rem] flex-1 items-center gap-3">
            <StepMarker step={step} index={index} />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm font-medium',
                  step.status === 'error' ? 'text-destructive' : 'text-foreground',
                )}
              >
                {step.label}
              </p>
              {step.detail ? (
                <p className="truncate text-xs text-muted-foreground">{step.detail}</p>
              ) : null}
            </div>
            {!isLast ? (
              <span
                aria-hidden
                className="hidden h-px flex-1 bg-border md:block"
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function StepMarker({ step, index }: { step: ProgressStep; index: number }) {
  const base = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold'
  if (step.status === 'done') {
    return (
      <span className={cn(base, 'bg-primary text-primary-foreground')} aria-label="Completed">
        <Check className="h-4 w-4" />
      </span>
    )
  }
  if (step.status === 'active') {
    return (
      <span className={cn(base, 'bg-accent/15 text-foreground')} aria-label="In progress">
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
    )
  }
  if (step.status === 'error') {
    return (
      <span className={cn(base, 'bg-destructive text-white')} aria-label="Failed">
        !
      </span>
    )
  }
  return (
    <span className={cn(base, 'border border-border bg-background text-muted-foreground')}>
      {index + 1}
    </span>
  )
}
