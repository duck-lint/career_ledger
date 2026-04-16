import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('joins truthy class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('filters falsy values', () => {
    expect(cn('a', false && 'b', undefined, null, 'c')).toBe('a c')
  })

  it('merges conflicting tailwind classes', () => {
    // tailwind-merge keeps the last conflicting utility.
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})
