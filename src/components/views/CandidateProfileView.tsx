import { useEffect, useState } from 'react'
import { careerService } from '@/lib/service'
import type {
  CandidateCertificationEntry,
  CandidateEducationEntry,
  CandidateProfile,
  TagNormalizationResult,
} from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Trash2 as Trash, RefreshCw as ArrowsClockwise } from 'lucide-react'
import { toast } from 'sonner'

type CandidateEducationForm = {
  id: string
  institution: string
  credential: string
  signalTagsText: string
  major: string
  minor: string
}

type CandidateCertificationForm = {
  id: string
  name: string
  issuer: string
  credentialDetail: string
  signalTagsText: string
}

type CandidateProfileForm = {
  version: string
  displayName: string
  location: string
  email: string
  phone: string
  linkedin: string
  github: string
  education: CandidateEducationForm[]
  certifications: CandidateCertificationForm[]
  profileSummarySeedText: string
}

type SignalTagPreviewMap = Record<string, TagNormalizationResult>

function parseList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseLineList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function optionalize(value: string): string | null {
  const normalized = value.trim()
  return normalized ? normalized : null
}

async function normalizeSignalTagText(signalTagsText: string): Promise<TagNormalizationResult> {
  const signalTags = parseList(signalTagsText)
  if (signalTags.length === 0) {
    return { normalized: [], unknown: [] }
  }

  return careerService.normalizeTags(signalTags)
}

function createEducationForm(entry?: CandidateEducationEntry): CandidateEducationForm {
  return {
    id: entry?.id ?? crypto.randomUUID(),
    institution: entry?.institution ?? '',
    credential: entry?.credential ?? '',
    signalTagsText: entry?.signalTags.join(', ') ?? '',
    major: entry?.fieldNotes.major ?? '',
    minor: entry?.fieldNotes.minor ?? '',
  }
}

function createCertificationForm(entry?: CandidateCertificationEntry): CandidateCertificationForm {
  return {
    id: entry?.id ?? crypto.randomUUID(),
    name: entry?.name ?? '',
    issuer: entry?.issuer ?? '',
    credentialDetail: entry?.credentialDetail ?? '',
    signalTagsText: entry?.signalTags.join(', ') ?? '',
  }
}

function createEmptyForm(): CandidateProfileForm {
  return {
    version: '1.0',
    displayName: '',
    location: '',
    email: '',
    phone: '',
    linkedin: '',
    github: '',
    education: [],
    certifications: [],
    profileSummarySeedText: '',
  }
}

function profileToForm(profile: CandidateProfile): CandidateProfileForm {
  return {
    version: profile.version,
    displayName: profile.candidateIdentity.displayName,
    location: profile.candidateIdentity.location,
    email: profile.candidateIdentity.contact.email ?? '',
    phone: profile.candidateIdentity.contact.phone ?? '',
    linkedin: profile.candidateIdentity.contact.linkedin ?? '',
    github: profile.candidateIdentity.contact.github ?? '',
    education: profile.staticSections.education.map((entry) => createEducationForm(entry)),
    certifications: profile.staticSections.certifications.map((entry) =>
      createCertificationForm(entry)
    ),
    profileSummarySeedText: profile.staticSections.profileSummarySeed.join('\n'),
  }
}

function isBlankEducation(entry: CandidateEducationForm): boolean {
  return ![
    entry.institution,
    entry.credential,
    entry.signalTagsText,
    entry.major,
    entry.minor,
  ].some((value) => value.trim())
}

function isBlankCertification(entry: CandidateCertificationForm): boolean {
  return ![
    entry.name,
    entry.issuer,
    entry.credentialDetail,
    entry.signalTagsText,
  ].some((value) => value.trim())
}

function formToProfile(form: CandidateProfileForm): CandidateProfile {
  return {
    version: form.version.trim() || '1.0',
    configType: 'candidate_profile',
    candidateIdentity: {
      displayName: form.displayName.trim(),
      location: form.location.trim(),
      contact: {
        email: optionalize(form.email),
        phone: optionalize(form.phone),
        linkedin: optionalize(form.linkedin),
        github: optionalize(form.github),
      },
    },
    staticSections: {
      education: form.education
        .filter((entry) => !isBlankEducation(entry))
        .map((entry) => ({
          id: entry.id,
          institution: entry.institution.trim(),
          credential: entry.credential.trim(),
          signalTags: parseList(entry.signalTagsText),
          fieldNotes: {
            major: optionalize(entry.major),
            minor: optionalize(entry.minor),
          },
        })),
      certifications: form.certifications
        .filter((entry) => !isBlankCertification(entry))
        .map((entry) => ({
          id: entry.id,
          name: entry.name.trim(),
          issuer: entry.issuer.trim(),
          credentialDetail: entry.credentialDetail.trim(),
          signalTags: parseList(entry.signalTagsText),
        })),
      profileSummarySeed: parseLineList(form.profileSummarySeedText),
    },
  }
}

