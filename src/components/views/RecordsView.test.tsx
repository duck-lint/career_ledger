import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { libraryServiceMock, toastSuccess, toastError } = vi.hoisted(() => ({
  libraryServiceMock: {
    getRecords: vi.fn(),
    previewDeleteRecords: vi.fn(),
    deleteRecords: vi.fn(),
  },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/lib/service', () => ({
  libraryService: libraryServiceMock,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/components/dialogs/RecordDialog', () => ({
  default: () => null,
}))

import RecordsView from '@/components/views/RecordsView'

describe('RecordsView bulk delete flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('previews and commits batch record deletion through the shared service seam', async () => {
    const user = userEvent.setup()
    const onRecordSelect = vi.fn()
    const record = {
      id: 'record-1',
      slug: 'record-1-slug',
      record_type: 'employment' as const,
      organization: 'Example Org',
      title: 'Platform Engineer',
      start_date: '2024-01',
      end_date: '2024-12',
      location: null,
      employment_type: null,
      context_tags: [],
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-08T00:00:00Z',
    }
    const preview = {
      requestedCount: 1,
      foundCount: 1,
      missingIds: [],
      records: [
        {
          id: record.id,
          slug: record.slug,
          organization: record.organization,
          title: record.title,
          linkedEvidenceCount: 2,
        },
      ],
      cascadeEvidenceCount: 2,
    }

    libraryServiceMock.getRecords
      .mockResolvedValueOnce([record])
      .mockResolvedValueOnce([])
    libraryServiceMock.previewDeleteRecords.mockResolvedValue(preview)
    libraryServiceMock.deleteRecords.mockResolvedValue({
      ...preview,
      deletedRecordCount: 1,
      deletedEvidenceCount: 2,
      strict: true,
    })

    render(
      <RecordsView selectedRecordId={record.id} onRecordSelect={onRecordSelect} />,
    )

    await screen.findByText('Platform Engineer')

    await user.click(screen.getByRole('checkbox', { name: `Select ${record.slug}` }))
    await user.click(screen.getByRole('button', { name: 'Delete 1' }))

    expect(libraryServiceMock.previewDeleteRecords).toHaveBeenCalledWith([record.id])
    await screen.findByText('Preview loaded for 1 record and 2 linked evidence items.')

    await user.click(screen.getByRole('button', { name: 'Delete 1 record' }))

    await waitFor(() => {
      expect(libraryServiceMock.deleteRecords).toHaveBeenCalledWith([record.id], {
        strict: true,
      })
    })
    await waitFor(() => {
      expect(onRecordSelect).toHaveBeenCalledWith(null)
    })
    expect(toastSuccess).toHaveBeenCalledWith('Deleted 1 record and 2 linked evidence items')
  })
})