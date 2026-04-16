import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MinWidthGuard } from '@/components/MinWidthGuard'

describe('MinWidthGuard', () => {
  it('renders children when viewport is wide enough', () => {
    render(
      <MinWidthGuard>
        <span>Content</span>
      </MinWidthGuard>,
    )

    // matchMedia polyfill reports matches=false, so the overlay stays hidden.
    expect(screen.getByText('Content')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
