import { useEffect, useState } from 'react'
import { open, save } from '@tauri-apps/plugin-dialog'
import { careerService } from '@/lib/service'
import type {
  CanonicalTag,
  LibraryTagRefreshResult,
  LibraryTagSyncStatus,
  TagInferenceMarker,
  TagInferenceMarkerInput,
  TaxonomyImportResult,
} from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from '@phosphor-icons/react/dist/icons/Plus'
import { Pencil } from '@phosphor-icons/react/dist/icons/Pencil'
import { Trash } from '@phosphor-icons/react/dist/icons/Trash'
import { ArrowsClockwise } from '@phosphor-icons/react/dist/icons/ArrowsClockwise'
import { toast } from 'sonner'
import TagDialog from '@/components/dialogs/TagDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type MarkerForm = {
  markerKind: 'literal' | 'compound'
  literalValue: string
  allOf: string
  anyOf: string
}

function parseList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function markerToForm(marker: TagInferenceMarker): MarkerForm {
  const allOf = marker.terms
    .filter((term) => term.termGroup === 'all_of')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((term) => term.termValue)
    .join(', ')
  const anyOf = marker.terms
    .filter((term) => term.termGroup === 'any_of')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((term) => term.termValue)
    .join(', ')

  return {
    markerKind: marker.markerKind === 'compound' ? 'compound' : 'literal',
    literalValue: marker.literalValue ?? '',
    allOf,
    anyOf,
  }
}

function markerFormToInput(form: MarkerForm): TagInferenceMarkerInput {
  return {
    markerKind: form.markerKind,
    literalValue: form.markerKind === 'literal' ? form.literalValue : null,
    allOf: form.markerKind === 'compound' ? parseList(form.allOf) : [],
    anyOf: form.markerKind === 'compound' ? parseList(form.anyOf) : [],
  }
}

function formatSyncTimestamp(value: string | null): string {
  return value ?? 'Not yet recorded'
}

