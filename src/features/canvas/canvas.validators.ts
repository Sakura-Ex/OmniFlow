import type { Node } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import { ensureRecipeDataShape } from '@/features/modifier/modifier.normalize'

/**
 * Normalize a canvas node by ensuring required defaults (`mode`) are present and
 * shaping recipe-node data through `ensureRecipeDataShape`.
 * @param node - The raw React Flow node to normalize.
 * @returns A new node object with guaranteed defaults applied.
 */
export function normalizeCanvasNode(node: Node): Node {
  if (!node.data) return node
  const raw = node.data as Record<string, unknown>

  const isMode = (value: unknown): value is string => typeof value === 'string'&& value.length > 0

   if (node.type === 'sourceNode') {
    const mode = isMode(raw.mode) ? raw.mode : 'infinite'
    return { ...node, data: { ...raw, mode } }
  }

  if (node.type === 'recipeNode') {
    const shaped = ensureRecipeDataShape(raw as unknown as RecipeNodeData)
    const mode = isMode(shaped.mode) ? shaped.mode : 'auto' 
    return { ...node, data: { ...raw, ...shaped, mode } }
  }

  if (node.type === 'targetNode') {
    const mode = isMode(raw.mode) ? raw.mode : 'maximize'
    return { ...node, data: { ...raw, mode } }
  }

  return node
}
