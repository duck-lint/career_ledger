import { useEffect, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { intakeService, runtimeAdminService } from '@/lib/service'
import { runtimeSupports } from '@/lib/runtime'
import { clearStoredDbPath, getStoredDbPath, setStoredDbPath } from '@/lib/runtime-settings'
import type {
  RawIntakeImportSkipReason,
  RawIntakeImportResult,
  RawIntakePreviewResult,
} from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle as Warning, RefreshCw as ArrowClockwise, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'

function formatSkipReason(reason: RawIntakeImportSkipReason): string {
  switch (reason) {
    case 'ambiguous_item':
      return 'Ambiguous item'
    case 'duplicate_claim':
      return 'Duplicate claim'
    case 'duplicate_intake_id':
      return 'Already imported or repeated intake id'
    case 'empty_raw_text':
      return 'Empty raw text'
    case 'invalid_item':
      return 'Invalid item'
    case 'missing_target_record':
      return 'Missing target record, add it and retry'
    case 'unknown_target_record':
      return 'Unknown target record, add it and retry'
    case 'unsupported_action':
      return 'Unsupported action'
    case 'zero_inferred_tags':
      return 'Zero inferred tags'
  }
}

function formatPreviewAction(action: string): string {
  switch (action) {
    case 'targeted_evidence':
      return 'Targeted evidence'
    case 'grouped_experience_record':
      return 'Grouped experience'
    case 'duplicate_intake_id_check':
      return 'Duplicate intake id check'
    case 'parse':
      return 'Parse'
    case 'skip':
      return 'Skipped by rule'
    default:
      return action.replace(/_/g, ' ')
  }
}

export default function SettingsView() {
  const canSelectDbPath = runtimeSupports('databasePathSelection')
  const canImportRawIntake = runtimeSupports('rawIntakeImport')
  const [dbPath, setDbPath] = useState('')
  const [activeDbPath, setActiveDbPath] = useState('')
  const [dbPathLoading, setDbPathLoading] = useState(false)
  const [dbPathApplying, setDbPathApplying] = useState(false)
  const [dbPathError, setDbPathError] = useState<string | null>(null)
  const [rawImportPath, setRawImportPath] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [previewResult, setPreviewResult] = useState<RawIntakePreviewResult | null>(null)
  const [importResult, setImportResult] = useState<RawIntakeImportResult | null>(null)

  useEffect(() => {
    if (!canSelectDbPath) {
      return
    }

    let cancelled = false

    const loadDbPath = async () => {
      setDbPathLoading(true)
      try {
        const resolvedPath = await runtimeAdminService.getActiveDbPath()
        if (cancelled) {
          return
        }

        setActiveDbPath(resolvedPath)
        setDbPath(getStoredDbPath() ?? resolvedPath)
        setDbPathError(null)
      } catch (error) {
        if (cancelled) {
          return
        }

        const message = error instanceof Error ? error.message : 'Failed to load the active database path'
        setDbPathError(message)
      } finally {
        if (!cancelled) {
          setDbPathLoading(false)
        }
      }
    }

    void loadDbPath()

    return () => {
      cancelled = true
    }
  }, [canSelectDbPath])

  const handleBrowseDb = async () => {
    if (!canSelectDbPath) {
      return
    }

    try {
      const selected = await open({
        directory: false,
        multiple: false,
        filters: [{ name: 'SQLite Databases', extensions: ['db', 'sqlite', 'sqlite3'] }],
      })

      if (typeof selected === 'string') {
        setDbPath(selected)
        setDbPathError(null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to browse for database file'
      toast.error(message)
    }
  }

  const handleApplyDbPath = async () => {
    if (!canSelectDbPath) {
      return
    }

    const requestedPath = dbPath.trim()

    setDbPathApplying(true)
    setDbPathError(null)
    try {
      await runtimeAdminService.initialize(requestedPath || null)
      const resolvedPath = await runtimeAdminService.getActiveDbPath()
      setActiveDbPath(resolvedPath)

      if (requestedPath) {
        setStoredDbPath(resolvedPath)
      } else {
        clearStoredDbPath()
      }

      window.location.reload()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply database path'
      setDbPathError(message)
      toast.error(message)
    } finally {
      setDbPathApplying(false)
    }
  }

  const handleBrowse = async () => {
    if (!canImportRawIntake) {
      return
    }

    try {
      const selected = await open({
        directory: false,
        multiple: false,
        filters: [
          { name: 'Intake Files', extensions: ['yaml', 'yml', 'json'] },
          { name: 'YAML', extensions: ['yaml', 'yml'] },
          { name: 'JSON', extensions: ['json'] },
        ],
      })

      if (typeof selected === 'string') {
        setRawImportPath(selected)
        setPreviewResult(null)
        setImportResult(null)
        setPreviewError(null)
        setImportError(null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to browse for intake file'
      toast.error(message)
    }
  }

  const handleRawImportPathChange = (value: string) => {
    setRawImportPath(value)
    setPreviewResult(null)
    setImportResult(null)
    setPreviewError(null)
    setImportError(null)
  }

  const handlePreview = async () => {
    const requestedPath = rawImportPath.trim()
    if (!requestedPath) {
      setPreviewError('Enter a raw intake file path first.')
      return
    }

    setPreviewing(true)
    setPreviewError(null)
    setImportError(null)
    setPreviewResult(null)
    setImportResult(null)
    try {
      const result = await intakeService.previewRawIntake(requestedPath)
      setPreviewResult(result)
      toast.success(
        `Preview ready: ${result.would_import_record_count} record(s), ${result.would_import_evidence_count} evidence item(s), ${result.skipped_count} skipped`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Raw intake preview failed'
      setPreviewError(message)
      toast.error(message)
    } finally {
      setPreviewing(false)
    }
  }

  const handleImport = async () => {
    const requestedPath = rawImportPath.trim()
    if (!requestedPath) {
      setImportError('Enter a raw intake file path first.')
      return
    }

    if (!previewResult || previewResult.source_path !== requestedPath) {
      setImportError('Preview this raw intake file before importing it.')
      return
    }

    setImporting(true)
    setImportError(null)
    setImportResult(null)
    try {
      const result = await intakeService.importRawIntake(requestedPath)
      setImportResult(result)
      setPreviewResult(null)

      if (result.success) {
        toast.success(
          `Imported ${result.imported_record_count} record(s) and ${result.imported_evidence_count} evidence item(s)`
        )
      } else {
        toast.error(result.error || 'Raw intake import failed')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Raw intake import failed'
      setImportError(message)
      toast.error(message)
    } finally {
      setImporting(false)
    }
  }

  const rawImportPathReady = rawImportPath.trim().length > 0
  const previewMatchesCurrentPath = Boolean(
    previewResult && previewResult.source_path === rawImportPath.trim(),
  )

  const handleReset = async () => {
    try {
      await runtimeAdminService.reset()
      toast.success('Data reset to empty first-run state')
      window.location.reload()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset data'
      toast.error(message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Database Path</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canSelectDbPath ? (
            <>
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Active database</div>
                <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground break-all">
                  {dbPathLoading ? 'Loading database path...' : activeDbPath || 'Database path unavailable'}
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <Input
                  value={dbPath}
                  onChange={(event) => setDbPath(event.target.value)}
                  placeholder="C:\\path\\to\\career.db"
                  className="flex-1"
                  disabled={dbPathApplying}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleBrowseDb()}
                  disabled={dbPathApplying || dbPathLoading}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Browse
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleApplyDbPath()}
                  disabled={dbPathApplying || dbPathLoading}
                >
                  {dbPathApplying ? 'Applying...' : 'Apply Database'}
                </Button>
              </div>

              <Alert>
                <AlertDescription>
                  Browse selects an existing SQLite file. Leave the field blank and apply to use
                  the default app-local database. Applying a new path reloads the app.
                </AlertDescription>
              </Alert>

              {dbPathError && (
                <Alert variant="destructive">
                  <Warning className="h-4 w-4" />
                  <AlertDescription>{dbPathError}</AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <Alert>
              <AlertDescription>
                Database path settings are desktop-only. The browser harness uses localStorage and cannot open or switch SQLite files.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bulk Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canImportRawIntake ? (
            <>
              <div className="flex flex-col gap-3 md:flex-row">
                <Input
                  value={rawImportPath}
                  onChange={(event) => handleRawImportPathChange(event.target.value)}
                  placeholder="C:\\path\\to\\raw-intake.yaml"
                  className="flex-1"
                  disabled={previewing || importing}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleBrowse()}
                  disabled={previewing || importing}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Browse
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handlePreview()}
                  disabled={previewing || importing || !rawImportPathReady}
                >
                  {previewing ? 'Previewing...' : 'Preview Raw Intake'}
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={previewing || importing || !previewMatchesCurrentPath}
                >
                  {importing ? 'Importing...' : 'Import Preview'}
                </Button>
              </div>
              <Alert>
                <AlertDescription>
                  Preview checks the file with the same parser, target resolution, tag inference,
                  duplicate detection, and skip rules used by import. Import revalidates before it
                  writes records, evidence, import rows, or anomalies.
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <Alert>
              <AlertDescription>
                Bulk import is desktop-only. The browser harness cannot open local files or run the Rust intake pipeline.
              </AlertDescription>
            </Alert>
          )}

          {previewError && (
            <Alert variant="destructive">
              <Warning className="h-4 w-4" />
              <AlertDescription>{previewError}</AlertDescription>
            </Alert>
          )}

          {importError && (
            <Alert variant="destructive">
              <Warning className="h-4 w-4" />
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          )}

          {previewResult && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Preview ready</Badge>
                <Badge variant="outline" className="mono text-xs">
                  items: {previewResult.total_item_count}
                </Badge>
                <Badge variant="outline" className="mono text-xs">
                  records: {previewResult.would_import_record_count}
                </Badge>
                <Badge variant="outline" className="mono text-xs">
                  evidence: {previewResult.would_import_evidence_count}
                </Badge>
                <Badge variant="outline" className="mono text-xs">
                  skipped: {previewResult.skipped_count}
                </Badge>
              </div>

              {!previewMatchesCurrentPath && (
                <Alert>
                  <AlertDescription>
                    The file path changed after this preview. Preview the current path before importing.
                  </AlertDescription>
                </Alert>
              )}

              {previewResult.skip_reasons.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">Preview Skips</div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {previewResult.skip_reasons.map((entry) => (
                      <div key={entry.reason} className="flex items-center justify-between gap-3">
                        <span>{formatSkipReason(entry.reason)}</span>
                        <span className="mono text-xs">{entry.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewResult.duplicate_intake_ids.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">
                    Previously Imported or Repeated Intake IDs
                  </div>
                  <div className="max-h-32 space-y-1 overflow-auto rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                    {previewResult.duplicate_intake_ids.map((intakeId) => (
                      <div key={intakeId} className="mono">
                        {intakeId}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewResult.items.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">Item Outcomes</div>
                  <div className="max-h-72 space-y-2 overflow-auto rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                    {previewResult.items.map((item, index) => (
                      <div key={`${item.item_ref}-${index}`} className="space-y-2 rounded-md border bg-background/70 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={item.outcome === 'would_import' ? 'secondary' : 'outline'}>
                            {item.outcome === 'would_import' ? 'Would import' : 'Skipped'}
                          </Badge>
                          <Badge variant="outline" className="mono text-[10px]">
                            {item.item_ref}
                          </Badge>
                          <Badge variant="outline">{formatPreviewAction(item.action)}</Badge>
                          {item.target_record_slug && (
                            <Badge variant="outline" className="mono text-[10px]">
                              {item.target_record_slug}
                            </Badge>
                          )}
                          {item.would_create_record && <Badge variant="secondary">new record</Badge>}
                          {item.would_create_evidence && <Badge variant="secondary">new evidence</Badge>}
                        </div>
                        <div className="whitespace-pre-wrap">{item.message}</div>
                        {item.repair_hint && (
                          <div className="rounded bg-muted/50 p-2">
                            Repair: {item.repair_hint}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {importResult && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={importResult.success ? 'secondary' : 'destructive'}>
                  {importResult.success ? 'Success' : 'Failed'}
                </Badge>
                <Badge variant="outline" className="mono text-xs">
                  records: {importResult.imported_record_count}
                </Badge>
                <Badge variant="outline" className="mono text-xs">
                  evidence: {importResult.imported_evidence_count}
                </Badge>
                <Badge variant="outline" className="mono text-xs">
                  skipped: {importResult.skipped_count}
                </Badge>
              </div>

              {importResult.error && (
                <Alert variant="destructive">
                  <Warning className="h-4 w-4" />
                  <AlertDescription>{importResult.error}</AlertDescription>
                </Alert>
              )}

              {importResult.skip_reasons.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">Skipped</div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {importResult.skip_reasons.map((entry) => (
                      <div key={entry.reason} className="flex items-center justify-between gap-3">
                        <span>{formatSkipReason(entry.reason)}</span>
                        <span className="mono text-xs">{entry.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResult.duplicate_intake_ids.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">
                    Previously Imported or Repeated Intake IDs
                  </div>
                  <div className="max-h-40 space-y-1 overflow-auto rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                    {importResult.duplicate_intake_ids.map((intakeId) => (
                      <div key={intakeId} className="mono">
                        {intakeId}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResult.messages.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">Messages</div>
                  <div className="max-h-48 space-y-1 overflow-auto rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                    {importResult.messages.map((message) => (
                      <div key={message} className="whitespace-pre-wrap">
                        {message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Reset to Empty First-Run State</h3>
            <p className="text-sm text-muted-foreground">
              Clears records, evidence, candidate profile data, anomalies, generation manifests,
              and import history, then returns the active runtime to empty first-run state.
            </p>
            <Button onClick={handleReset} variant="outline">
              <ArrowClockwise className="mr-2" />
              Reset Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