export default function TaxonomyView() {
  const isTauri = '__TAURI_INTERNALS__' in window
  const [canonicalTags, setCanonicalTags] = useState<CanonicalTag[]>([])
  const [selectedTag, setSelectedTag] = useState('')
  const [markerForms, setMarkerForms] = useState<MarkerForm[]>([])
  const [markersLoading, setMarkersLoading] = useState(false)
  const [markerSavePending, setMarkerSavePending] = useState(false)
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<CanonicalTag | null>(null)
  const [taxonomyOpPending, setTaxonomyOpPending] = useState(false)
  const [taxonomyImportResult, setTaxonomyImportResult] = useState<TaxonomyImportResult | null>(null)
  const [libraryTagRefreshResult, setLibraryTagRefreshResult] = useState<LibraryTagRefreshResult | null>(null)
  const [libraryTagSyncStatus, setLibraryTagSyncStatus] = useState<LibraryTagSyncStatus | null>(null)
  const [libraryTagRefreshPending, setLibraryTagRefreshPending] = useState(false)
  const [confirmState, setConfirmState] = useState<
    | { kind: 'import'; path: string }
    | { kind: 'reset' }
    | null
  >(null)

  const loadTaxonomyData = async (): Promise<string> => {
    const tagsData = await careerService.getCanonicalTags()
    let nextSelectedTag = ''

    setCanonicalTags(tagsData)
    setSelectedTag((current) => {
      if (current && tagsData.some((tag) => tag.tag === current)) {
        nextSelectedTag = current
        return current
      }
      nextSelectedTag = tagsData[0]?.tag ?? ''
      return nextSelectedTag
    })

    return nextSelectedTag
  }

  const loadMarkers = async (tag: string) => {
    if (!tag) {
      setMarkerForms([])
      return
    }

    setMarkersLoading(true)
    try {
      const markers = await careerService.getTagInferenceMarkers(tag)
      setMarkerForms(markers.map(markerToForm))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load markers')
      setMarkerForms([])
    } finally {
      setMarkersLoading(false)
    }
  }

  const loadLibraryTagSyncStatus = async () => {
    try {
      const nextStatus = await careerService.getLibraryTagSyncStatus()
      setLibraryTagSyncStatus(nextStatus)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load library tag sync status')
    }
  }

  const refreshTaxonomySurface = async () => {
    const nextSelectedTag = await loadTaxonomyData()
    await Promise.all([loadMarkers(nextSelectedTag), loadLibraryTagSyncStatus()])
  }

  useEffect(() => {
    void refreshTaxonomySurface()
  }, [])

  useEffect(() => {
    void loadMarkers(selectedTag)
  }, [selectedTag])

  const handleCreateTag = () => {
    setEditingTag(null)
    setTagDialogOpen(true)
  }

  const handleEditTag = (tag: CanonicalTag) => {
    setEditingTag(tag)
    setTagDialogOpen(true)
  }

  const handleDeleteTag = async (tag: CanonicalTag) => {
    try {
      await careerService.deleteCanonicalTag(tag.tag)
      await loadTaxonomyData()
      toast.success(`Tag "${tag.tag}" deleted`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete tag')
    }
  }

  const handleSaveTag = async () => {
    await refreshTaxonomySurface()
    setTagDialogOpen(false)
  }

  const updateMarkerForm = (index: number, patch: Partial<MarkerForm>) => {
    setMarkerForms((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    )
  }

  const addLiteralMarker = () => {
    setMarkerForms((current) => [
      ...current,
      { markerKind: 'literal', literalValue: '', allOf: '', anyOf: '' },
    ])
  }

  const addCompoundMarker = () => {
    setMarkerForms((current) => [
      ...current,
      { markerKind: 'compound', literalValue: '', allOf: '', anyOf: '' },
    ])
  }

  const removeMarker = (index: number) => {
    setMarkerForms((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const handleSaveMarkers = async () => {
    if (!selectedTag) {
      return
    }

    setMarkerSavePending(true)
    try {
      const updated = await careerService.replaceTagInferenceMarkers(
        selectedTag,
        markerForms.map(markerFormToInput)
      )
      setMarkerForms(updated.map(markerToForm))
      await loadLibraryTagSyncStatus()
      toast.success(`Markers updated for "${selectedTag}"`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save markers')
    } finally {
      setMarkerSavePending(false)
    }
  }

  const handleBrowseImportTaxonomy = async () => {
    if (!isTauri) {
      toast.error('Taxonomy import is available only in the Tauri desktop runtime.')
      return
    }

    try {
      const selected = await open({
        directory: false,
        multiple: false,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })

      if (typeof selected === 'string') {
        setConfirmState({ kind: 'import', path: selected })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to browse for taxonomy JSON')
    }
  }

  const handleExportTaxonomy = async () => {
    if (!isTauri) {
      toast.error('Taxonomy export is available only in the Tauri desktop runtime.')
      return
    }

    try {
      const selected = await save({
        defaultPath: 'taxonomy_export.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })

      if (typeof selected !== 'string') {
        return
      }

      setTaxonomyOpPending(true)
      const exportPath = await careerService.exportTaxonomy(selected)
      toast.success(`Taxonomy exported to ${exportPath}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export taxonomy')
    } finally {
      setTaxonomyOpPending(false)
    }
  }

  const handleConfirmDestructiveAction = async () => {
    if (!confirmState) {
      return
    }

    setTaxonomyOpPending(true)
    try {
      const result =
        confirmState.kind === 'import'
          ? await careerService.importTaxonomy(confirmState.path)
          : await careerService.resetTaxonomyToStarter()

      await refreshTaxonomySurface()
      setTaxonomyImportResult(result)
      setLibraryTagRefreshResult(null)
      setConfirmState(null)
      toast.success(
        confirmState.kind === 'import'
          ? 'Taxonomy imported and runtime tags rebuilt'
          : 'Starter taxonomy restored and runtime tags rebuilt'
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Taxonomy update failed')
    } finally {
      setTaxonomyOpPending(false)
    }
  }

  const handleReInferLibraryTags = async () => {
    setLibraryTagRefreshPending(true)
    try {
      const result = await careerService.reInferLibraryTags()
      await refreshTaxonomySurface()
      setLibraryTagRefreshResult(result)
      toast.success('Library tags re-inferred from the current taxonomy')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Library tag re-inference failed')
    } finally {
      setLibraryTagRefreshPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Taxonomy</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Maintain canonical tags, edit inference markers, and import or reset the runtime taxonomy.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void handleBrowseImportTaxonomy()} disabled={taxonomyOpPending}>
            Import Taxonomy
          </Button>
          <Button variant="outline" onClick={() => void handleExportTaxonomy()} disabled={taxonomyOpPending}>
            Export Taxonomy
          </Button>
          <Button variant="outline" onClick={() => setConfirmState({ kind: 'reset' })} disabled={taxonomyOpPending}>
            Reset to Starter
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleReInferLibraryTags()}
            disabled={taxonomyOpPending || libraryTagRefreshPending || !isTauri}
          >
            <ArrowsClockwise className="mr-2" />
            {libraryTagRefreshPending ? 'Re-inferring...' : 'Re-infer Library Tags'}
          </Button>
          <Button variant="outline" onClick={() => void refreshTaxonomySurface()} disabled={taxonomyOpPending}>
            <ArrowsClockwise className="mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {libraryTagSyncStatus?.requiresReinference && (
        <Alert>
          <AlertDescription>
            Taxonomy changes have not been backfilled into the library yet. Existing evidence tags and record context tags may be stale until you run Re-infer Library Tags.
          </AlertDescription>
        </Alert>
      )}

      {libraryTagSyncStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Library Tag Sync</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="font-medium">
                {libraryTagSyncStatus.requiresReinference ? 'Re-inference required' : 'In sync'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Last taxonomy change</div>
              <div className="font-medium">{formatSyncTimestamp(libraryTagSyncStatus.lastTaxonomyChangeAt)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Last library refresh</div>
              <div className="font-medium">{formatSyncTimestamp(libraryTagSyncStatus.lastLibraryTagRefreshAt)}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {libraryTagRefreshResult && (
        <Card>
          <CardHeader>
            <CardTitle>Last Library Re-inference</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm text-muted-foreground">Version</div>
              <div className="font-medium">{libraryTagRefreshResult.taxonomyVersion}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Retagged evidence</div>
              <div className="font-medium">{libraryTagRefreshResult.retaggedEvidenceCount}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Rebuilt records</div>
              <div className="font-medium">{libraryTagRefreshResult.rebuiltRecordCount}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Unknown profile tags</div>
              <div className="font-medium">{libraryTagRefreshResult.unknownCandidateProfileSignalTags.length}</div>
            </div>
            {libraryTagRefreshResult.unknownCandidateProfileSignalTags.length > 0 && (
              <div className="md:col-span-4">
                <Alert>
                  <AlertDescription>
                    Candidate-profile signal tags no longer in the canonical taxonomy: {libraryTagRefreshResult.unknownCandidateProfileSignalTags.join(', ')}
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {taxonomyImportResult && (
        <Card>
          <CardHeader>
            <CardTitle>Last Taxonomy Update</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm text-muted-foreground">Version</div>
              <div className="font-medium">{taxonomyImportResult.importedTaxonomyVersion}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Retagged evidence</div>
              <div className="font-medium">{taxonomyImportResult.retaggedEvidenceCount}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Rebuilt records</div>
              <div className="font-medium">{taxonomyImportResult.rebuiltRecordCount}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Unknown profile tags</div>
              <div className="font-medium">{taxonomyImportResult.unknownCandidateProfileSignalTags.length}</div>
            </div>
            {taxonomyImportResult.unknownCandidateProfileSignalTags.length > 0 && (
              <div className="md:col-span-4">
                <Alert>
                  <AlertDescription>
                    Candidate-profile signal tags no longer in the canonical taxonomy: {taxonomyImportResult.unknownCandidateProfileSignalTags.join(', ')}
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="tags" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tags">Canonical Tags</TabsTrigger>
          <TabsTrigger value="markers">Inference Markers</TabsTrigger>
        </TabsList>

        <TabsContent value="tags" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleCreateTag}>
              <Plus className="mr-2" />
              New Canonical Tag
            </Button>
          </div>

          {canonicalTags.length === 0 ? (
            <Alert>
              <AlertDescription>
                No canonical tags defined. Create your first tag to get started.
              </AlertDescription>
            </Alert>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Canonical Tags ({canonicalTags.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tag</TableHead>
                      <TableHead>Display Label</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {canonicalTags.map((tag) => (
                      <TableRow key={tag.id}>
                        <TableCell>
                          <Badge className="mono">{tag.tag}</Badge>
                        </TableCell>
                        <TableCell>{tag.display_label || '-'}</TableCell>
                        <TableCell>
                          {tag.category ? <Badge variant="secondary">{tag.category}</Badge> : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tag.description || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditTag(tag)}>
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void handleDeleteTag(tag)}
                            >
                              <Trash />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="markers" className="space-y-4">
          {canonicalTags.length === 0 ? (
            <Alert>
              <AlertDescription>
                Create at least one canonical tag before editing inference markers.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Canonical Tags</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {canonicalTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                        selectedTag === tag.tag
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted'
                      }`}
                      onClick={() => setSelectedTag(tag.tag)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge className="mono">{tag.tag}</Badge>
                        <span className="text-xs text-muted-foreground">{tag.display_label}</span>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    Inference Markers {selectedTag ? <span className="mono">for {selectedTag}</span> : ''}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      Every canonical tag must keep at least one marker.
                    </AlertDescription>
                  </Alert>

                  {markersLoading ? (
                    <Alert>
                      <AlertDescription>Loading markers…</AlertDescription>
                    </Alert>
                  ) : markerForms.length === 0 ? (
                    <Alert>
                      <AlertDescription>No markers loaded for the selected tag.</AlertDescription>
                    </Alert>
                  ) : (
                    markerForms.map((marker, index) => (
                      <div key={`${selectedTag}-${index}`} className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">Marker {index + 1}</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMarker(index)}
                            disabled={markerForms.length === 1}
                          >
                            <Trash />
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <Label>Marker Type</Label>
                          <Select
                            value={marker.markerKind}
                            onValueChange={(value) =>
                              updateMarkerForm(index, {
                                markerKind: value as 'literal' | 'compound',
                                literalValue: value === 'literal' ? marker.literalValue : '',
                                allOf: value === 'compound' ? marker.allOf : '',
                                anyOf: value === 'compound' ? marker.anyOf : '',
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="literal">Literal</SelectItem>
                              <SelectItem value="compound">Compound</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {marker.markerKind === 'literal' ? (
                          <div className="space-y-2">
                            <Label>Literal Value</Label>
                            <Input
                              value={marker.literalValue}
                              onChange={(event) =>
                                updateMarkerForm(index, { literalValue: event.target.value })
                              }
                              placeholder="workday"
                            />
                          </div>
                        ) : (
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>All Of Terms</Label>
                              <Textarea
                                value={marker.allOf}
                                onChange={(event) =>
                                  updateMarkerForm(index, { allOf: event.target.value })
                                }
                                placeholder="time, absence"
                                rows={3}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Any Of Terms</Label>
                              <Textarea
                                value={marker.anyOf}
                                onChange={(event) =>
                                  updateMarkerForm(index, { anyOf: event.target.value })
                                }
                                placeholder="report, reporting"
                                rows={3}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={addLiteralMarker}>
                      <Plus className="mr-2" />
                      Add Literal Marker
                    </Button>
                    <Button variant="outline" onClick={addCompoundMarker}>
                      <Plus className="mr-2" />
                      Add Compound Marker
                    </Button>
                    <Button
                      onClick={() => void handleSaveMarkers()}
                      disabled={markerSavePending || !selectedTag}
                    >
                      Save Markers
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TagDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        tag={editingTag}
        onSave={handleSaveTag}
      />

      <AlertDialog open={confirmState !== null} onOpenChange={(open) => !open && setConfirmState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmState?.kind === 'import'
                ? 'Import taxonomy and rebuild runtime tags?'
                : 'Reset taxonomy to starter and rebuild runtime tags?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState?.kind === 'import'
                ? 'This replaces the current canonical taxonomy, re-infers every evidence tag, rebuilds each record context tag set, and may leave candidate-profile signal tags orphaned until you update them manually.'
                : 'This restores the bundled starter taxonomy, re-infers every evidence tag, rebuilds each record context tag set, and may leave candidate-profile signal tags orphaned until you update them manually.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={taxonomyOpPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmDestructiveAction()} disabled={taxonomyOpPending}>
              {taxonomyOpPending ? 'Applying...' : 'Continue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
