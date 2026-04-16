const DB_PATH_KEY = 'career-ledger-db-path'

export function getStoredDbPath(): string | null {
  const value = localStorage.getItem(DB_PATH_KEY)
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function setStoredDbPath(path: string): void {
  localStorage.setItem(DB_PATH_KEY, path)
}

export function clearStoredDbPath(): void {
  localStorage.removeItem(DB_PATH_KEY)
}

// ── Artifact output directory ────────────────────────────────────────────────

const ARTIFACT_OUTPUT_DIR_KEY = 'career-ledger-artifact-output-dir'

export function getStoredArtifactOutputDir(): string | null {
  const value = localStorage.getItem(ARTIFACT_OUTPUT_DIR_KEY)
  return value?.trim() || null
}

export function setStoredArtifactOutputDir(dir: string): void {
  localStorage.setItem(ARTIFACT_OUTPUT_DIR_KEY, dir)
}

export function clearStoredArtifactOutputDir(): void {
  localStorage.removeItem(ARTIFACT_OUTPUT_DIR_KEY)
}

// ── Job posting text ─────────────────────────────────────────────────────────

const JOB_POSTING_TEXT_KEY = 'career-ledger-job-posting-text'

export function getStoredJobPostingText(): string | null {
  const value = localStorage.getItem(JOB_POSTING_TEXT_KEY)
  return value?.trim() || null
}

export function setStoredJobPostingText(text: string): void {
  localStorage.setItem(JOB_POSTING_TEXT_KEY, text)
}

export function clearStoredJobPostingText(): void {
  localStorage.removeItem(JOB_POSTING_TEXT_KEY)
}