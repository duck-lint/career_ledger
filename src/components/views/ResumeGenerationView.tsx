import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import AdoptTagDialog from '@/components/dialogs/AdoptTagDialog'
import TagDialog from '@/components/dialogs/TagDialog'
import { ProgressSteps, type ProgressStep } from '@/components/ProgressSteps'
import { RequirementAnalysisReviewPanel } from '@/components/resume/RequirementAnalysisReviewPanel'
import { ResumeAssemblyAuditPanel, ResumeGapReportPanel } from '@/components/resume/ResumeAuditPanels'
import { ResumeEvidenceSources } from '@/components/resume/ResumeEvidenceSources'
import {
  buildRequirementReviewOverride,
  buildReviewedRequirementAnalysis,
} from '@/lib/requirement-review'
import {
  operationsService,
  pipelineService,
  tagNormalizationService,
} from '@/lib/service'
import { runtimeSupports } from '@/lib/runtime'
import {
  getStoredArtifactOutputDir,
  setStoredArtifactOutputDir,
  getStoredJobPostingText,
  setStoredJobPostingText,
} from '@/lib/runtime-settings'
import {
  BUILD_POLICY_PRESETS,
  applyBuildPolicyPreset,
  describeBuildPolicyChanges,
  type BuildPolicyPresetId,
} from '@/lib/build-policy-presets'
import type {
  Anomaly,
  BuildPolicy,
  GenerationManifest,
  RequirementAnalysis,
  RequirementReviewOverride,
  ResumeArtifactFile,
  ResumePipelineResult,
  TagDialogCreateDraft,
} from '@/lib/types'

function formatSuggestedDisplayLabel(term: string): string {
  return term
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ')
}

type SummaryLine = {
  label: string
  value: string | number
}

async function fetchGenerationState(): Promise<{
  anomalies: Anomaly[]
  manifests: GenerationManifest[]
}> {
  const [manifests, anomalies] = await Promise.all([
    operationsService.getGenerationManifests(),
    operationsService.getAnomalies(),
  ])

  return { manifests, anomalies }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'n/a'
  }

  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return value
  }

  return new Date(timestamp).toLocaleString()
}

function parseDate(value: string | null | undefined): number {
  if (!value) {
    return 0
  }

  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function sortByNewest<T>(items: T[], getDate: (item: T) => string | null | undefined): T[] {
  return [...items].sort((left, right) => parseDate(getDate(right)) - parseDate(getDate(left)))
}

function formatContactLine(result: ResumePipelineResult): string {
  const { header } = result.assembly_result.artifact.resume

  return [header.location, header.email, header.phone, header.linkedin, header.github]
    .map((item) => item.trim())
    .filter(Boolean)
    .join(' | ')
}

function countManifestSelectionItems(value: string[] | null | undefined): number | null {
  return value ? value.length : null
}

function formatShortHash(value: string): string {
  if (value.length <= 20) {
    return value
  }

  return `${value.slice(0, 12)}...${value.slice(-8)}`
}

function formatBuildPolicySource(value: string | null | undefined): string {
  if (!value) {
    return 'Active DB policy'
  }

  if (value === 'db://resume_build_policy_settings') {
    return 'Active DB policy'
  }

  return value
}

function mapResumeGenerationError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Resume generation failed'

  if (message.includes('Active candidate profile not found')) {
    return 'Resume generation requires an active candidate profile. Go to Library > Candidate Profile and save one before generating.'
  }

  if (message.includes('contains invalid signal tags')) {
    return `${message} Update the candidate profile signal tags to match the current taxonomy, then try again.`
  }

  return message
}

function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function buildReusableRequirementReviewDefaults(
  analysis: RequirementAnalysis,
  persistedNoiseTerms: string[],
): { reviewedAnalysis: RequirementAnalysis; review: RequirementReviewOverride } {
  const draft = {
    reviewedClusterIds: [],
    excludedClusterIds: [],
    usefulTerms: [],
    noiseTerms: persistedNoiseTerms,
  }

  return {
    reviewedAnalysis: buildReviewedRequirementAnalysis(analysis, draft),
    review: buildRequirementReviewOverride(analysis, draft),
  }
}

