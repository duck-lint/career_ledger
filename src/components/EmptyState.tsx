import type { ComponentType, ReactNode } from 'react'
import type { LucideProps } from 'lucide-react'
import { cn } from '@/lib/utils'

type EmptyStateProps = {
  icon?: ComponentType<LucideProps>
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

/**
 * Friendly inline placeholder for zero-state views. Replaces the repeated
 * "<Alert><AlertDescription>No items</AlertDescription></Alert>" pattern.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/50 px-6 py-12 text-center',
        className,
      )}
      role="status"
    >
      {Icon ? (
        <div className="rounded-full bg-muted p-3 text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}
