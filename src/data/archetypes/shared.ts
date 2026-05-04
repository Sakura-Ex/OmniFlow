import type { RecipeNodeData } from '../../types/recipe'

const utilityCategoryHints: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /eu|rf|power|energy|voltage/i, category: 'energy' },
  { pattern: /water|steam|fluid|coolant|lava/i, category: 'fluid' },
  { pattern: /stress/i, category: 'stress' },
  { pattern: /heat|thermal/i, category: 'heat' },
]

export function inferUtilityCategory(type: string): string {
  for (const hint of utilityCategoryHints) {
    if (hint.pattern.test(type)) return hint.category
  }
  return 'item'
}

export function deriveUtilityAmount(
  utilityId: string,
  metadata: RecipeNodeData['metadata'],
  fallback: number
): number {
  const parts = utilityId.split(':')
  if (parts.length === 2) {
    const resourceKey = parts[1]
    const metaValue = metadata[`${resourceKey}_per_tick`]
    if (typeof metaValue === 'number') return metaValue
  }
  return fallback
}
