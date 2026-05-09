import type { RecipeNodeData } from '../../types/recipe'
import type { CalculateResponse } from '../../types/api'
import { buildResourceId } from '../../utils/resourceIdentifier'

export function computeCapexList(
  recipes: Record<string, RecipeNodeData>,
  nodeResults: CalculateResponse['node_results'],
): Record<string, number> {
  const capexMap: Record<string, number> = {}

  for (const [nodeId, shaped] of Object.entries(recipes)) {
    const nodeResult =
      nodeResults?.[nodeId] ?? nodeResults?.[shaped.recipe_id]
    const machines =
      nodeResult?.machines_actual ?? nodeResult?.machines_exact ?? 0
    if (machines <= 0) continue

    const allRes = [
      ...(shaped.base_inputs ?? []),
      ...(shaped.base_outputs ?? []),
      ...(shaped.base_utility_inputs ?? []),
      ...(shaped.base_utility_outputs ?? []),
    ]

    for (const r of allRes) {
      if (
        (r.consumable !== false && r.consumable_probability !== 0) ||
        !r.id
      )
        continue

      const key = buildResourceId(r.category, r.id)
      capexMap[key] = (capexMap[key] ?? 0) + r.amount * machines
    }
  }

  return capexMap
}
