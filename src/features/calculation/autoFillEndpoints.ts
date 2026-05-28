import type { Node, Edge } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import { buildResourceId } from '@/common/utils/resourceId'
import { generateId } from '@/common/utils/id'

/**
 * Parameters for {@link computeAutoFillEndpoints}.
 *
 * @property nodeId           - The recipe node ID to auto-fill endpoints for.
 * @property recipeNodeData   - The shaped recipe node data.
 * @property allNodes         - All canvas nodes (used to locate the recipe node's position).
 * @property allEdges         - All canvas edges (used to detect missing connections).
 * @property lastSystemInputs - Cached input amounts from the previous calculation, keyed by resource ID.
 * @property lastSystemOutputs - Cached output amounts from the previous calculation, keyed by resource ID.
 * @property makeId           - Factory function that produces unique IDs for new source/target nodes.
 */
export type ComputeAutoFillParams = {
  nodeId: string
  recipeNodeData: RecipeNodeData
  allNodes: Node[]
  allEdges: Edge[]
  lastSystemInputs: Record<string, number>
  lastSystemOutputs: Record<string, number>
  makeId: () => string
}

/**
 * The result of auto-filling missing endpoints.
 *
 * @property nodesToAdd - Source/target nodes that should be added to the canvas.
 * @property edgesToAdd - Edges that connect the new nodes to the recipe node.
 */
export type AutoFillResult = {
  nodesToAdd: Node[]
  edgesToAdd: Edge[]
}

/**
 * Auto-create source and target nodes (with edges) for every input/output port
 * of a recipe node that is not yet connected on the canvas.
 *
 * Missing inputs get a new `sourceNode` placed to the left of the recipe node;
 * missing outputs get a new `targetNode` placed to the right. Cached amounts
 * from the previous calculation are reused when available.
 *
 * @param params - Configuration object (see {@link ComputeAutoFillParams}).
 * @returns An {@link AutoFillResult} containing the nodes and edges to add.
 *          Returns empty arrays when all ports are already connected.
 */
export function computeAutoFillEndpoints(params: ComputeAutoFillParams): AutoFillResult {
  const {
    nodeId,
    recipeNodeData,
    allNodes,
    allEdges,
    lastSystemInputs,
    lastSystemOutputs,
    makeId,
  } = params

  const inputs = recipeNodeData.inputs ?? []
  const outputs = recipeNodeData.outputs ?? []
  const recipeNode = allNodes.find((node) => node.id === nodeId)
  const position = recipeNode?.position ?? { x: 0, y: 0 }

  const missingInputs = inputs.filter((input) =>
    !allEdges.some(
      (edge) => edge.target === nodeId && edge.targetHandle === buildResourceId(input.category, input.id)
    )
  )
  const missingOutputs = outputs.filter((output) =>
    !allEdges.some(
      (edge) => edge.source === nodeId && edge.sourceHandle === buildResourceId(output.category, output.id)
    )
  )

  if (missingInputs.length === 0 && missingOutputs.length === 0) {
    return { nodesToAdd: [], edgesToAdd: [] }
  }

  const nodesToAdd: Node[] = []
  const edgesToAdd: Edge[] = []
  const spacing = 90
  const leftX = position.x - 300
  const rightX = position.x + 300

  const inputOffset = (missingInputs.length - 1) * spacing * 0.5
  missingInputs.forEach((input, index) => {
    const sourceId = makeId()
    const y = position.y + index * spacing - inputOffset
    const cachedAmount = lastSystemInputs[input.id]
    const handleId = buildResourceId(input.category, input.id)

    nodesToAdd.push({
      id: sourceId,
      type: 'sourceNode',
      position: { x: leftX, y },
      data: {
        mode: 'infinite',
        ports: [{ id: input.id, amount: cachedAmount ?? 9999, category: input.category, _uid: generateId() }],
      },
    })

    edgesToAdd.push({
      id: `e-${sourceId}-${input.id}-${nodeId}-${input.id}-${Date.now()}`,
      source: sourceId,
      sourceHandle: handleId,
      target: nodeId,
      targetHandle: handleId,
      type: 'default',
    })
  })

  const outputOffset = (missingOutputs.length - 1) * spacing * 0.5
  missingOutputs.forEach((output, index) => {
    const targetId = makeId()
    const y = position.y + index * spacing - outputOffset
    const cachedAmount = lastSystemOutputs[output.id]
    const handleId = buildResourceId(output.category, output.id)

    nodesToAdd.push({
      id: targetId,
      type: 'targetNode',
      position: { x: rightX, y },
      data: {
        mode: 'overflow',
        ports: [{ id: output.id, amount: cachedAmount ?? 0, category: output.category, _uid: generateId() }],
      },
    })

    edgesToAdd.push({
      id: `e-${nodeId}-${output.id}-${targetId}-${output.id}-${Date.now()}`,
      source: nodeId,
      sourceHandle: handleId,
      target: targetId,
      targetHandle: handleId,
      type: 'default',
    })
  })

  return { nodesToAdd, edgesToAdd }
}
