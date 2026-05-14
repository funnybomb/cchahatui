export const EFFORT_LEVELS = ['low', 'medium', 'high', 'max'] as const

export type EffortLevel = (typeof EFFORT_LEVELS)[number]

const FALLBACK_EFFORT: EffortLevel = 'medium'
const DEEPSEEK_DEFAULT_EFFORT: EffortLevel = 'high'

export function isEffortLevel(value: unknown): value is EffortLevel {
  return typeof value === 'string' && EFFORT_LEVELS.includes(value as EffortLevel)
}

export function getDefaultEffortForRuntimeIdentity(
  identityParts: Array<string | null | undefined>,
): EffortLevel {
  const identity = identityParts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .toLowerCase()

  return identity.includes('deepseek') ? DEEPSEEK_DEFAULT_EFFORT : FALLBACK_EFFORT
}

export function resolveEffortLevel(
  value: unknown,
  identityParts: Array<string | null | undefined> = [],
): EffortLevel {
  return isEffortLevel(value)
    ? value
    : getDefaultEffortForRuntimeIdentity(identityParts)
}
