import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData } from '../../types/recipe'

export type CanvasPayloadV1 = {
  version: 1
  nodes: Node[]
  edges: Edge[]
}

export type CanvasPayloadV2 = {
  version: 2
  ui: { nodes: Node[]; edges: Edge[] }
  domain: { recipes: Record<string, RecipeNodeData> }
}

export type CanvasPayload = CanvasPayloadV1 | CanvasPayloadV2

export function migrateV1ToV2(v1Payload: CanvasPayloadV1): CanvasPayloadV2 {
  const recipes: Record<string, RecipeNodeData> = {}
  const migratedNodes: Node[] = v1Payload.nodes.map((node) => {
    if (node.type === 'recipeNode') {
      recipes[node.id] = node.data as RecipeNodeData
      return { ...node, data: { type: 'recipeNode', label: (node.data as { machine_name?: string }).machine_name ?? '' } }
    }
    return node
  })

  return {
    version: 2,
    ui: { nodes: migratedNodes, edges: v1Payload.edges },
    domain: { recipes },
  }
}
