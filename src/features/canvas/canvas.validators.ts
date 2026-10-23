import { stripCalculationResults } from '@/common/utils/calculationState'
import { normalizeEndpointData } from '@/features/recipe/recipe.endpointNorm'
import type { Node } from 'reactflow'
import type { RecipeNodeData, SourceNodeData, TargetNodeData } from '@/common/types/recipe'
import { ensureRecipeDataShape } from '@/features/modifier/modifier.normalize'
import { SplitterNodeDataSchema } from '@/common/schemas/splitter.schema'

/**
 * Normalize a canvas node by ensuring required defaults (`mode`) are present and
 * shaping recipe-node data through `ensureRecipeDataShape`.
 * @param node - The raw React Flow node to normalize.
 * @returns A new node object with guaranteed defaults applied.
 */
export function normalizeCanvasNode(node: Node): Node {
  if (!node.data) return node
  const raw = stripCalculationResults(node.data as Record<string, unknown>)
  if (node.type === 'splitterNode') return { ...node, data: SplitterNodeDataSchema.parse(raw) }

  const isMode = (value: unknown): value is string => typeof value === 'string'&& value.length > 0

   if (node.type === 'sourceNode') {
    const mode = isMode(raw.mode) ? raw.mode : 'infinite'
    return { ...node, data: normalizeEndpointData({ ...raw, mode } as SourceNodeData) }
  }

  if (node.type === 'recipeNode') {
    const shaped = ensureRecipeDataShape(raw as unknown as RecipeNodeData)
    const mode = isMode(shaped.mode) ? shaped.mode : 'auto' 
    return { ...node, data: { ...raw, ...shaped, mode } }
  }

  if (node.type === 'targetNode') {
    const mode = isMode(raw.mode) ? raw.mode : 'maximize'
    return { ...node, data: normalizeEndpointData({ ...raw, mode } as TargetNodeData) }
  }

  return node
}
