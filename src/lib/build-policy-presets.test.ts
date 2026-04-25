import { describe, expect, it } from 'vitest'
import {
  applyBuildPolicyPreset,
  describeBuildPolicyChanges,
} from '@/lib/build-policy-presets'
import type { BuildPolicy } from '@/lib/types'

const basePolicy: BuildPolicy = {
  policy_type: 'resume_build_policy',
  preflight: {
    threshold: 0.5,
    fallback_min_records: 3,
  },
  include_projects: true,
  max_bullets_per_role: 7,
  max_project_bullets: 6,
  max_projects: 6,
  assembler_strategy: {
    max_highlights: 6,
    bullet_max_chars: 280,
    highlight_max_chars: 280,
    profile_max_chars: 420,
    coverage_first_highlights: true,
    coverage_first_profile_tiebreak: true,
    tag_weight: 0.875,
    density_weight: 0.125,
    allow_multi_evidence_sections: ['highlights', 'profile'],
  },
}

describe('build policy presets', () => {
  it('applies the concise preset without mutating the source policy', () => {
    const nextPolicy = applyBuildPolicyPreset(basePolicy, 'concise')

    expect(nextPolicy.policy_type).toBe('resume_build_policy')
    expect(nextPolicy.preflight).toEqual({ threshold: 0.62, fallback_min_records: 2 })
    expect(nextPolicy.max_bullets_per_role).toBe(4)
    expect(nextPolicy.max_project_bullets).toBe(3)
    expect(nextPolicy.assembler_strategy.profile_max_chars).toBe(320)
    expect(basePolicy.max_bullets_per_role).toBe(7)
  })

  it('restores the balanced default preset values', () => {
    const concisePolicy = applyBuildPolicyPreset(basePolicy, 'concise')
    const balancedPolicy = applyBuildPolicyPreset(concisePolicy, 'balanced')

    expect(balancedPolicy).toEqual(basePolicy)
  })

  it('describes field-level staged changes', () => {
    const nextPolicy = applyBuildPolicyPreset(basePolicy, 'project_heavy')

    expect(describeBuildPolicyChanges(basePolicy, nextPolicy)).toEqual([
      { label: 'Max bullets per role', before: '7', after: '5' },
      { label: 'Fallback minimum records', before: '3', after: '4' },
      { label: 'Max highlights', before: '6', after: '5' },
      { label: 'Highlight max chars', before: '280', after: '260' },
      { label: 'Tag weight', before: '0.875', after: '0.8' },
      { label: 'Density weight', before: '0.125', after: '0.2' },
    ])
  })
})