import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressSteps } from '@/components/ProgressSteps'

describe('ProgressSteps', () => {
  it('renders each step with the correct status marker', () => {
    render(
      <ProgressSteps
        steps={[
          { id: 'a', label: 'Analyze', status: 'done' },
          { id: 'b', label: 'Assemble', status: 'active', detail: '3 of 8' },
          { id: 'c', label: 'Render', status: 'pending' },
          { id: 'd', label: 'Deliver', status: 'error', detail: 'network down' },
        ]}
      />,
    )

    expect(screen.getByText('Analyze')).toBeInTheDocument()
    expect(screen.getByText('Assemble')).toBeInTheDocument()
    expect(screen.getByText('3 of 8')).toBeInTheDocument()
    expect(screen.getByText('network down')).toBeInTheDocument()
    expect(screen.getByLabelText('Completed')).toBeInTheDocument()
    expect(screen.getByLabelText('In progress')).toBeInTheDocument()
    expect(screen.getByLabelText('Failed')).toBeInTheDocument()
  })
})
