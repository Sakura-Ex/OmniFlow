import type { Node } from 'reactflow'
import type { RecipeNodeData } from '../../types/recipe'
import { ensureRecipeDataShape } from '../../modifiers/normalize'

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
