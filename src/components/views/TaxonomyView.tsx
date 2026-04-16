import { useEffect, useMemo, useState } from 'react'
import { open, save } from '@tauri-apps/plugin-dialog'
import { careerService } from '@/lib/service'
import type {
  CanonicalTag,
  DeliveryToolkitCategory,
  LibraryTagRefreshResult,
  LibraryTagSyncStatus,
  TestMarkersResult,
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
import { Plus, Pencil, Trash2 as Trash, RefreshCw as ArrowsClockwise } from 'lucide-react'
import { toast } from 'sonner'
import TagDialog from '@/components/dialogs/TagDialog'
import TagInferenceMarkerEditor from '@/components/taxonomy/TagInferenceMarkerEditor'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  type TagInferenceMarkerDraft,
  tagInferenceMarkerDraftsToInputs,
  tagInferenceMarkersToDrafts,
} from '@/lib/tag-inference-marker-drafts'
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
import { ConfirmDialog } from '@/components/ConfirmDialog'

function formatSyncTimestamp(value: string | null): string {
  return value ?? 'Not yet recorded'
}

export default function TaxonomyView() {
  const isTauri = '__TAURI_INTERNALS__' in window
  const [canonicalTags, setCanonicalTags] = useState<CanonicalTag[]>([])
  const [categories, setCategories] = useState<DeliveryToolkitCategory[]>([])
  const [selectedTag, setSelectedTag] = useState('')
  const [markerDrafts, setMarkerDrafts] = useState<TagInferenceMarkerDraft[]>([])
  const [markersLoading, setMarkersLoading] = useState(false)
  const [markerSavePending, setMarkerSavePending] = useState(false)
  const [categoryDraft, setCategoryDraft] = useState('')
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null)
  const [categoryPending, setCategoryPending] = useState(false)
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<CanonicalTag | null>(null)
  const [taxonomyOpPending, setTaxonomyOpPending] = useState(false)
  const [taxonomyImportResult, setTaxonomyImportResult] = useState<TaxonomyImportResult | null>(null)
  const [libraryTagRefreshResult, setLibraryTagRefreshResult] = useState<LibraryTagRefreshResult | null>(null)
  const [libraryTagSyncStatus, setLibraryTagSyncStatus] = useState<LibraryTagSyncStatus | null>(null)
  const [libraryTagRefreshPending, setLibraryTagRefreshPending] = useState(false)
  const [confirmState, setConfirmState] = useState<
    | { kind: 'import'; path: string }
    | { kind: 'clear' }
    | null
  >(null)
  const [tagPendingDelete, setTagPendingDelete] = useState<CanonicalTag | null>(null)
  const [markerTestText, setMarkerTestText] = useState('')
  const [markerTestResult, setMarkerTestResult] = useState<TestMarkersResult | null>(null)
  const [markerTestPending, setMarkerTestPending] = useState(false)

  const loadTaxonomyData = async (): Promise<string> => {
    const [tagsData, categoryData] = await Promise.all([
      careerService.getCanonicalTags(),
      careerService.getDeliveryToolkitCategories(),
    ])
    let nextSelectedTag = ''

    setCanonicalTags(tagsData)
    setCategories(categoryData)
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
      setMarkerDrafts([])
      return
    }

    setMarkersLoading(true)
    try {
      const markers = await careerService.getTagInferenceMarkers(tag)
      setMarkerDrafts(tagInferenceMarkersToDrafts(markers))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load markers')
      setMarkerDrafts([])
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

  const categoryUsageCounts = useMemo(() => {
    const counts = new Map<string, number>()
    canonicalTags.forEach((tag) => {
      const categoryName = tag.category?.trim()
      if (!categoryName) {
        return
      }

      counts.set(categoryName, (counts.get(categoryName) ?? 0) + 1)
    })
    return counts
  }, [canonicalTags])

  const resetCategoryEditor = () => {
    setCategoryDraft('')
    setEditingCategoryName(null)
  }

  const handleSaveCategory = async () => {
    const normalizedCategory = categoryDraft.trim()
    if (!normalizedCategory) {
      toast.error('Category name is required')
      return
    }

    setCategoryPending(true)
    try {
      if (editingCategoryName) {
        await careerService.renameDeliveryToolkitCategory(editingCategoryName, normalizedCategory)
        toast.success(`Category renamed to "${normalizedCategory}"`)
      } else {
        await careerService.createDeliveryToolkitCategory(normalizedCategory)
        toast.success(`Category "${normalizedCategory}" created`)
      }

      await refreshTaxonomySurface()
      resetCategoryEditor()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save category')
    } finally {
      setCategoryPending(false)
    }
  }

  const handleEditCategory = (category: DeliveryToolkitCategory) => {
    setEditingCategoryName(category.name)
    setCategoryDraft(category.name)
  }

  const handleDeleteCategory = async (category: DeliveryToolkitCategory) => {
    setCategoryPending(true)
    try {
      await careerService.deleteDeliveryToolkitCategory(category.name)
      await refreshTaxonomySurface()
      if (editingCategoryName === category.name) {
        resetCategoryEditor()
      }
      toast.success(`Category "${category.name}" deleted`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete category')
    } finally {
      setCategoryPending(false)
    }
  }

  const handleCreateTag = () => {
    setEditingTag(null)
    setTagDialogOpen(true)
  }

  const handleEditTag = (tag: CanonicalTag) => {
    setEditingTag(tag)
    setTagDialogOpen(true)
  }

  const handleDeleteTag = async (tag: CanonicalTag) => {
    await careerService.deleteCanonicalTag(tag.tag)
    await refreshTaxonomySurface()
    toast.success(`Tag "${tag.tag}" deleted`)
  }

  const handleSaveTag = async () => {
    await refreshTaxonomySurface()
    setTagDialogOpen(false)
  }

  const handleSaveMarkers = async () => {
    if (!selectedTag) {
      return
    }

    setMarkerSavePending(true)
    try {
      const updated = await careerService.replaceTagInferenceMarkers(
        selectedTag,
        tagInferenceMarkerDraftsToInputs(markerDrafts)
      )
      setMarkerDrafts(tagInferenceMarkersToDrafts(updated))
      await loadLibraryTagSyncStatus()
      toast.success(`Markers updated for "${selectedTag}"`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save markers')
    } finally {
      setMarkerSavePending(false)
    }
  }

  const handleTestMarkers = async () => {
    if (!markerTestText.trim() || markerDrafts.length === 0) return
    setMarkerTestPending(true)
    setMarkerTestResult(null)
    try {
      const result = await careerService.testMarkers(
        markerTestText,
        tagInferenceMarkerDraftsToInputs(markerDrafts)
      )
      setMarkerTestResult(result)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Marker test failed')
    } finally {
      setMarkerTestPending(false)
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
          : await careerService.clearTaxonomy()

      await refreshTaxonomySurface()
      setTaxonomyImportResult(result)
      setLibraryTagRefreshResult(null)
      setConfirmState(null)
      toast.success(
        confirmState.kind === 'import'
          ? 'Taxonomy imported and runtime tags rebuilt'
          : 'Taxonomy cleared — all tags and categories removed'
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
          <Button variant="outline" onClick={() => setConfirmState({ kind: 'clear' })} disabled={taxonomyOpPending}>
            Clear Taxonomy
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleReInferLibraryTags()}
            disabled={taxonomyOpPending || libraryTagRefreshPending || !isTauri}
          >
            <ArrowsClockwise className="mr-2" />
            {libraryTagRefreshPending ? 'Re-inferring...' : 'Re-infer Library Tags'}
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

      <Card>
        <CardHeader>
          <CardTitle>Delivery Toolkit Categories ({categories.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="taxonomy-category-name">
                {editingCategoryName ? 'Rename Category' : 'New Category'}
              </Label>
              <Input
                id="taxonomy-category-name"
                value={categoryDraft}
                onChange={(event) => setCategoryDraft(event.target.value)}
                placeholder="Delivery toolkit category name"
                disabled={categoryPending}
              />
              <p className="text-xs text-muted-foreground">
                Categories are explicit taxonomy data now. Create the first category here before you create the first canonical tag.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleSaveCategory()} disabled={categoryPending}>
                {editingCategoryName ? 'Rename Category' : 'Create Category'}
              </Button>
              {editingCategoryName && (
                <Button variant="outline" onClick={resetCategoryEditor} disabled={categoryPending}>
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {categories.length === 0 ? (
            <Alert>
              <AlertDescription>
                No delivery toolkit categories exist yet. Create one here, then create the first canonical tag.
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Sort Order</TableHead>
                  <TableHead>Tags Using</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.name}>
                    <TableCell>
                      <Badge variant="secondary">{category.name}</Badge>
                    </TableCell>
                    <TableCell>{category.sort_order}</TableCell>
                    <TableCell>{categoryUsageCounts.get(category.name) ?? 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditCategory(category)}>
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDeleteCategory(category)}
                          disabled={categoryPending}
                        >
                          <Trash />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="tags" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tags">Canonical Tags</TabsTrigger>
          <TabsTrigger value="markers">Inference Markers</TabsTrigger>
        </TabsList>

        <TabsContent value="tags" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleCreateTag} disabled={categories.length === 0}>
              <Plus className="mr-2" />
              New Canonical Tag
            </Button>
          </div>

          {canonicalTags.length === 0 ? (
            <Alert>
              <AlertDescription>
                {categories.length === 0
                  ? 'No categories exist yet. Create your first delivery toolkit category above, then create the first canonical tag.'
                  : 'No canonical tags defined. Create your first tag to get started.'}
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
                              onClick={() => setTagPendingDelete(tag)}
                              aria-label={`Delete tag ${tag.tag}`}
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
                  ) : markerDrafts.length === 0 ? (
                    <Alert>
                      <AlertDescription>No markers loaded for the selected tag.</AlertDescription>
                    </Alert>
                  ) : (
                    <TagInferenceMarkerEditor drafts={markerDrafts} onChange={setMarkerDrafts} />
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => void handleSaveMarkers()}
                      disabled={markerSavePending || !selectedTag}
                    >
                      Save Markers
                    </Button>
                  </div>

                  {/* Marker dry-run test panel */}
                  <div className="mt-6 space-y-3 border-t pt-4">
                    <h4 className="text-sm font-semibold">Test markers against sample text</h4>
                    <Textarea
                      placeholder="Paste sample evidence text here…"
                      value={markerTestText}
                      onChange={(e) => setMarkerTestText(e.target.value)}
                      rows={3}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleTestMarkers()}
                      disabled={markerTestPending || !markerTestText.trim() || markerDrafts.length === 0}
                    >
                      {markerTestPending ? 'Testing…' : 'Run Test'}
                    </Button>
                    {markerTestResult && (
                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground">
                          Normalized: <span className="font-mono text-xs">{markerTestResult.normalizedText}</span>
                        </p>
                        <ul className="space-y-1">
                          {markerTestResult.matches.map((m, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <Badge variant={m.matched ? 'default' : 'outline'}>
                                {m.matched ? '✓ match' : '✗ no match'}
                              </Badge>
                              <span>Marker #{m.markerIndex + 1}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
        draft={null}
        onSave={handleSaveTag}
      />

      <AlertDialog open={confirmState !== null} onOpenChange={(open) => !open && setConfirmState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmState?.kind === 'import'
                ? 'Import taxonomy and rebuild runtime tags?'
                : 'Clear all taxonomy data?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState?.kind === 'import'
                ? 'This replaces the current canonical taxonomy, re-infers every evidence tag, rebuilds each record context tag set, and may leave candidate-profile signal tags orphaned until you update them manually.'
                : 'This removes all canonical tags, categories, and inference markers. Evidence tags and record context tags will be cleared. You can rebuild from scratch or import a taxonomy file afterward.'}
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

      <ConfirmDialog
        open={tagPendingDelete !== null}
        onOpenChange={(next) => !next && setTagPendingDelete(null)}
        title="Delete canonical tag?"
        description={
          tagPendingDelete ? (
            <span>
              This removes <span className="mono text-foreground">{tagPendingDelete.tag}</span> from the taxonomy.
              Any evidence currently tagged with it keeps the string but will no longer match canonical lookups.
            </span>
          ) : undefined
        }
        confirmLabel="Delete tag"
        destructive
        onConfirm={async () => {
          if (!tagPendingDelete) return
          try {
            await handleDeleteTag(tagPendingDelete)
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete tag')
            throw error
          }
        }}
      />
    </div>
  )
}
