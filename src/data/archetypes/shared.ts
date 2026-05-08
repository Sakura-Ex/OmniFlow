import type { RecipeNodeData } from '../../types/recipe'
import { getId } from '../../utils/resourceIdentifier'

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
  type: string,
  metadata: RecipeNodeData['metadata'],
  fallback: number
): number {
  if (!type.includes(':')) return fallback
  const resourceKey = getId(type)
  const metaValue = metadata[`${resourceKey}_per_tick`]
  if (typeof metaValue === 'number') return metaValue
  return fallback
}
