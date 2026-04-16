import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { FallbackProps } from 'react-error-boundary'

import { Alert, AlertTitle, AlertDescription } from './components/ui/alert'
import { Button } from './components/ui/button'

export const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  // In dev, rethrow so the runtime overlay can surface the real stack.
  if (import.meta.env.DEV) throw error

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            Career Ledger hit an unexpected error. You can try again, or restart the app if the problem persists.
          </AlertDescription>
        </Alert>

        <div className="rounded-md border border-border bg-card px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Error detail
          </p>
          <pre className="mono mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words text-xs text-destructive">
            {error.message}
          </pre>
        </div>

        <Button onClick={resetErrorBoundary} className="w-full" variant="outline">
          <RefreshCw />
          Try again
        </Button>
      </div>
    </div>
  )
}
