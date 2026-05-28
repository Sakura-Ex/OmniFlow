import type { RecipeNodeData } from '@/common/types/recipe'
import type { CalculateResponse } from '@/common/types/api'
import { buildResourceId } from '@/common/utils/resourceId'
import { flattenRecipeResources } from '@/features/canvas/canvas.utils'

/**
 * Compute the capital expenditure (CapEx) list from recipe data and backend
 * calculation results.
 *
 * For each recipe node whose actual machine count exceeds zero, the function
 * multiplies every non-consumable resource amount by the machine count.
 * Resources with `consumable: true` or `probability: 0` are excluded.
 *
 * @param recipes    - Recipe store keyed by node ID.
 * @param nodeResults - Per-node results from the backend calculation response.
 * @returns A map of qualified resource ID → total capex amount.
 */
export function computeCapexList(
  recipes: Record<string, RecipeNodeData>,
  nodeResults: CalculateResponse['node_results'],
): Record<string, number> {
  const capexMap: Record<string, number> = {}

  for (const [nodeId, shaped] of Object.entries(recipes)) {
    const nodeResult =
      nodeResults?.[nodeId] ?? nodeResults?.[shaped.recipe_id]
    const machines =
      nodeResult?.machine_actual ?? nodeResult?.machines_exact ?? 0
    if (machines <= 0) continue

    const allRes = flattenRecipeResources(shaped)

    for (const r of allRes) {
      if (
        (r.consumable !== false && r.probability !== 0) ||
        !r.id
      )
        continue

      const key = buildResourceId(r.category, r.id)
      capexMap[key] = (capexMap[key] ?? 0) + r.amount * machines
    }
  }

  return capexMap
}
