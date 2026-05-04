import type { RecipeNodeData } from '../../types/recipe'
import type { ResourceCategory } from '../../types/types'

const utilityCategoryHints: Array<{ pattern: RegExp; category: ResourceCategory }> = [
  { pattern: /eu|rf|power|energy|voltage/i, category: 'energy' },
  { pattern: /water|steam|fluid|coolant|lava/i, category: 'fluid' },
  { pattern: /stress/i, category: 'stress' },
  { pattern: /heat|thermal/i, category: 'heat' },
]

export function inferUtilityCategory(type: string): ResourceCategory {
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
  if (utilityId === 'gt:eu' && typeof metadata.eu_per_tick === 'number') return metadata.eu_per_tick
  if (utilityId === 'thermal:rf' && typeof metadata.rf_per_tick === 'number') return metadata.rf_per_tick
  return fallback
}
