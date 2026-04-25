import { useEffect, useState } from 'react'
import { Monitor } from 'lucide-react'

const MIN_WIDTH_PX = 1280

/**
 * Shows a full-screen overlay when the viewport is narrower than the
 * minimum supported width. Career Ledger is explicitly a desktop app
 * with a minimum 1280px layout; the overlay communicates this rather
 * than letting the app render in a broken layout.
 */
export function MinWidthGuard({ children }: { children: React.ReactNode }) {
  const [narrow, setNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MIN_WIDTH_PX : false,
  )

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MIN_WIDTH_PX - 1}px)`)
    const handler = (event: MediaQueryListEvent) => setNarrow(event.matches)

    setNarrow(query.matches)
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }, [])

  return (
    <>
      {children}
      {narrow ? (
        <div
          role="alertdialog"
          aria-labelledby="min-width-title"
          aria-describedby="min-width-body"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm p-6"
        >
          <div className="max-w-md rounded-lg border border-border bg-card p-6 shadow-md text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent/10 text-accent-foreground">
              <Monitor className="size-6" aria-hidden />
            </div>
            <h2
              id="min-width-title"
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              Window too narrow
            </h2>
            <p id="min-width-body" className="mt-2 text-sm text-muted-foreground">
              Career Ledger is a desktop-first application and needs at least
              {' '}
              <span className="mono text-foreground">{MIN_WIDTH_PX}px</span>
              {' '}
              of horizontal space. Expand the window or move to a larger display
              to continue.
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}
