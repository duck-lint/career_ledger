import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeServices } from '@/lib/types'

function deleteTauriInternals() {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
}

async function loadRuntimeModule(options: { tauriInternalsPresent: boolean }) {
  vi.resetModules()

  const localAdapter = { adapter: 'local' }
  const tauriAdapter = { adapter: 'tauri' }
  const localServices = {
    runtimeAdmin: localAdapter,
    pipeline: localAdapter,
    library: localAdapter,
    operations: localAdapter,
    taxonomy: localAdapter,
    intake: localAdapter,
    tagNormalization: localAdapter,
  } as unknown as RuntimeServices
  const tauriServices = {
    runtimeAdmin: tauriAdapter,
    pipeline: tauriAdapter,
    library: tauriAdapter,
    operations: tauriAdapter,
    taxonomy: tauriAdapter,
    intake: tauriAdapter,
    tagNormalization: tauriAdapter,
  } as unknown as RuntimeServices

  vi.doMock('@/lib/local-service', () => ({ localServices }))
  vi.doMock('@/lib/tauri-service', () => ({ tauriServices }))

  if (options.tauriInternalsPresent) {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    })
  } else {
    deleteTauriInternals()
  }

  const runtimeModule = await import('@/lib/runtime')
  return {
    ...runtimeModule,
    localAdapter,
    localServices,
    tauriAdapter,
    tauriServices,
  }
}

function expectAllServicesToReferenceAdapter(
  services: RuntimeServices,
  adapter: unknown,
) {
  for (const service of Object.values(services)) {
    expect(service).toBe(adapter)
  }
}

afterEach(() => {
  deleteTauriInternals()
  vi.resetModules()
})

describe('appRuntime', () => {
  it('defaults to the browser harness with the local adapter bundle', async () => {
    const runtimeModule = await loadRuntimeModule({ tauriInternalsPresent: false })

    expect(runtimeModule.appRuntime.mode).toBe('browser-harness')
    expect(runtimeModule.appRuntime.isTauri).toBe(false)
    expect(runtimeModule.appRuntime.label).toBe('Browser harness')
    expect(runtimeModule.runtimeSupports('resumePipeline')).toBe(false)
    expect(runtimeModule.runtimeSupports('rawIntakeImport')).toBe(false)
    expectAllServicesToReferenceAdapter(runtimeModule.appRuntime.services, runtimeModule.localAdapter)
  })

  it('switches to the Tauri runtime when Tauri internals are present', async () => {
    const runtimeModule = await loadRuntimeModule({ tauriInternalsPresent: true })

    expect(runtimeModule.appRuntime.mode).toBe('tauri')
    expect(runtimeModule.appRuntime.isTauri).toBe(true)
    expect(runtimeModule.appRuntime.label).toBe('Tauri · SQLite')
    expect(runtimeModule.runtimeSupports('resumePipeline')).toBe(true)
    expect(runtimeModule.runtimeSupports('rawIntakeImport')).toBe(true)
    expectAllServicesToReferenceAdapter(runtimeModule.appRuntime.services, runtimeModule.tauriAdapter)
  })
})