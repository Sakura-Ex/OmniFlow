import type { Node } from 'reactflow'
import type { RecipeNodeData } from '../../types/recipe'
import { ensureRecipeDataShape } from '../../modifiers/normalize'

export function normalizeCanvasNode(node: Node): Node {
  if (!node.data) return node
  const raw = node.data as Record<string, unknown>

  if (node.type === 'sourceNode') {
    const mode = raw.mode ?? 'infinite'
    return { ...node, data: { ...raw, mode } }
  }

  if (node.type === 'recipeNode') {
    const shaped = ensureRecipeDataShape(raw as unknown as RecipeNodeData)
    const mode = shaped.mode ?? 'auto'
    return { ...node, data: { ...raw, ...shaped, mode } }
  }

  if (node.type === 'targetNode') {
    const mode = raw.mode ?? 'maximize'
    return { ...node, data: { ...raw, mode } }
  }

  return node
}
