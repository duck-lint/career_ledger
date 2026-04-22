import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { libraryServiceMock, toastSuccess, toastError } = vi.hoisted(() => ({
  libraryServiceMock: {
    getAllEvidence: vi.fn(),
    getRecords: vi.fn(),
    previewDeleteEvidenceItems: vi.fn(),
    deleteEvidenceItems: vi.fn(),
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

vi.mock('@/components/dialogs/EvidenceDialog', () => ({
  default: () => null,
}))

import EvidenceView from '@/components/views/EvidenceView'

describe('EvidenceView bulk delete flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('previews and commits batch evidence deletion through the shared service seam', async () => {
    const user = userEvent.setup()
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
    const evidence = {
      id: 'evidence-1',
      experience_record_id: record.id,
      claim: 'Built the reporting pipeline',
      date_range: '2024',
      tags: ['data_analysis'],
      evidence_note: null,
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-08T00:00:00Z',
    }
    const preview = {
      requestedCount: 1,
      foundCount: 1,
      missingIds: [],
      evidenceItems: [
        {
          id: evidence.id,
          experienceRecordId: record.id,
          recordSlug: record.slug,
          claim: evidence.claim,
        },
      ],
    }

    libraryServiceMock.getAllEvidence
      .mockResolvedValueOnce([evidence])
      .mockResolvedValueOnce([])
    libraryServiceMock.getRecords.mockResolvedValue([record])
    libraryServiceMock.previewDeleteEvidenceItems.mockResolvedValue(preview)
    libraryServiceMock.deleteEvidenceItems.mockResolvedValue({
      ...preview,
      deletedEvidenceCount: 1,
      strict: true,
    })

    render(
      <EvidenceView selectedRecordId={record.id} onRecordSelect={vi.fn()} />,
    )

    await screen.findByText('Built the reporting pipeline')

    await user.click(
      screen.getByRole('checkbox', {
        name: `Select evidence: ${evidence.claim.slice(0, 40)}`,
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Delete 1' }))

    expect(libraryServiceMock.previewDeleteEvidenceItems).toHaveBeenCalledWith([
      evidence.id,
    ])
    await screen.findByText('Preview loaded for 1 evidence item across 1 record.')

    await user.click(screen.getByRole('button', { name: 'Delete 1 item' }))

    await waitFor(() => {
      expect(libraryServiceMock.deleteEvidenceItems).toHaveBeenCalledWith([evidence.id], {
        strict: true,
      })
    })
    expect(toastSuccess).toHaveBeenCalledWith('Deleted 1 evidence item')
  })
})