import type { RecipeNodeData } from '@/common/types/recipe'
import type { CalculateResponse } from '@/common/types/api'
import { buildResourceId } from '@/common/utils/resourceId'
import { flattenRecipeResources } from '@/features/canvas/canvas.utils'

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
