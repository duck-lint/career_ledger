import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MinWidthGuard } from '@/components/MinWidthGuard'
import LibraryView from '@/components/views/LibraryView'
import TaxonomyView from '@/components/views/TaxonomyView'
import ResumeGenerationView from '@/components/views/ResumeGenerationView'
import OperationsView from '@/components/views/OperationsView'
import SettingsView from '@/components/views/SettingsView'
import { runtimeAdminService } from '@/lib/service'
import { appRuntime } from '@/lib/runtime'
import { clearStoredDbPath, getStoredDbPath } from '@/lib/runtime-settings'
import { Toaster } from 'sonner'

const TAB_STORAGE_KEY = 'career-ledger:active-tab'
const VALID_TABS = ['library', 'taxonomy', 'resume', 'operations', 'settings'] as const

function readInitialTab(): string {
  if (typeof window === 'undefined') return 'library'
  try {
    const stored = window.sessionStorage.getItem(TAB_STORAGE_KEY)
    if (stored && (VALID_TABS as readonly string[]).includes(stored)) {
      return stored
    }
  } catch {
    // sessionStorage may be unavailable (sandboxed, private mode); fall through.
  }
  return 'library'
}

function App() {
  const [activeTab, setActiveTab] = useState<string>(readInitialTab)
  const [isInitialized, setIsInitialized] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const isTauri = appRuntime.isTauri

  useEffect(() => {
    try {
      window.sessionStorage.setItem(TAB_STORAGE_KEY, activeTab)
    } catch {
      // ignore quota/availability errors; persistence is best-effort.
    }
  }, [activeTab])

  useEffect(() => {
    let cancelled = false

    const initialize = async () => {
      try {
        const storedDbPath = isTauri ? getStoredDbPath() : null

        try {
          await runtimeAdminService.initialize(storedDbPath)
        } catch (error) {
          if (!storedDbPath) {
            throw error
          }

          clearStoredDbPath()
          await runtimeAdminService.initialize()
        }

        if (!cancelled) {
          setInitError(null)
          setIsInitialized(true)
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Failed to initialize the data store'
          setInitError(message)
        }
      }
    }

    void initialize()

    return () => {
      cancelled = true
    }
  }, [isTauri])

  if (initError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <Alert variant="destructive" className="max-w-xl">
          <AlertDescription>{initError}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <MinWidthGuard>
      <div className="min-h-screen bg-background">
        <Toaster />
        <div className="border-b border-border bg-card">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Career Ledger
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  SQLite-backed library, taxonomy, resume generation, operations, and import management
                </p>
              </div>
              <span
                className="mono inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-muted-foreground"
                title={appRuntime.description}
              >
                <span
                  aria-hidden
                  className={
                    isTauri
                      ? 'inline-block size-1.5 rounded-full bg-accent'
                      : 'inline-block size-1.5 rounded-full bg-muted-foreground'
                  }
                />
                {appRuntime.label}
              </span>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="library">Library</TabsTrigger>
              <TabsTrigger value="taxonomy">Taxonomy</TabsTrigger>
              <TabsTrigger value="resume">Resume</TabsTrigger>
              <TabsTrigger value="operations">Operations</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="library" className="mt-0">
              <LibraryView />
            </TabsContent>

            <TabsContent value="taxonomy" className="mt-0">
              <TaxonomyView />
            </TabsContent>

            <TabsContent value="resume" className="mt-0">
              <ResumeGenerationView />
            </TabsContent>

            <TabsContent value="operations" className="mt-0">
              <OperationsView />
            </TabsContent>

            <TabsContent value="settings" className="mt-0">
              <SettingsView />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MinWidthGuard>
  )
}

export default App