function PolicyToggleField({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-background/60 p-3">
      <input
        id={id}
        type="checkbox"
        aria-label={label}
        title={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
      />
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function PolicyNumberField({
  id,
  label,
  description,
  value,
  onChange,
  step = '1',
  min,
  max,
  disabled,
}: {
  id: string
  label: string
  description: string
  value: number
  onChange: (value: number) => void
  step?: string
  min?: number
  max?: number
  disabled?: boolean
}) {
  return (
    <div className="space-y-2 rounded-lg border bg-background/60 p-3">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => {
          const nextValue = Number(event.target.value)
          onChange(Number.isFinite(nextValue) ? nextValue : value)
        }}
      />
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function SummaryCard({ title, lines }: { title: string; lines: SummaryLine[] }) {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {lines.map((line) => (
          <div key={line.label} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{line.label}</span>
            <span className="font-medium text-foreground">{line.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ArtifactFileSummary({ label, file }: { label: string; file: ResumeArtifactFile }) {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
      <div className="font-medium text-foreground">{label}</div>
      <div className="break-all text-muted-foreground">{file.path}</div>
      <div className="text-xs text-muted-foreground">SHA256: {formatShortHash(file.sha256)}</div>
    </div>
  )
}

export default function ResumeGenerationView() {
  const canUseResumePipeline = runtimeSupports('resumePipeline')
  const [jobPostingText, setJobPostingText] = useState('')
  const [artifactOutputDir, setArtifactOutputDir] = useState('')
  const [artifactBaseName, setArtifactBaseName] = useState('')
  const [writeBundleJson, setWriteBundleJson] = useState(false)
  const [renderDocx, setRenderDocx] = useState(true)
  const [persistManifest, setPersistManifest] = useState(true)
  const [manifestNotes, setManifestNotes] = useState('')
  const [analysisResult, setAnalysisResult] = useState<RequirementAnalysis | null>(null)
  const [reviewedRequirementAnalysis, setReviewedRequirementAnalysis] = useState<RequirementAnalysis | null>(null)
  const [requirementReview, setRequirementReview] = useState<RequirementReviewOverride | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [pipelineResult, setPipelineResult] = useState<ResumePipelineResult | null>(null)
  const [manifests, setManifests] = useState<GenerationManifest[]>([])
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [surfaceLoading, setSurfaceLoading] = useState(false)
  const [buildPolicyLoading, setBuildPolicyLoading] = useState(false)
  const [buildPolicySaving, setBuildPolicySaving] = useState(false)
  const [buildPolicyError, setBuildPolicyError] = useState<string | null>(null)
  const [buildPolicyDraft, setBuildPolicyDraft] = useState<BuildPolicy | null>(null)
  const [savedBuildPolicy, setSavedBuildPolicy] = useState<BuildPolicy | null>(null)
  const [storedRequirementReviewNoiseTerms, setStoredRequirementReviewNoiseTerms] = useState<string[]>([])
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [tagDialogDraft, setTagDialogDraft] = useState<TagDialogCreateDraft | null>(null)
  const [adoptDialogOpen, setAdoptDialogOpen] = useState(false)
  const [adoptDialogTerm, setAdoptDialogTerm] = useState<string | null>(null)
  const [adoptDialogClusterTags, setAdoptDialogClusterTags] = useState<string[]>([])
  const [showTaxonomyChangeNotice, setShowTaxonomyChangeNotice] = useState(false)
  const [resumeTab, setResumeTab] = useState('generate')
  const [detailTab, setDetailTab] = useState('preview')

  const deferredPipelineResult = useDeferredValue(pipelineResult)
  const previewPending = pipelineResult !== deferredPipelineResult

  useEffect(() => {
    if (!canUseResumePipeline) {
      return
    }

    let cancelled = false

    const loadResumeSurface = async () => {
      setSurfaceLoading(true)
      setBuildPolicyLoading(true)
      try {
        if (cancelled) {
          return
        }

        const [generationResult, buildPolicyResult] = await Promise.allSettled([
          fetchGenerationState(),
          pipelineService.getBuildPolicy(),
        ])

        if (cancelled) {
          return
        }

        if (generationResult.status === 'fulfilled') {
          startTransition(() => {
            setManifests(generationResult.value.manifests)
            setAnomalies(generationResult.value.anomalies)
          })
        } else {
          const message =
            generationResult.reason instanceof Error
              ? generationResult.reason.message
              : 'Failed to load generation state'
          toast.error(message)
        }

        if (buildPolicyResult.status === 'fulfilled') {
          setBuildPolicyDraft(buildPolicyResult.value)
          setSavedBuildPolicy(buildPolicyResult.value)
          setBuildPolicyError(null)
        } else {
          const message =
            buildPolicyResult.reason instanceof Error
              ? buildPolicyResult.reason.message
              : 'Failed to load the active build policy'
          setBuildPolicyError(message)
          toast.error(message)
        }
      } finally {
        if (!cancelled) {
          setSurfaceLoading(false)
          setBuildPolicyLoading(false)
        }
      }
    }

    void loadResumeSurface()

    return () => {
      cancelled = true
    }
  }, [canUseResumePipeline])

  // Restore persisted form fields from localStorage
  useEffect(() => {
    const storedDir = getStoredArtifactOutputDir()
    if (storedDir) setArtifactOutputDir(storedDir)
    const storedText = getStoredJobPostingText()
    if (storedText) setJobPostingText(storedText)
  }, [])

  const recentManifests = useMemo(
    () => sortByNewest(manifests, (item) => item.createdAt).slice(0, 5),
    [manifests]
  )

  const openAnomalies = useMemo(
    () => anomalies.filter((item) => !item.resolvedAt),
    [anomalies]
  )

  const recentAnomalies = useMemo(
    () => sortByNewest(anomalies, (item) => item.detectedAt).slice(0, 5),
    [anomalies]
  )

  const displayedAnalysis = reviewedRequirementAnalysis ?? analysisResult

  const reviewedAnalysisAvailable = Boolean(analysisResult && reviewedRequirementAnalysis && requirementReview)

  const analysisSummaryCards = useMemo(() => {
    if (!displayedAnalysis) {
      return []
    }

    return [
      {
        title: 'Posting',
        lines: [
          {
            label: 'Role family',
            value: displayedAnalysis.source.target_role_family || 'n/a',
          },
          { label: 'Clusters', value: displayedAnalysis.clusters.length },
          { label: 'Atoms', value: displayedAnalysis.atoms.length },
        ],
      },
      {
        title: 'Taxonomy Signals',
        lines: [
          {
            label: 'Matched keywords',
            value: displayedAnalysis.source.posting_keyword_bank.length,
          },
          {
            label: 'Suggested terms',
            value: displayedAnalysis.source.unrecognized_notable_terms.length,
          },
          {
            label: 'Method',
            value: displayedAnalysis.source.extraction_method,
          },
        ],
      },
    ]
  }, [displayedAnalysis])

  const suggestedTerms = useMemo(
    () => displayedAnalysis?.source.unrecognized_notable_terms ?? [],
    [displayedAnalysis]
  )

  const matchedPostingKeywords = useMemo(
    () => displayedAnalysis?.source.posting_keyword_bank ?? [],
    [displayedAnalysis]
  )

  const rawSuggestedTerms = useMemo(
    () => analysisResult?.source.unrecognized_notable_terms ?? [],
    [analysisResult]
  )

  const rawAnalysisClusters = useMemo(() => analysisResult?.clusters ?? [], [analysisResult])

  const rawAnalysisAtoms = useMemo(() => analysisResult?.atoms ?? [], [analysisResult])

  const clusterSuggestedTerms = useMemo(() => {
    const result = new Map<string, string[]>()
    if (rawAnalysisClusters.length === 0 || rawSuggestedTerms.length === 0) return result

    const unrecognizedSet = new Set(rawSuggestedTerms.map((t) => t.term))

    for (const cluster of rawAnalysisClusters) {
      const matchedSet = new Set(cluster.matched_tags)
      const clusterAtoms = rawAnalysisAtoms.filter((a) => a.cluster_id === cluster.cluster_id)
      const seen = new Set<string>()
      const terms: string[] = []

      for (const atom of clusterAtoms) {
        for (const entry of atom.normalized_terms) {
          // Negated terms are not positive signals — they must not appear
          // in the adopt-or-create suggestion UI.
          if (entry.is_negated) continue
          const term = entry.term
          if (unrecognizedSet.has(term) && !matchedSet.has(term) && !seen.has(term)) {
            seen.add(term)
            terms.push(term)
          }
        }
      }

      if (terms.length > 0) {
        result.set(cluster.cluster_id, terms)
      }
    }

    return result
  }, [rawAnalysisAtoms, rawAnalysisClusters, rawSuggestedTerms])

  // Opens the adopt-or-create triage dialog for a suggested term
  const handleSuggestedTermClick = (term: string, clusterMatchedTags?: string[]) => {
    const trimmedTerm = term.trim()
    if (!trimmedTerm) return
    setAdoptDialogTerm(trimmedTerm)
    setAdoptDialogClusterTags(clusterMatchedTags ?? [])
    setAdoptDialogOpen(true)
  }

  // Falls through from adopt dialog to create a new canonical tag
  const handleOpenTagDialog = (term: string) => {
    setTagDialogDraft({
      tagValue: tagNormalizationService.normalizeTag(term),
      description: '',
      displayLabel: formatSuggestedDisplayLabel(term),
      categoryName: null,
    })
    setTagDialogOpen(true)
  }

  const handleTagDialogOpenChange = (open: boolean) => {
    setTagDialogOpen(open)
    if (!open) {
      setTagDialogDraft(null)
    }
  }

  const handleSuggestedTermSaved = async () => {
    setTagDialogOpen(false)
    setTagDialogDraft(null)
    setShowTaxonomyChangeNotice(true)
    await handleAnalyzePosting()
  }

  const handleAdoptDialogAdopt = async () => {
    setAdoptDialogOpen(false)
    setShowTaxonomyChangeNotice(true)
    await handleAnalyzePosting()
  }

  const handleAdoptDialogCreate = () => {
    const term = adoptDialogTerm
    setAdoptDialogOpen(false)
    if (term) handleOpenTagDialog(term)
  }

  const syncRequirementReviewNoiseTerms = async (noiseTerms: string[]) => {
    if (sameStringArray(noiseTerms, storedRequirementReviewNoiseTerms)) {
      return
    }

    try {
      const savedNoiseTerms = await pipelineService.saveRequirementReviewNoiseTerms(noiseTerms)
      setStoredRequirementReviewNoiseTerms(savedNoiseTerms)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to save reusable requirement-review noise terms'
      toast.error(message)
    }
  }

  const pipelineSummaryCards = useMemo(() => {
    if (!pipelineResult) {
      return []
    }

    const exportRecordCount = pipelineResult.career_library_export.experience_records.length
    const exportEvidenceCount = pipelineResult.career_library_export.experience_records.reduce(
      (count, record) => count + record.evidence.length,
      0
    )
    const preflightReport = pipelineResult.preflight_result.preflight_report
    const gapReport = pipelineResult.assembly_result.artifact.gap_report

    return [
      {
        title: 'Export',
        lines: [
          { label: 'Records', value: exportRecordCount },
          { label: 'Evidence', value: exportEvidenceCount },
        ],
      },
      {
        title: 'Requirements',
        lines: [
          { label: 'Clusters', value: pipelineResult.requirement_analysis.clusters.length },
          { label: 'Atoms', value: pipelineResult.requirement_analysis.atoms.length },
          {
            label: 'Role family',
            value: pipelineResult.requirement_analysis.source.target_role_family || 'n/a',
          },
        ],
      },
      {
        title: 'Preflight',
        lines: [
          { label: 'Kept records', value: preflightReport.kept_counts.records },
          { label: 'Kept evidence', value: preflightReport.kept_counts.evidence },
          { label: 'Dropped records', value: preflightReport.dropped_counts.records },
          { label: 'Dropped evidence', value: preflightReport.dropped_counts.evidence },
        ],
      },
      {
        title: 'Selection',
        lines: [
          { label: 'Records', value: pipelineResult.assembly_result.selected_record_ids.length },
          { label: 'Evidence', value: pipelineResult.assembly_result.selected_evidence_ids.length },
        ],
      },
      {
        title: 'Gap report',
        lines: [
          { label: 'Supported', value: gapReport.supported_requirements.length },
          {
            label: 'Partial',
            value: gapReport.partially_supported_requirements.length,
          },
          { label: 'Unsupported', value: gapReport.unsupported_requirements.length },
        ],
      },
    ]
  }, [pipelineResult])

  const pipelineSteps = useMemo<ProgressStep[]>(() => {
    const hasResult = pipelineResult !== null
    const recordCount = pipelineResult?.career_library_export.experience_records.length ?? 0
    const evidenceCount = pipelineResult?.career_library_export.experience_records.reduce(
      (count, record) => count + record.evidence.length,
      0,
    ) ?? 0
    const atomCount = pipelineResult?.requirement_analysis.atoms.length ?? 0
    const clusterCount = pipelineResult?.requirement_analysis.clusters.length ?? 0
    const keptRecords = pipelineResult?.preflight_result.preflight_report.kept_counts.records ?? 0
    const keptEvidence = pipelineResult?.preflight_result.preflight_report.kept_counts.evidence ?? 0
    const selectedRecords = pipelineResult?.assembly_result.selected_record_ids.length ?? 0
    const selectedEvidence = pipelineResult?.assembly_result.selected_evidence_ids.length ?? 0
    const hasArtifacts = pipelineResult?.generated_artifacts !== undefined
      && pipelineResult?.generated_artifacts !== null

    const pendingOrDone = (base: string): ProgressStep['status'] => {
      if (hasResult) return 'done'
      if (isSubmitting) return base === 'first' ? 'active' : 'pending'
      return 'pending'
    }

    return [
      {
        id: 'export',
        label: 'Export library',
        status: pendingOrDone('first'),
        detail: hasResult ? `${recordCount} records · ${evidenceCount} evidence` : undefined,
      },
      {
        id: 'analyze',
        label: 'Analyze posting',
        status: pendingOrDone('next'),
        detail: hasResult ? `${clusterCount} clusters · ${atomCount} atoms` : undefined,
      },
      {
        id: 'preflight',
        label: 'Preflight filter',
        status: pendingOrDone('next'),
        detail: hasResult ? `${keptRecords} / ${recordCount} records kept · ${keptEvidence} evidence` : undefined,
      },
      {
        id: 'assemble',
        label: 'Assemble resume',
        status: pendingOrDone('next'),
        detail: hasResult ? `${selectedRecords} records · ${selectedEvidence} evidence` : undefined,
      },
      {
        id: 'artifacts',
        label: 'Write artifacts',
        status: hasResult ? (hasArtifacts ? 'done' : 'pending') : isSubmitting ? 'pending' : 'pending',
        detail: hasResult
          ? hasArtifacts
            ? (() => {
                const ga = pipelineResult?.generated_artifacts
                if (!ga) return undefined
                const files = [ga.assembled_json, ga.bundle_json, ga.rendered_docx].filter(Boolean)
                return `${files.length} file(s) written`
              })()
            : 'Preview only — no output directory'
          : undefined,
      },
    ]
  }, [pipelineResult, isSubmitting])

  const buildPolicyChanges = useMemo(
    () => savedBuildPolicy && buildPolicyDraft
      ? describeBuildPolicyChanges(savedBuildPolicy, buildPolicyDraft)
      : [],
    [buildPolicyDraft, savedBuildPolicy],
  )

  const updateBuildPolicyDraft = (updater: (current: BuildPolicy) => BuildPolicy) => {
    setBuildPolicyDraft((current) => (current ? updater(current) : current))
  }

  const handleApplyBuildPolicyPreset = (presetId: BuildPolicyPresetId) => {
    updateBuildPolicyDraft((current) => applyBuildPolicyPreset(current, presetId))
  }

  const toggleMultiEvidenceSection = (section: 'highlights' | 'profile', checked: boolean) => {
    updateBuildPolicyDraft((current) => {
      const currentSections = new Set(current.assembler_strategy.allow_multi_evidence_sections)
      if (checked) {
        currentSections.add(section)
      } else {
        currentSections.delete(section)
      }

      return {
        ...current,
        assembler_strategy: {
          ...current.assembler_strategy,
          allow_multi_evidence_sections: Array.from(currentSections),
        },
      }
    })
  }

  const handlePostingFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    try {
      const fileText = await file.text()
      setJobPostingText(fileText)
      setAnalysisResult(null)
      setReviewedRequirementAnalysis(null)
      setRequirementReview(null)
      setAnalysisError(null)
      setSubmissionError(null)
      toast.success(`Loaded job posting from ${file.name}`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load the selected posting file'
      toast.error(message)
    }
  }

  const handleAnalyzePosting = async () => {
    if (!canUseResumePipeline) {
      toast.error('Posting analysis is available only in the Tauri desktop runtime.')
      return
    }

    const normalizedPostingText = jobPostingText.trim()
    if (!normalizedPostingText) {
      const message = 'Paste or load a job posting before analyzing it.'
      setAnalysisError(message)
      toast.error(message)
      return
    }

    setIsAnalyzing(true)
    setAnalysisError(null)

    try {
      const [result, persistedNoiseTerms] = await Promise.all([
        pipelineService.buildRequirementAnalysis(normalizedPostingText),
        pipelineService.getRequirementReviewNoiseTerms(),
      ])
      const { reviewedAnalysis, review } = buildReusableRequirementReviewDefaults(
        result,
        persistedNoiseTerms,
      )

      setAnalysisResult(result)
      setReviewedRequirementAnalysis(reviewedAnalysis)
      setRequirementReview(review)
      setStoredRequirementReviewNoiseTerms(persistedNoiseTerms)
      toast.success('Posting analysis updated')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Posting analysis failed'
      setAnalysisError(message)
      toast.error(message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleBrowseArtifactOutputDir = async () => {
    if (!canUseResumePipeline) {
      return
    }

    try {
      const selected = await open({
        directory: true,
        multiple: false,
      })

      if (typeof selected === 'string') {
        setArtifactOutputDir(selected)
        setStoredArtifactOutputDir(selected)
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to browse for an artifact output directory'
      toast.error(message)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canUseResumePipeline) {
      toast.error('Resume generation is available only in the Tauri desktop runtime.')
      return
    }

    const normalizedPostingText = jobPostingText.trim()
    const normalizedArtifactOutputDir = artifactOutputDir.trim()

    if (!normalizedPostingText) {
      const message = 'Paste or load a job posting before generating a resume.'
      setSubmissionError(message)
      toast.error(message)
      return
    }

    setIsSubmitting(true)
    setSubmissionError(null)

    try {
      // Persist posting text for next session
      if (normalizedPostingText) setStoredJobPostingText(normalizedPostingText)

      const normalizedBaseName = artifactBaseName.trim()
      let pipelineAnalysis = reviewedAnalysisAvailable ? reviewedRequirementAnalysis : null
      let pipelineReview = reviewedAnalysisAvailable ? requirementReview : null

      if (!pipelineAnalysis || !pipelineReview) {
        const [baseAnalysis, persistedNoiseTerms] = await Promise.all([
          pipelineService.buildRequirementAnalysis(normalizedPostingText),
          pipelineService.getRequirementReviewNoiseTerms(),
        ])
        const defaults = buildReusableRequirementReviewDefaults(baseAnalysis, persistedNoiseTerms)

        pipelineAnalysis = defaults.reviewedAnalysis
        pipelineReview = defaults.review
        setAnalysisResult(baseAnalysis)
        setReviewedRequirementAnalysis(defaults.reviewedAnalysis)
        setRequirementReview(defaults.review)
        setStoredRequirementReviewNoiseTerms(persistedNoiseTerms)
      }

      if (!pipelineAnalysis || !pipelineReview) {
        throw new Error('Failed to prepare reusable requirement-review defaults.')
      }

      const result = await pipelineService.runResumePipeline({
        job_posting_text: normalizedPostingText,
        reviewed_requirement_analysis: pipelineAnalysis,
        requirement_review: pipelineReview,
        artifact_output_dir: normalizedArtifactOutputDir || null,
        artifact_base_name: normalizedBaseName || null,
        write_bundle_json: normalizedArtifactOutputDir ? writeBundleJson : false,
        render_docx: normalizedArtifactOutputDir ? renderDocx : false,
        persist_manifest: persistManifest,
        manifest_notes: manifestNotes.trim() || null,
      })
      const nextState = await fetchGenerationState()

      startTransition(() => {
        setPipelineResult(result)
        setManifests(nextState.manifests)
        setAnomalies(nextState.anomalies)
        setDetailTab('preview')
      })

      toast.success('Resume pipeline completed')
    } catch (error) {
      const message = mapResumeGenerationError(error)
      setSubmissionError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveBuildPolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!buildPolicyDraft) {
      return
    }

    setBuildPolicySaving(true)
    setBuildPolicyError(null)

    try {
      const saved = await pipelineService.saveBuildPolicy(buildPolicyDraft)
      setBuildPolicyDraft(saved)
      setSavedBuildPolicy(saved)
      toast.success('Build policy saved')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save build policy'
      setBuildPolicyError(message)
      toast.error(message)
    } finally {
      setBuildPolicySaving(false)
    }
  }

  if (!canUseResumePipeline) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Resume</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Run the desktop resume pipeline, inspect its outputs, and review persisted generation state.
          </p>
        </div>

        <Alert>
          <AlertDescription>
            Resume generation is available only in the Tauri desktop runtime.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const currentManifest = pipelineResult?.generation_manifest ?? null
  const generatedArtifacts = pipelineResult?.generated_artifacts ?? null
  const displayResult = deferredPipelineResult
  const artifactOutputConfigured = artifactOutputDir.trim().length > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Resume</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Run the desktop resume pipeline, inspect the assembled resume, and manage the active per-database build policy without leaving the app.
        </p>
      </div>

      <Tabs value={resumeTab} onValueChange={setResumeTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="build-policy">Build Policy</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="mt-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generate Resume</CardTitle>
              <CardDescription>
                Paste a posting, use the active DB-backed build policy, and run the desktop pipeline. Add an output directory when you want files written to disk.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="resume-job-posting">Job posting text</Label>
                  <Textarea
                    id="resume-job-posting"
                    value={jobPostingText}
                    onChange={(event) => {
                      setJobPostingText(event.target.value)
                      setAnalysisResult(null)
                      setReviewedRequirementAnalysis(null)
                      setRequirementReview(null)
                      setAnalysisError(null)
                      setSubmissionError(null)
                    }}
                    placeholder="Paste the target posting here..."
                    rows={14}
                    className="min-h-64"
                    aria-invalid={submissionError ? true : undefined}
                    disabled={isSubmitting}
                  />
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <Input
                      id="resume-job-posting-file"
                      type="file"
                      accept=".txt,.md,.json,.yaml,.yml"
                      onChange={(event) => void handlePostingFileUpload(event)}
                      disabled={isSubmitting}
                      className="max-w-xl"
                    />
                    <p className="text-xs text-muted-foreground">
                      Load a local posting file into the textarea, then edit it before you run the pipeline if needed.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <input
                      id="resume-persist-manifest"
                      type="checkbox"
                      aria-label="Persist generation manifest"
                      title="Persist generation manifest"
                      checked={persistManifest}
                      onChange={(event) => setPersistManifest(event.target.checked)}
                      disabled={isSubmitting}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="resume-persist-manifest">Persist generation manifest</Label>
                      <p className="text-sm text-muted-foreground">
                        Keep manifest metadata for this run and refresh the recent manifest surface after success.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
                  <div className="space-y-2">
                    <Label htmlFor="resume-artifact-output-dir">Artifact output directory</Label>
                    <div className="flex flex-col gap-3 md:flex-row">
                      <Input
                        id="resume-artifact-output-dir"
                        value={artifactOutputDir}
                        onChange={(event) => {
                          setArtifactOutputDir(event.target.value)
                          if (event.target.value.trim()) setStoredArtifactOutputDir(event.target.value.trim())
                        }}
                        placeholder="Optional directory for assembled JSON and optional extra artifacts"
                        disabled={isSubmitting}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleBrowseArtifactOutputDir()}
                        disabled={isSubmitting}
                      >
                        <FolderOpen className="size-4" />
                        Browse
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Leave this blank for preview-only runs. When a directory is set, the pipeline always writes the assembled JSON artifact there.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="resume-artifact-base-name">Artifact file prefix</Label>
                    <Input
                      id="resume-artifact-base-name"
                      value={artifactBaseName}
                      onChange={(event) => setArtifactBaseName(event.target.value)}
                      placeholder="e.g. Acme_SeniorDev (optional — defaults to auto-generated name)"
                      disabled={isSubmitting}
                      maxLength={100}
                    />
                    <p className="text-xs text-muted-foreground">
                      Human-readable prefix for output filenames. A unique suffix is always appended.
                    </p>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="flex items-start gap-3 rounded-lg border bg-background/60 p-3">
                      <input
                        id="resume-write-bundle-json"
                        type="checkbox"
                        aria-label="Write bundle JSON artifact"
                        title="Write bundle JSON artifact"
                        checked={writeBundleJson}
                        onChange={(event) => setWriteBundleJson(event.target.checked)}
                        disabled={isSubmitting}
                        className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                      />
                      <div className="space-y-1">
                        <Label htmlFor="resume-write-bundle-json">Write bundle JSON</Label>
                        <p className="text-sm text-muted-foreground">
                          Persist the prepared bundle alongside the assembled artifact for inspection and diffing.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-lg border bg-background/60 p-3">
                      <input
                        id="resume-render-docx"
                        type="checkbox"
                        aria-label="Render DOCX artifact"
                        title="Render DOCX artifact"
                        checked={renderDocx}
                        onChange={(event) => setRenderDocx(event.target.checked)}
                        disabled={isSubmitting}
                        className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                      />
                      <div className="space-y-1">
                        <Label htmlFor="resume-render-docx">Render DOCX</Label>
                        <p className="text-sm text-muted-foreground">
                          Generate a DOCX artifact from the assembled resume when an output directory is configured.
                        </p>
                      </div>
                    </div>
                  </div>

                  {!artifactOutputConfigured && (
                    <Alert>
                      <AlertDescription>
                        This run will stay preview-only unless you choose an artifact output directory.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resume-manifest-notes">Manifest notes</Label>
                  <Textarea
                    id="resume-manifest-notes"
                    value={manifestNotes}
                    onChange={(event) => setManifestNotes(event.target.value)}
                    placeholder="Optional notes stored with the generation manifest"
                    rows={3}
                    disabled={isSubmitting}
                  />
                </div>

                <Alert>
                  <AlertDescription>
                    Analyze Posting is the taxonomy-first review step. It works without a candidate profile and helps you seed tags before adding evidence. Generate Resume uses reviewed analysis corrections for this run when they are available, and still requires Library &gt; Candidate Profile plus existing library data.
                  </AlertDescription>
                </Alert>

                {analysisError && (
                  <Alert variant="destructive">
                    <AlertDescription>{analysisError}</AlertDescription>
                  </Alert>
                )}

                {submissionError && (
                  <Alert variant="destructive">
                    <AlertDescription>{submissionError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Generate Resume runs the full Tauri pipeline with the active DB-backed build policy, reviewed analysis when available, then reloads manifests and anomalies.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleAnalyzePosting()}
                      disabled={isSubmitting || isAnalyzing}
                    >
                      {isAnalyzing ? 'Analyzing...' : 'Analyze Posting'}
                    </Button>
                    <Button type="submit" disabled={isSubmitting || isAnalyzing}>
                      {isSubmitting ? 'Generating...' : 'Generate Resume'}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Posting Analysis</CardTitle>
              <CardDescription>
                Use this read-only pass to inspect requirement structure and collect candidate taxonomy terms before you start tagging evidence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!analysisResult ? (
                <Alert>
                  <AlertDescription>
                    Run Analyze Posting to see role family, matched taxonomy keywords, and candidate terms for taxonomy seeding.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {showTaxonomyChangeNotice && (
                    <Alert>
                      <AlertDescription>
                        Resume just changed the taxonomy. Existing library evidence tags and record context tags stay as-is until you run Taxonomy &gt; Re-infer Library Tags.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                    {analysisSummaryCards.map((card) => (
                      <SummaryCard key={card.title} title={card.title} lines={card.lines} />
                    ))}
                  </div>

                  <Card className="gap-0">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Suggested Taxonomy Terms</CardTitle>
                      <CardDescription>
                        Repeated posting terms that are not already recognized by the current taxonomy. Click one to open a prefilled tag draft.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {suggestedTerms.length === 0 ? (
                        <Alert>
                          <AlertDescription>
                            No repeated unrecognized terms were promoted into the seed list for this posting.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {suggestedTerms.map((term) => (
                            <Button
                              key={term.term}
                              type="button"
                              variant="secondary"
                              className="h-auto gap-2 px-3 py-2"
                              onClick={() => handleSuggestedTermClick(term.term)}
                              disabled={isAnalyzing || isSubmitting}
                            >
                              <span className="mono">{term.term}</span>
                              <span className="text-[10px] text-muted-foreground">
                                x{term.count}
                              </span>
                            </Button>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="gap-0">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Matched Posting Keywords</CardTitle>
                      <CardDescription>
                        Terms already recognized by the current taxonomy from this posting.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {matchedPostingKeywords.length === 0 ? (
                        <Alert>
                          <AlertDescription>
                            No taxonomy-backed posting keywords matched. This is expected when the taxonomy is still empty or early.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {matchedPostingKeywords.map((keyword) => (
                            <Badge key={keyword} variant="outline" className="mono">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <RequirementAnalysisReviewPanel
                    analysis={analysisResult}
                    suggestedTermsByCluster={clusterSuggestedTerms}
                    onSuggestedTermClick={handleSuggestedTermClick}
                    persistedNoiseTerms={storedRequirementReviewNoiseTerms}
                    onReviewChange={(reviewedAnalysis, review) => {
                      setReviewedRequirementAnalysis(reviewedAnalysis)
                      setRequirementReview(review)
                      void syncRequirementReviewNoiseTerms(review.noise_terms)
                    }}
                    disabled={isAnalyzing || isSubmitting}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <Tabs value={detailTab} onValueChange={setDetailTab}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-0 space-y-6">
          {previewPending && pipelineResult && (
            <Alert>
              <AlertDescription>Rendering the latest pipeline result...</AlertDescription>
            </Alert>
          )}

          {!displayResult ? (
            <Alert>
              <AlertDescription>
                Run the pipeline to render an assembled resume preview.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <CardTitle>
                        {displayResult.assembly_result.artifact.resume.header.display_name}
                      </CardTitle>
                      <CardDescription>
                        {formatContactLine(displayResult) || 'No contact fields available'}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {displayResult.assembly_result.artifact.resume.target_role_family}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>

              <ResumeGapReportPanel
                gapReport={displayResult.assembly_result.artifact.gap_report}
              />

              <ResumeAssemblyAuditPanel
                constraintFlags={displayResult.assembly_result.constraint_flags}
                notes={displayResult.assembly_result.notes}
              />

              {displayResult.assembly_result.artifact.resume.profile && (
                <Card>
                  <CardHeader>
                    <CardTitle>Profile</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm leading-6">
                    <p>{displayResult.assembly_result.artifact.resume.profile.text}</p>
                    <ResumeEvidenceSources
                      result={displayResult}
                      evidenceIds={displayResult.assembly_result.artifact.resume.profile.evidence_ids}
                    />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Highlights</CardTitle>
                </CardHeader>
                <CardContent>
                  {displayResult.assembly_result.artifact.resume.highlights.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No highlights assembled.</p>
                  ) : (
                    <ul className="space-y-2 text-sm leading-6">
                      {displayResult.assembly_result.artifact.resume.highlights.map(
                        (highlight, index) => (
                          <li key={`${highlight.text}-${index}`} className="space-y-2">
                            <div className="flex gap-3">
                              <span className="text-muted-foreground">-</span>
                              <span>{highlight.text}</span>
                            </div>
                            <ResumeEvidenceSources
                              result={displayResult}
                              evidenceIds={highlight.evidence_ids}
                            />
                          </li>
                        )
                      )}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Professional Experience</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {displayResult.assembly_result.artifact.resume.professional_experience.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No professional experience entries selected.
                    </p>
                  ) : (
                    displayResult.assembly_result.artifact.resume.professional_experience.map(
                      (entry) => (
                        <div
                          key={entry.record_id}
                          className="space-y-3 rounded-lg border bg-muted/20 p-4"
                        >
                          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="font-medium text-foreground">
                                {entry.title} | {entry.organization}
                              </div>
                              {entry.location && (
                                <div className="text-sm text-muted-foreground">
                                  {entry.location}
                                </div>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">{entry.date_range}</div>
                          </div>
                          <ul className="space-y-2 text-sm leading-6">
                            {entry.bullets.map((bullet, index) => (
                              <li key={`${entry.record_id}-${index}`} className="space-y-2">
                                <div className="flex gap-3">
                                  <span className="text-muted-foreground">-</span>
                                  <span>{bullet.text}</span>
                                </div>
                                <ResumeEvidenceSources
                                  result={displayResult}
                                  evidenceIds={bullet.evidence_ids}
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    )
                  )}
                </CardContent>
              </Card>

              {displayResult.assembly_result.artifact.resume.projects.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Projects</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {displayResult.assembly_result.artifact.resume.projects.map((project) => (
                      <div
                        key={project.record_id}
                        className="space-y-3 rounded-lg border bg-muted/20 p-4"
                      >
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                          <div className="font-medium text-foreground">
                            {project.title} | {project.organization}
                          </div>
                          <div className="text-sm text-muted-foreground">{project.date_range}</div>
                        </div>
                        <ul className="space-y-2 text-sm leading-6">
                          {project.bullets.map((bullet, index) => (
                            <li key={`${project.record_id}-${index}`} className="space-y-2">
                              <div className="flex gap-3">
                                <span className="text-muted-foreground">-</span>
                                <span>{bullet.text}</span>
                              </div>
                              <ResumeEvidenceSources
                                result={displayResult}
                                evidenceIds={bullet.evidence_ids}
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Education & Certifications</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 xl:grid-cols-2">
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Education</div>
                    {displayResult.assembly_result.artifact.resume.education.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No education entries available.</p>
                    ) : (
                      <ul className="space-y-2 text-sm leading-6">
                        {displayResult.assembly_result.artifact.resume.education.map(
                          (entry, index) => (
                            <li key={`${entry.source_id}-${index}`} className="flex gap-3">
                              <span className="text-muted-foreground">-</span>
                              <span>{entry.text}</span>
                            </li>
                          )
                        )}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-medium">Certifications</div>
                    {displayResult.assembly_result.artifact.resume.certifications.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No certifications available.</p>
                    ) : (
                      <ul className="space-y-2 text-sm leading-6">
                        {displayResult.assembly_result.artifact.resume.certifications.map(
                          (entry, index) => (
                            <li key={`${entry.source_id}-${index}`} className="flex gap-3">
                              <span className="text-muted-foreground">-</span>
                              <span>{entry.text}</span>
                            </li>
                          )
                        )}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>

              {displayResult.assembly_result.artifact.resume.toolkit && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {displayResult.assembly_result.artifact.resume.toolkit.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {displayResult.assembly_result.artifact.resume.toolkit.groups.map((group) => (
                      <div key={group.group_name} className="space-y-2">
                        <div className="text-sm font-medium">{group.group_name}</div>
                        <div className="flex flex-wrap gap-2">
                          {group.items.map((item) => (
                            <Badge key={`${group.group_name}-${item}`} variant="outline">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="pipeline" className="mt-0 space-y-6">
          <ProgressSteps steps={pipelineSteps} />

          {!pipelineResult ? (
            <Alert>
              <AlertDescription>
                Run the pipeline to populate the summary panels. Recent manifests and anomalies are shown below either way.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {pipelineSummaryCards.map((card) => (
                <SummaryCard key={card.title} title={card.title} lines={card.lines} />
              ))}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Generated Artifacts</CardTitle>
              <CardDescription>
                Files written by the latest pipeline run when an artifact output directory is configured.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!pipelineResult ? (
                <Alert>
                  <AlertDescription>
                    Run the pipeline to see generated artifact paths and hashes.
                  </AlertDescription>
                </Alert>
              ) : !generatedArtifacts ? (
                <Alert>
                  <AlertDescription>
                    No artifacts were written for this run. Choose an artifact output directory to emit assembled JSON and optional bundle or DOCX files.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground">
                    Output directory: <span className="break-all">{generatedArtifacts.output_dir}</span>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-3">
                    <ArtifactFileSummary
                      label="Assembled JSON"
                      file={generatedArtifacts.assembled_json}
                    />
                    {generatedArtifacts.bundle_json && (
                      <ArtifactFileSummary
                        label="Bundle JSON"
                        file={generatedArtifacts.bundle_json}
                      />
                    )}
                    {generatedArtifacts.rendered_docx && (
                      <ArtifactFileSummary
                        label="Rendered DOCX"
                        file={generatedArtifacts.rendered_docx}
                      />
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {surfaceLoading && (
            <Alert>
              <AlertDescription>Refreshing generation manifests and anomalies...</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Current Run Manifest</CardTitle>
                <CardDescription>
                  Persisted manifest metadata returned by the latest pipeline run.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {!pipelineResult ? (
                  <Alert>
                    <AlertDescription>
                      Run the pipeline to populate the current manifest summary.
                    </AlertDescription>
                  </Alert>
                ) : !currentManifest ? (
                  <Alert>
                    <AlertDescription>
                      This run did not return a persisted generation manifest. That is expected when manifest persistence is disabled.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{currentManifest.artifactKind}</Badge>
                      {currentManifest.targetRoleFamily && (
                        <Badge variant="outline">{currentManifest.targetRoleFamily}</Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-muted-foreground">Created:</span>{' '}
                        {formatDateTime(currentManifest.createdAt)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Job posting:</span>{' '}
                        {currentManifest.jobPostingPath ?? 'Pasted text input'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Build policy:</span>{' '}
                        {formatBuildPolicySource(currentManifest.buildPolicyPath)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Selected records:</span>{' '}
                        {countManifestSelectionItems(currentManifest.selectedRecordIds) ?? 'n/a'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Selected evidence:</span>{' '}
                        {countManifestSelectionItems(currentManifest.selectedEvidenceIds) ?? 'n/a'}
                      </div>
                    </div>
                    {currentManifest.notes && (
                      <div className="rounded-lg border bg-muted/20 p-3">{currentManifest.notes}</div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Manifests</CardTitle>
                <CardDescription>
                  Latest persisted generation manifests from the shared operations surface.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentManifests.length === 0 ? (
                  <Alert>
                    <AlertDescription>No generation manifests recorded.</AlertDescription>
                  </Alert>
                ) : (
                  recentManifests.map((manifest) => (
                    <div
                      key={manifest.id}
                      className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm"
                    >
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">
                            {manifest.targetRoleFamily ?? 'Unknown target role family'}
                          </div>
                          <div className="text-muted-foreground">
                            {formatDateTime(manifest.createdAt)}
                          </div>
                        </div>
                        <Badge variant="secondary">{manifest.artifactKind}</Badge>
                      </div>
                      <div className="break-all text-muted-foreground">
                        Policy: {formatBuildPolicySource(manifest.buildPolicyPath)}
                      </div>
                      <div className="flex flex-wrap gap-3 text-muted-foreground">
                        <span>
                          Records: {countManifestSelectionItems(manifest.selectedRecordIds) ?? 'n/a'}
                        </span>
                        <span>
                          Evidence: {countManifestSelectionItems(manifest.selectedEvidenceIds) ?? 'n/a'}
                        </span>
                      </div>
                      {manifest.notes && <div>{manifest.notes}</div>}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Anomalies</CardTitle>
              <CardDescription>
                Open anomaly count plus a short recent list from the current runtime state.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Badge variant={openAnomalies.length > 0 ? 'destructive' : 'secondary'}>
                  {openAnomalies.length} open
                </Badge>
                <span className="text-muted-foreground">
                  {anomalies.length} total anomalies loaded
                </span>
              </div>

              {recentAnomalies.length === 0 ? (
                <Alert>
                  <AlertDescription>No anomalies recorded.</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {recentAnomalies.map((anomaly) => (
                    <div
                      key={anomaly.id}
                      className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm"
                    >
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={anomaly.resolvedAt ? 'secondary' : 'destructive'}>
                            {anomaly.resolvedAt ? 'Resolved' : 'Open'}
                          </Badge>
                          <Badge variant="outline">{anomaly.severity}</Badge>
                          <span className="font-medium text-foreground">
                            {anomaly.anomalyCode}
                          </span>
                        </div>
                        <span className="text-muted-foreground">
                          {formatDateTime(anomaly.detectedAt)}
                        </span>
                      </div>
                      <div>{anomaly.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

          </Tabs>
        </TabsContent>

        <TabsContent value="build-policy" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Active Build Policy</CardTitle>
              <CardDescription>
                Edit the per-database resume build policy that the pipeline uses immediately on the next run.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {buildPolicyLoading ? (
                <Alert>
                  <AlertDescription>Loading the active build policy...</AlertDescription>
                </Alert>
              ) : !buildPolicyDraft ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    {buildPolicyError ?? 'Build policy is unavailable for this database.'}
                  </AlertDescription>
                </Alert>
              ) : (
                <form className="space-y-6" onSubmit={handleSaveBuildPolicy}>
                  <div className="space-y-4 rounded-lg border bg-muted/10 p-4">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">Policy Presets</h3>
                      <p className="text-sm text-muted-foreground">
                        Presets stage changes in the draft below. Review the field changes, then save to make them active for this database.
                      </p>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-4">
                      {BUILD_POLICY_PRESETS.map((preset) => (
                        <div key={preset.id} className="space-y-3 rounded-md border bg-background/70 p-3">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-foreground">{preset.label}</div>
                            <p className="text-xs leading-5 text-muted-foreground">{preset.description}</p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleApplyBuildPolicyPreset(preset.id)}
                            disabled={buildPolicySaving}
                          >
                            Apply
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border bg-background/60 p-4">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-foreground">Staged Policy Changes</h3>
                        <p className="text-sm text-muted-foreground">
                          Difference between the saved policy and the current draft.
                        </p>
                      </div>
                      <Badge variant={buildPolicyChanges.length > 0 ? 'secondary' : 'outline'}>
                        {buildPolicyChanges.length} unsaved
                      </Badge>
                    </div>
                    {buildPolicyChanges.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No unsaved build policy changes.</p>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {buildPolicyChanges.map((change) => (
                          <div key={change.label} className="rounded-md border bg-muted/20 p-3 text-sm">
                            <div className="font-medium text-foreground">{change.label}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {change.before} -&gt; {change.after}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">Advanced Controls</h3>
                      <p className="text-sm text-muted-foreground">
                        Direct numeric and boolean controls remain available for deliberate tuning.
                      </p>
                    </div>

                  <div className="grid gap-4 xl:grid-cols-3">
                    <PolicyToggleField
                      id="policy-include-projects"
                      label="Include projects"
                      description="Allow project records into resume assembly when they survive preflight."
                      checked={buildPolicyDraft.include_projects}
                      onChange={(checked) =>
                        updateBuildPolicyDraft((current) => ({
                          ...current,
                          include_projects: checked,
                        }))
                      }
                      disabled={buildPolicySaving}
                    />
                    <PolicyNumberField
                      id="policy-max-bullets-per-role"
                      label="Max bullets per role"
                      description="Cap assembled experience bullets per employment record."
                      value={buildPolicyDraft.max_bullets_per_role}
                      min={0}
                      onChange={(value) =>
                        updateBuildPolicyDraft((current) => ({
                          ...current,
                          max_bullets_per_role: Math.max(0, Math.trunc(value)),
                        }))
                      }
                      disabled={buildPolicySaving}
                    />
                    <PolicyNumberField
                      id="policy-max-project-bullets"
                      label="Max project bullets"
                      description="Cap assembled bullets per project record."
                      value={buildPolicyDraft.max_project_bullets}
                      min={0}
                      onChange={(value) =>
                        updateBuildPolicyDraft((current) => ({
                          ...current,
                          max_project_bullets: Math.max(0, Math.trunc(value)),
                        }))
                      }
                      disabled={buildPolicySaving}
                    />
                    <PolicyNumberField
                      id="policy-max-projects"
                      label="Max projects"
                      description="Limit how many project records can survive into the final resume."
                      value={buildPolicyDraft.max_projects}
                      min={0}
                      onChange={(value) =>
                        updateBuildPolicyDraft((current) => ({
                          ...current,
                          max_projects: Math.max(0, Math.trunc(value)),
                        }))
                      }
                      disabled={buildPolicySaving}
                    />
                    <PolicyNumberField
                      id="policy-threshold"
                      label="Threshold"
                      description="Preflight relevance threshold before fallback behavior applies."
                      value={buildPolicyDraft.preflight?.threshold ?? 0}
                      min={0}
                      max={1}
                      step="0.01"
                      onChange={(value) =>
                        updateBuildPolicyDraft((current) => ({
                          ...current,
                          preflight: {
                            threshold: value,
                            fallback_min_records:
                              current.preflight?.fallback_min_records ?? 3,
                          },
                        }))
                      }
                      disabled={buildPolicySaving}
                    />
                    <PolicyNumberField
                      id="policy-fallback-min-records"
                      label="Fallback minimum records"
                      description="Minimum kept records when threshold filtering would otherwise be too aggressive."
                      value={buildPolicyDraft.preflight?.fallback_min_records ?? 3}
                      min={0}
                      onChange={(value) =>
                        updateBuildPolicyDraft((current) => ({
                          ...current,
                          preflight: {
                            threshold: current.preflight?.threshold ?? 0,
                            fallback_min_records: Math.max(0, Math.trunc(value)),
                          },
                        }))
                      }
                      disabled={buildPolicySaving}
                    />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-3">
                    <PolicyNumberField
                      id="policy-max-highlights"
                      label="Max highlights"
                      description="Maximum number of highlight bullets in the final document."
                      value={buildPolicyDraft.assembler_strategy.max_highlights}
                      min={0}
                      max={8}
                      onChange={(value) =>
                        updateBuildPolicyDraft((current) => ({
                          ...current,
                          assembler_strategy: {
                            ...current.assembler_strategy,
                            max_highlights: Math.max(0, Math.trunc(value)),
                          },
                        }))
                      }
                      disabled={buildPolicySaving}
                    />
                    <PolicyNumberField
                      id="policy-bullet-max-chars"
                      label="Bullet max chars"
                      description="Character budget per experience or project bullet."
                      value={buildPolicyDraft.assembler_strategy.bullet_max_chars}
                      min={0}
                      onChange={(value) =>
                        updateBuildPolicyDraft((current) => ({
                          ...current,
                          assembler_strategy: {
                            ...current.assembler_strategy,
                            bullet_max_chars: Math.max(0, Math.trunc(value)),
                          },
                        }))
                      }
                      disabled={buildPolicySaving}
                    />
                    <PolicyNumberField
                      id="policy-highlight-max-chars"
                      label="Highlight max chars"
                      description="Character budget per highlight bullet."
                      value={buildPolicyDraft.assembler_strategy.highlight_max_chars}
                      min={0}
                      onChange={(value) =>
                        updateBuildPolicyDraft((current) => ({
                          ...current,
                          assembler_strategy: {
                            ...current.assembler_strategy,
                            highlight_max_chars: Math.max(0, Math.trunc(value)),
                          },
                        }))
                      }
                      disabled={buildPolicySaving}
                    />
                    <PolicyNumberField
                      id="policy-profile-max-chars"
                      label="Profile max chars"
                      description="Character budget for the generated profile section."
                      value={buildPolicyDraft.assembler_strategy.profile_max_chars}
                      min={0}
                      onChange={(value) =>
                        updateBuildPolicyDraft((current) => ({
                          ...current,
                          assembler_strategy: {
                            ...current.assembler_strategy,
                            profile_max_chars: Math.max(0, Math.trunc(value)),
                          },
                        }))
                      }
                      disabled={buildPolicySaving}
                    />
                    <PolicyNumberField
                      id="policy-tag-weight"
                      label="Tag weight"
                      description="Weight assigned to tag coverage during evidence ranking."
                      value={buildPolicyDraft.assembler_strategy.tag_weight}
                      min={0}
                      max={1}
                      step="0.001"
                      onChange={(value) =>
                        updateBuildPolicyDraft((current) => ({
                          ...current,
                          assembler_strategy: {
                            ...current.assembler_strategy,
                            tag_weight: value,
                          },
                        }))
                      }
                      disabled={buildPolicySaving}
                    />
                    <PolicyNumberField
                      id="policy-density-weight"
                      label="Density weight"
                      description="Weight assigned to evidence density during ranking."
                      value={buildPolicyDraft.assembler_strategy.density_weight}
                      min={0}
                      max={1}
                      step="0.001"
                      onChange={(value) =>
                        updateBuildPolicyDraft((current) => ({
                          ...current,
                          assembler_strategy: {
                            ...current.assembler_strategy,
                            density_weight: value,
                          },
                        }))
                      }
                      disabled={buildPolicySaving}
                    />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <PolicyToggleField
                      id="policy-coverage-first-highlights"
                      label="Coverage-first highlights"
                      description="Prefer broader requirement coverage when selecting highlight evidence."
                      checked={buildPolicyDraft.assembler_strategy.coverage_first_highlights ?? true}
                      onChange={(checked) =>
                        updateBuildPolicyDraft((current) => ({
                          ...current,
                          assembler_strategy: {
                            ...current.assembler_strategy,
                            coverage_first_highlights: checked,
                          },
                        }))
                      }
                      disabled={buildPolicySaving}
                    />
                    <PolicyToggleField
                      id="policy-coverage-first-profile"
                      label="Coverage-first profile tiebreak"
                      description="Use coverage-first logic when resolving profile evidence ties."
                      checked={buildPolicyDraft.assembler_strategy.coverage_first_profile_tiebreak ?? true}
                      onChange={(checked) =>
                        updateBuildPolicyDraft((current) => ({
                          ...current,
                          assembler_strategy: {
                            ...current.assembler_strategy,
                            coverage_first_profile_tiebreak: checked,
                          },
                        }))
                      }
                      disabled={buildPolicySaving}
                    />
                  </div>
                  </div>

                  <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">Allow Multi-Evidence Sections</h3>
                      <p className="text-sm text-muted-foreground">
                        Enable sections that can aggregate more than one evidence item into a single claim.
                      </p>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-2">
                      <PolicyToggleField
                        id="policy-multi-highlights"
                        label="Highlights"
                        description="Allow highlights to combine multiple evidence items."
                        checked={buildPolicyDraft.assembler_strategy.allow_multi_evidence_sections.includes('highlights')}
                        onChange={(checked) => toggleMultiEvidenceSection('highlights', checked)}
                        disabled={buildPolicySaving}
                      />
                      <PolicyToggleField
                        id="policy-multi-profile"
                        label="Profile"
                        description="Allow the profile summary to combine multiple evidence items."
                        checked={buildPolicyDraft.assembler_strategy.allow_multi_evidence_sections.includes('profile')}
                        onChange={(checked) => toggleMultiEvidenceSection('profile', checked)}
                        disabled={buildPolicySaving}
                      />
                    </div>
                  </div>

                  {buildPolicyError && (
                    <Alert variant="destructive">
                      <AlertDescription>{buildPolicyError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <p className="text-sm text-muted-foreground">
                      The next pipeline run uses this saved policy immediately for the current database.
                    </p>
                    <Button type="submit" disabled={buildPolicySaving}>
                      {buildPolicySaving ? 'Saving...' : 'Save Build Policy'}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AdoptTagDialog
        open={adoptDialogOpen}
        onOpenChange={setAdoptDialogOpen}
        term={adoptDialogTerm}
        clusterMatchedTags={adoptDialogClusterTags}
        onAdopt={handleAdoptDialogAdopt}
        onCreate={handleAdoptDialogCreate}
      />

      <TagDialog
        open={tagDialogOpen}
        onOpenChange={handleTagDialogOpenChange}
        tag={null}
        draft={tagDialogDraft}
        onSave={handleSuggestedTermSaved}
      />
    </div>
  )
}
