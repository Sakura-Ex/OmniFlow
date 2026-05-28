import type { RecipeNodeData } from '@/common/types/recipe'
import { getId } from '@/common/utils/resourceId'

const utilityCategoryHints: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /eu|rf|power|energy|voltage/i, category: 'energy' },
  { pattern: /water|steam|fluid|coolant|lava/i, category: 'fluid' },
  { pattern: /stress/i, category: 'stress' },
  { pattern: /heat|thermal/i, category: 'heat' },
]

/**
 * Infers a utility category (e.g. `'energy'`, `'fluid'`, `'stress'`, `'heat'`,
 * `'item'`) from a utility type string by pattern-matching.
 *
 * @param type The utility type string (e.g. `'gtceu:energy'`).
 * @returns The inferred category, defaulting to `'item'`.
 */
export function inferUtilityCategory(type: string): string {
  for (const hint of utilityCategoryHints) {
    if (hint.pattern.test(type)) return hint.category
  }
  return 'item'
}

/**
 * Derives the numeric amount for a utility from recipe metadata, falling back
 * to a default value when no metadata entry exists.
 *
 * @param type     The utility type string (may contain a `:` separator).
 * @param metadata Recipe metadata keyed by resource identifiers.
 * @param fallback Default amount when no metadata value is found.
 * @returns The derived utility amount.
 */
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
