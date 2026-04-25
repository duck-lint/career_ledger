import type { BuildPolicy } from './types'

export type BuildPolicyPresetId = 'balanced' | 'concise' | 'coverage_first' | 'project_heavy'

export type BuildPolicyPreset = {
  id: BuildPolicyPresetId
  label: string
  description: string
}

export type BuildPolicyChange = {
  label: string
  before: string
  after: string
}

type PresetValues = Omit<BuildPolicy, 'policy_type'>

const presetValues: Record<BuildPolicyPresetId, PresetValues> = {
  balanced: {
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
  },
  concise: {
    preflight: {
      threshold: 0.62,
      fallback_min_records: 2,
    },
    include_projects: true,
    max_bullets_per_role: 4,
    max_project_bullets: 3,
    max_projects: 2,
    assembler_strategy: {
      max_highlights: 4,
      bullet_max_chars: 220,
      highlight_max_chars: 220,
      profile_max_chars: 320,
      coverage_first_highlights: true,
      coverage_first_profile_tiebreak: true,
      tag_weight: 0.9,
      density_weight: 0.1,
      allow_multi_evidence_sections: ['highlights', 'profile'],
    },
  },
  coverage_first: {
    preflight: {
      threshold: 0.42,
      fallback_min_records: 4,
    },
    include_projects: true,
    max_bullets_per_role: 6,
    max_project_bullets: 5,
    max_projects: 4,
    assembler_strategy: {
      max_highlights: 6,
      bullet_max_chars: 260,
      highlight_max_chars: 260,
      profile_max_chars: 420,
      coverage_first_highlights: true,
      coverage_first_profile_tiebreak: true,
      tag_weight: 0.92,
      density_weight: 0.08,
      allow_multi_evidence_sections: ['highlights', 'profile'],
    },
  },
  project_heavy: {
    preflight: {
      threshold: 0.5,
      fallback_min_records: 4,
    },
    include_projects: true,
    max_bullets_per_role: 5,
    max_project_bullets: 6,
    max_projects: 6,
    assembler_strategy: {
      max_highlights: 5,
      bullet_max_chars: 280,
      highlight_max_chars: 260,
      profile_max_chars: 420,
      coverage_first_highlights: true,
      coverage_first_profile_tiebreak: true,
      tag_weight: 0.8,
      density_weight: 0.2,
      allow_multi_evidence_sections: ['highlights', 'profile'],
    },
  },
}

export const BUILD_POLICY_PRESETS: BuildPolicyPreset[] = [
  {
    id: 'balanced',
    label: 'Balanced default',
    description: 'Restore the bundled policy: broad evidence coverage with moderate length budgets.',
  },
  {
    id: 'concise',
    label: 'Concise',
    description: 'Favor shorter output, tighter preflight selection, and smaller project presence.',
  },
  {
    id: 'coverage_first',
    label: 'Coverage-first',
    description: 'Lower the filter threshold and weight tag coverage so more requirement areas survive.',
  },
  {
    id: 'project_heavy',
    label: 'Project-heavy',
    description: 'Reserve more room for project records while keeping employment bullets controlled.',
  },
]

export function applyBuildPolicyPreset(
  currentPolicy: BuildPolicy,
  presetId: BuildPolicyPresetId,
): BuildPolicy {
  const preset = presetValues[presetId]

  return {
    policy_type: currentPolicy.policy_type,
    include_projects: preset.include_projects,
    max_bullets_per_role: preset.max_bullets_per_role,
    max_project_bullets: preset.max_project_bullets,
    max_projects: preset.max_projects,
    preflight: preset.preflight ? { ...preset.preflight } : undefined,
    assembler_strategy: {
      ...preset.assembler_strategy,
      allow_multi_evidence_sections: [
        ...preset.assembler_strategy.allow_multi_evidence_sections,
      ],
    },
  }
}

function formatPolicyValue(value: boolean | number | string[]): string {
  if (typeof value === 'boolean') {
    return value ? 'on' : 'off'
  }

  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? value.toString()
      : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  }

  return value.length > 0 ? value.join(', ') : 'none'
}

const trackedFields = [
  {
    label: 'Include projects',
    read: (policy: BuildPolicy) => policy.include_projects,
  },
  {
    label: 'Max bullets per role',
    read: (policy: BuildPolicy) => policy.max_bullets_per_role,
  },
  {
    label: 'Max project bullets',
    read: (policy: BuildPolicy) => policy.max_project_bullets,
  },
  {
    label: 'Max projects',
    read: (policy: BuildPolicy) => policy.max_projects,
  },
  {
    label: 'Preflight threshold',
    read: (policy: BuildPolicy) => policy.preflight?.threshold ?? 0,
  },
  {
    label: 'Fallback minimum records',
    read: (policy: BuildPolicy) => policy.preflight?.fallback_min_records ?? 3,
  },
  {
    label: 'Max highlights',
    read: (policy: BuildPolicy) => policy.assembler_strategy.max_highlights,
  },
  {
    label: 'Bullet max chars',
    read: (policy: BuildPolicy) => policy.assembler_strategy.bullet_max_chars,
  },
  {
    label: 'Highlight max chars',
    read: (policy: BuildPolicy) => policy.assembler_strategy.highlight_max_chars,
  },
  {
    label: 'Profile max chars',
    read: (policy: BuildPolicy) => policy.assembler_strategy.profile_max_chars,
  },
  {
    label: 'Coverage-first highlights',
    read: (policy: BuildPolicy) => policy.assembler_strategy.coverage_first_highlights ?? true,
  },
  {
    label: 'Coverage-first profile tiebreak',
    read: (policy: BuildPolicy) => policy.assembler_strategy.coverage_first_profile_tiebreak ?? true,
  },
  {
    label: 'Tag weight',
    read: (policy: BuildPolicy) => policy.assembler_strategy.tag_weight,
  },
  {
    label: 'Density weight',
    read: (policy: BuildPolicy) => policy.assembler_strategy.density_weight,
  },
  {
    label: 'Multi-evidence sections',
    read: (policy: BuildPolicy) => [...policy.assembler_strategy.allow_multi_evidence_sections].sort(),
  },
]

export function describeBuildPolicyChanges(
  beforePolicy: BuildPolicy,
  afterPolicy: BuildPolicy,
): BuildPolicyChange[] {
  return trackedFields.flatMap((field) => {
    const before = formatPolicyValue(field.read(beforePolicy))
    const after = formatPolicyValue(field.read(afterPolicy))

    return before === after ? [] : [{ label: field.label, before, after }]
  })
}