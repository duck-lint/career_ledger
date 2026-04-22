import type { RuntimeServices } from './types'
import { localServices } from './local-service'
import { tauriServices } from './tauri-service'

export type AppRuntimeMode = 'tauri' | 'browser-harness'

export type RuntimeCapability =
  | 'databasePathSelection'
  | 'taxonomyFileImportExport'
  | 'taxonomyClear'
  | 'libraryTagRefresh'
  | 'resumePipeline'
  | 'rawIntakeImport'

export type RuntimeCapabilities = Record<RuntimeCapability, boolean>

export type AppRuntime = {
  mode: AppRuntimeMode
  isTauri: boolean
  label: string
  description: string
  capabilities: RuntimeCapabilities
  services: RuntimeServices
}

function detectTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

const tauriCapabilities: RuntimeCapabilities = {
  databasePathSelection: true,
  taxonomyFileImportExport: true,
  taxonomyClear: true,
  libraryTagRefresh: true,
  resumePipeline: true,
  rawIntakeImport: true,
}

const browserHarnessCapabilities: RuntimeCapabilities = {
  databasePathSelection: false,
  taxonomyFileImportExport: false,
  taxonomyClear: false,
  libraryTagRefresh: false,
  resumePipeline: false,
  rawIntakeImport: false,
}

const isTauriRuntime = detectTauriRuntime()

export const appRuntime: AppRuntime = isTauriRuntime
  ? {
      mode: 'tauri',
      isTauri: true,
      label: 'Tauri · SQLite',
      description: 'Running in the Tauri desktop shell with SQLite persistence.',
      capabilities: tauriCapabilities,
      services: tauriServices,
    }
  : {
      mode: 'browser-harness',
      isTauri: false,
      label: 'Browser harness',
      description:
        'Running in the browser dev harness; data is stored in localStorage and desktop-only features are unavailable.',
      capabilities: browserHarnessCapabilities,
      services: localServices,
    }

export function runtimeSupports(capability: RuntimeCapability): boolean {
  return appRuntime.capabilities[capability]
}