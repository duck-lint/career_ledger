import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FileText } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'

describe('EmptyState', () => {
  it('renders title and optional description', () => {
    render(<EmptyState title="Nothing here" description="Add your first item" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
    expect(screen.getByText('Add your first item')).toBeInTheDocument()
  })

  it('renders icon and action slots when provided', () => {
    render(
      <EmptyState
        icon={FileText}
        title="Nothing"
        action={<button type="button">Add item</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Add item' })).toBeInTheDocument()
    // icon renders as an inline svg
    expect(screen.getByRole('status').querySelector('svg')).toBeTruthy()
  })
})
