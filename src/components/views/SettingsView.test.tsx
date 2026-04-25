import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { intakeServiceMock, runtimeSupportsMock, toastSuccess, toastError } = vi.hoisted(() => ({
  intakeServiceMock: {
    previewRawIntake: vi.fn(),
    importRawIntake: vi.fn(),
  },
  runtimeSupportsMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

vi.mock('@/lib/service', () => ({
  intakeService: intakeServiceMock,
  runtimeAdminService: {
    initialize: vi.fn(),
    getActiveDbPath: vi.fn(),
    reset: vi.fn(),
  },
}))

vi.mock('@/lib/runtime', () => ({
  runtimeSupports: runtimeSupportsMock,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

import SettingsView from '@/components/views/SettingsView'

function buildPreviewResult(path: string) {
  return {
    success: true,
    source_path: path,
    total_item_count: 2,
    would_import_record_count: 0,
    would_import_evidence_count: 1,
    skipped_count: 1,
    skip_reasons: [{ reason: 'unknown_target_record', count: 1 }],
    duplicate_intake_ids: [],
    items: [
      {
        item_ref: 'item-1',
        intake_id: 'item-1',
        source_area: 'example-hr-ops',
        action: 'targeted_evidence',
        outcome: 'would_import',
        target_record_id: 'rec_1',
        target_record_slug: 'sample-record',
        would_create_record: false,
        would_create_evidence: true,
        skip_reason: null,
        repair_hint: null,
        message: 'item-1: would insert evidence under rec_1 (sample-record)',
      },
      {
        item_ref: 'missing-target-1',
        intake_id: 'missing-target-1',
        source_area: 'example-hr-ops',
        action: 'targeted_evidence',
        outcome: 'skipped',
        target_record_id: null,
        target_record_slug: null,
        would_create_record: false,
        would_create_evidence: false,
        skip_reason: 'unknown_target_record',
        repair_hint: 'Create the target record or correct target_record_ref, then retry the same intake file.',
        message: "missing-target-1: target record 'missing-record' does not exist",
      },
    ],
    messages: ['item-1: would insert evidence under rec_1 (sample-record)'],
    error: null,
  }
}

describe('SettingsView raw intake preview flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runtimeSupportsMock.mockImplementation((capability: string) => capability === 'rawIntakeImport')
  })

  it('requires previewing the current raw intake file before importing it', async () => {
    const user = userEvent.setup()
    const path = 'C:\\work\\raw-intake.yaml'

    intakeServiceMock.previewRawIntake.mockResolvedValue(buildPreviewResult(path))
    intakeServiceMock.importRawIntake.mockResolvedValue({
      run_id: 'run-1',
      success: true,
      source_path: path,
      imported_record_count: 0,
      imported_evidence_count: 1,
      skipped_count: 1,
      skip_reasons: [{ reason: 'unknown_target_record', count: 1 }],
      duplicate_intake_ids: [],
      messages: ['item-1: inserted evidence_item evidence-1 under rec_1 (sample-record)'],
      error: null,
    })

    render(<SettingsView />)

    const importButton = screen.getByRole('button', { name: 'Import Preview' })
    expect(importButton).toBeDisabled()

    await user.type(screen.getByPlaceholderText(/raw-intake\.yaml/), path)
    expect(importButton).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Preview Raw Intake' }))

    await screen.findByText('Preview ready')
    expect(screen.getByText('items: 2')).toBeInTheDocument()
    expect(screen.getByText('Repair: Create the target record or correct target_record_ref, then retry the same intake file.')).toBeInTheDocument()
    expect(intakeServiceMock.previewRawIntake).toHaveBeenCalledWith(path)

    await waitFor(() => {
      expect(importButton).toBeEnabled()
    })

    await user.click(importButton)

    await waitFor(() => {
      expect(intakeServiceMock.importRawIntake).toHaveBeenCalledWith(path)
    })
    expect(toastSuccess).toHaveBeenCalledWith('Imported 0 record(s) and 1 evidence item(s)')
  })

  it('invalidates the preview when the raw intake path changes before import', async () => {
    const user = userEvent.setup()
    const path = 'C:\\work\\raw-intake.yaml'
    const changedPath = 'C:\\work\\other-intake.yaml'

    intakeServiceMock.previewRawIntake.mockResolvedValue(buildPreviewResult(path))

    render(<SettingsView />)

    const pathInput = screen.getByPlaceholderText(/raw-intake\.yaml/)
    const importButton = screen.getByRole('button', { name: 'Import Preview' })

    await user.type(pathInput, path)
    await user.click(screen.getByRole('button', { name: 'Preview Raw Intake' }))

    await screen.findByText('Preview ready')
    await waitFor(() => {
      expect(importButton).toBeEnabled()
    })

    await user.clear(pathInput)
    await user.type(pathInput, changedPath)

    expect(importButton).toBeDisabled()
    expect(screen.queryByText('Preview ready')).not.toBeInTheDocument()
    expect(intakeServiceMock.importRawIntake).not.toHaveBeenCalled()
  })
})
