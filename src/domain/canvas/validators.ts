import type { Node } from 'reactflow'
import type { RecipeNodeData } from '../../types/recipe'
import { ensureRecipeDataShape } from '../../modifiers/calculate'

export function normalizeCanvasNode(node: Node): Node {
  if (!node.data) return node
  const raw = node.data as Record<string, unknown>

  if (node.type === 'sourceNode') {
    const isAuto = typeof raw.is_auto === 'boolean' ? raw.is_auto : (typeof raw.is_virtual === 'boolean' ? raw.is_virtual : true)
    const mode = raw.mode ?? (isAuto ? 'infinite' : 'limit')
    return { ...node, data: { ...raw, mode, is_auto: isAuto } }
  }

  if (node.type === 'recipeNode') {
    const shaped = ensureRecipeDataShape(raw as unknown as RecipeNodeData)
    const isAuto = typeof shaped.is_auto === 'boolean' ? shaped.is_auto : true
    const mode = shaped.mode ?? (isAuto ? 'auto' : 'limit')
    return { ...node, data: { ...raw, ...shaped, mode, is_auto: isAuto } }
  }

  if (node.type === 'targetNode') {
    const isAuto = typeof raw.is_auto === 'boolean' ? raw.is_auto : (typeof raw.is_virtual === 'boolean' ? raw.is_virtual : true)
    const mode = raw.mode ?? (isAuto ? 'maximize' : 'demand')
    return { ...node, data: { ...raw, mode, is_auto: isAuto } }
  }

  return node
}
