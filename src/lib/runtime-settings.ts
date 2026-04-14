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