export default function CandidateProfileView() {
  const [form, setForm] = useState<CandidateProfileForm>(createEmptyForm())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasPersistedProfile, setHasPersistedProfile] = useState(false)
  const [educationTagPreviews, setEducationTagPreviews] = useState<SignalTagPreviewMap>({})
  const [certificationTagPreviews, setCertificationTagPreviews] = useState<SignalTagPreviewMap>({})
  const [signalTagPreviewLoading, setSignalTagPreviewLoading] = useState(false)
  const [signalTagPreviewError, setSignalTagPreviewError] = useState<string | null>(null)

  const loadProfile = async () => {
    setLoading(true)
    try {
      const profile = await careerService.getCandidateProfile()
      setForm(profile ? profileToForm(profile) : createEmptyForm())
      setHasPersistedProfile(Boolean(profile))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load candidate profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProfile()
  }, [])

  useEffect(() => {
    let cancelled = false

    const refreshSignalTagPreviews = async () => {
      const educationEntries = form.education.map((entry) => ({
        id: entry.id,
        signalTagsText: entry.signalTagsText,
      }))
      const certificationEntries = form.certifications.map((entry) => ({
        id: entry.id,
        signalTagsText: entry.signalTagsText,
      }))

      if (educationEntries.length === 0 && certificationEntries.length === 0) {
        setEducationTagPreviews({})
        setCertificationTagPreviews({})
        setSignalTagPreviewError(null)
        setSignalTagPreviewLoading(false)
        return
      }

      setSignalTagPreviewLoading(true)
      setSignalTagPreviewError(null)

      try {
        const [educationResults, certificationResults] = await Promise.all([
          Promise.all(
            educationEntries.map(async (entry) => [
              entry.id,
              await normalizeSignalTagText(entry.signalTagsText),
            ] as const)
          ),
          Promise.all(
            certificationEntries.map(async (entry) => [
              entry.id,
              await normalizeSignalTagText(entry.signalTagsText),
            ] as const)
          ),
        ])

        if (cancelled) {
          return
        }

        setEducationTagPreviews(Object.fromEntries(educationResults))
        setCertificationTagPreviews(Object.fromEntries(certificationResults))
      } catch (error) {
        if (cancelled) {
          return
        }

        setSignalTagPreviewError(
          error instanceof Error ? error.message : 'Failed to refresh signal tag preview'
        )
      } finally {
        if (!cancelled) {
          setSignalTagPreviewLoading(false)
        }
      }
    }

    void refreshSignalTagPreviews()

    return () => {
      cancelled = true
    }
  }, [form.education, form.certifications])

  const updateEducation = (index: number, patch: Partial<CandidateEducationForm>) => {
    setForm((current) => ({
      ...current,
      education: current.education.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry
      ),
    }))
  }

  const updateCertification = (index: number, patch: Partial<CandidateCertificationForm>) => {
    setForm((current) => ({
      ...current,
      certifications: current.certifications.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry
      ),
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const saved = await careerService.replaceCandidateProfile(formToProfile(form))
      setForm(profileToForm(saved))
      setHasPersistedProfile(true)
      toast.success('Candidate profile saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save candidate profile')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!hasPersistedProfile) {
      setForm(createEmptyForm())
      return
    }

    setSaving(true)
    try {
      await careerService.deleteCandidateProfile()
      setForm(createEmptyForm())
      setHasPersistedProfile(false)
      toast.success('Candidate profile deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete candidate profile')
    } finally {
      setSaving(false)
    }
  }

  const renderSignalTagPreview = (
    signalTagsText: string,
    preview: TagNormalizationResult | undefined,
  ) => {
    const hasInput = parseList(signalTagsText).length > 0
    if (!hasInput) {
      return null
    }

    if (signalTagPreviewLoading && !preview) {
      return <p className="text-xs text-muted-foreground">Refreshing taxonomy preview...</p>
    }

    if (!preview) {
      return null
    }

    return (
      <div className="space-y-2">
        {preview.normalized.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Normalized preview</p>
            <div className="flex flex-wrap gap-1">
              {preview.normalized.map((tag) => (
                <Badge key={tag} variant="secondary" className="mono text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {preview.unknown.length > 0 && (
          <p className="text-xs text-destructive">
            Unknown to taxonomy: {preview.unknown.join(', ')}
          </p>
        )}
      </div>
    )
  }

  const unknownSignalTags = Array.from(
    new Set(
      [...Object.values(educationTagPreviews), ...Object.values(certificationTagPreviews)].flatMap(
        (preview) => preview.unknown
      )
    )
  )
  const hasUnknownSignalTags = unknownSignalTags.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Candidate Profile</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            SQLite-backed replacement for candidate_profile.json, including education, certifications, and summary seed lines.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadProfile()} disabled={loading || saving}>
            <ArrowsClockwise className="mr-2" />
            Reload
          </Button>
          <Button variant="outline" onClick={() => void handleDelete()} disabled={saving}>
            Delete
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={loading || saving || signalTagPreviewLoading || hasUnknownSignalTags}
          >
            Save Profile
          </Button>
        </div>
      </div>

      <Alert>
        <AlertDescription>
          Empty education or certification rows are ignored on save. Partially filled rows must satisfy the backend validation rules.
        </AlertDescription>
      </Alert>

      {signalTagPreviewError && (
        <Alert>
          <AlertDescription>{signalTagPreviewError}</AlertDescription>
        </Alert>
      )}

      {hasUnknownSignalTags && (
        <Alert>
          <AlertDescription>
            Save is blocked until unknown signal tags are resolved: {unknownSignalTags.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Alert>
          <AlertDescription>Loading candidate profile...</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Version</Label>
                  <Input
                    value={form.version}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, version: event.target.value }))
                    }
                    placeholder="1.0"
                  />
                </div>
                <div className="flex items-end">
                  <Badge variant={hasPersistedProfile ? 'secondary' : 'outline'}>
                    {hasPersistedProfile ? 'Persisted profile loaded' : 'No persisted profile yet'}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input
                    value={form.displayName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, displayName: event.target.value }))
                    }
                    placeholder="Candidate name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    value={form.location}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, location: event.target.value }))
                    }
                    placeholder="City, region"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, email: event.target.value }))
                    }
                    placeholder="name@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, phone: event.target.value }))
                    }
                    placeholder="Phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>LinkedIn</Label>
                  <Input
                    value={form.linkedin}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, linkedin: event.target.value }))
                    }
                    placeholder="LinkedIn URL"
                  />
                </div>
                <div className="space-y-2">
                  <Label>GitHub</Label>
                  <Input
                    value={form.github}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, github: event.target.value }))
                    }
                    placeholder="GitHub URL"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile Summary Seed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label>One line per seed item</Label>
              <Textarea
                value={form.profileSummarySeedText}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    profileSummarySeedText: event.target.value,
                  }))
                }
                rows={6}
                placeholder="Evidence-bounded resume builder\nSQLite-first domain model"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle>Education</CardTitle>
                <Button
                  variant="outline"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      education: [...current.education, createEducationForm()],
                    }))
                  }
                >
                  <Plus className="mr-2" />
                  Add Education
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.education.length === 0 ? (
                <Alert>
                  <AlertDescription>No education rows yet.</AlertDescription>
                </Alert>
              ) : (
                form.education.map((entry, index) => (
                  <div key={entry.id} className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="outline" className="mono">
                        {entry.id}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            education: current.education.filter((_, entryIndex) => entryIndex !== index),
                          }))
                        }
                      >
                        <Trash />
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Institution</Label>
                        <Input
                          value={entry.institution}
                          onChange={(event) =>
                            updateEducation(index, { institution: event.target.value })
                          }
                          placeholder="Institution"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Credential</Label>
                        <Input
                          value={entry.credential}
                          onChange={(event) =>
                            updateEducation(index, { credential: event.target.value })
                          }
                          placeholder="Credential"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Signal Tags</Label>
                        <Input
                          value={entry.signalTagsText}
                          onChange={(event) =>
                            updateEducation(index, { signalTagsText: event.target.value })
                          }
                          placeholder="python, data_analysis"
                        />
                        {renderSignalTagPreview(
                          entry.signalTagsText,
                          educationTagPreviews[entry.id]
                        )}
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Major</Label>
                          <Input
                            value={entry.major}
                            onChange={(event) => updateEducation(index, { major: event.target.value })}
                            placeholder="Major"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Minor</Label>
                          <Input
                            value={entry.minor}
                            onChange={(event) => updateEducation(index, { minor: event.target.value })}
                            placeholder="Minor"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle>Certifications</CardTitle>
                <Button
                  variant="outline"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      certifications: [...current.certifications, createCertificationForm()],
                    }))
                  }
                >
                  <Plus className="mr-2" />
                  Add Certification
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.certifications.length === 0 ? (
                <Alert>
                  <AlertDescription>No certification rows yet.</AlertDescription>
                </Alert>
              ) : (
                form.certifications.map((entry, index) => (
                  <div key={entry.id} className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="outline" className="mono">
                        {entry.id}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            certifications: current.certifications.filter(
                              (_, entryIndex) => entryIndex !== index
                            ),
                          }))
                        }
                      >
                        <Trash />
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={entry.name}
                          onChange={(event) => updateCertification(index, { name: event.target.value })}
                          placeholder="Certification name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Issuer</Label>
                        <Input
                          value={entry.issuer}
                          onChange={(event) => updateCertification(index, { issuer: event.target.value })}
                          placeholder="Issuer"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Credential Detail</Label>
                        <Input
                          value={entry.credentialDetail}
                          onChange={(event) =>
                            updateCertification(index, { credentialDetail: event.target.value })
                          }
                          placeholder="Issued 2024"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Signal Tags</Label>
                        <Input
                          value={entry.signalTagsText}
                          onChange={(event) =>
                            updateCertification(index, { signalTagsText: event.target.value })
                          }
                          placeholder="workday, hris"
                        />
                        {renderSignalTagPreview(
                          entry.signalTagsText,
                          certificationTagPreviews[entry.id]
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}