import type { Node, Edge } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import { buildResourceId } from '@/common/utils/resourceId'
import { portIdentity } from '@/common/utils/ports'
import { normalizeCanvasNode } from './canvas.validators'
import { normalizeEndpointPorts } from '@/features/recipe/recipe.endpointNorm'
import { migrateEdgePorts, type GraphPort } from '@/features/calculation/graphPorts'
import { splitterPorts } from '@/features/calculation/splitter'

/**
 * Normalize editable identity independently of whether a recipe is currently runnable.
 * @returns Normalized nodes, independent recipes and optionally migrated edges.
 * @param nodes - Canvas nodes.
 * @param edges - Canvas edges with persistent port handles.
 * @param recipes - Authoritative recipes keyed by node identity.
 * @param migrateLegacy - Resolve legacy resource handles only when uniquely matched.
 */
export function normalizeGraph(nodes: Node[], edges: Edge[], recipes: Record<string, RecipeNodeData> = {}, migrateLegacy = false) {
  const nextRecipes: Record<string, RecipeNodeData> = {}
  const ports: GraphPort[] = []
  const nextNodes = nodes.map((node) => {
    const normalized = normalizeCanvasNode(node.type === 'recipeNode' ? { ...node, data: recipes[node.id] ?? node.data } : node)
    if (node.type === 'recipeNode') {
      const recipe = normalized.data as RecipeNodeData
      recipe.inputs = recipe.base_inputs ?? recipe.inputs
      recipe.outputs = recipe.base_outputs ?? recipe.outputs
      nextRecipes[node.id] = recipe
      for (const [direction, groups] of [
        ['input', [...recipe.base_inputs ?? [], ...recipe.base_utility_inputs ?? []]],
        ['output', [...recipe.base_outputs ?? [], ...recipe.base_utility_outputs ?? []]],
      ] as const) {
        for (const port of groups) ports.push({ nodeId: node.id, portId: portIdentity(port), direction, resourceId: buildResourceId(port.category, port.id), port })
      }
    } else if (node.type === 'splitterNode') {
      ports.push(...splitterPorts(node.id, normalized.data))
    } else if (node.type === 'sourceNode' || node.type === 'targetNode') {
      for (const port of normalizeEndpointPorts(normalized.data)) ports.push({ nodeId: node.id, portId: portIdentity(port), direction: node.type === 'sourceNode' ? 'output' : 'input', resourceId: buildResourceId(port.category, port.id), port })
    }
    return normalized
  })
  return { nodes: nextNodes, edges: migrateLegacy ? migrateEdgePorts(edges, ports) : edges, recipes: nextRecipes }
}
