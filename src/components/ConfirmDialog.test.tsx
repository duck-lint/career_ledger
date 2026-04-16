import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from '@/components/ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders title and description when open', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Delete record?"
        description="This cannot be undone."
        onConfirm={() => {}}
      />,
    )

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('Delete record?')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
  })

  it('calls onConfirm then closes the dialog', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const onOpenChange = vi.fn()

    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete"
        confirmLabel="Delete"
        destructive
        onConfirm={onConfirm}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('surfaces submitting state and guards against dismissal', async () => {
    const user = userEvent.setup()
    let resolveConfirm: (() => void) | null = null
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = () => resolve()
        }),
    )

    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Delete"
        confirmLabel="Delete"
        onConfirm={onConfirm}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.getByRole('button', { name: /Delete\.\.\./ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- TS can't track assignment inside vi.fn callback
    resolveConfirm!()
  })
})
