import type { Node, Edge } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import { portIdentity } from '@/common/utils/ports'
import { buildResourceId } from '@/common/utils/resourceId'
import { UnitSystem } from '@/common/units/UnitSystem'
import { runModifierPipeline } from '@/features/modifier/modifier.pipeline'
import type { UnitSnapshot } from '@/common/types/units'
import { defaultResourceUnit, DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'
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
  environment?: UnitSnapshot
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

  const units = new UnitSystem(params.environment ?? DEFAULT_UNIT_SNAPSHOT)
  const computed = runModifierPipeline(recipeNodeData, params.environment ?? DEFAULT_UNIT_SNAPSHOT)
  const inputs = [...computed.recipe_inputs, ...computed.utility_inputs].filter((p) => p.routing_mode !== 'global')
  const outputs = [...computed.recipe_outputs, ...computed.utility_outputs].filter((p) => p.routing_mode !== 'global')
  const recipeNode = allNodes.find((node) => node.id === nodeId)
  const position = recipeNode?.position ?? { x: 0, y: 0 }

  const missingInputs = inputs.filter((input) =>
    !allEdges.some(
      (edge) => edge.target === nodeId && edge.targetHandle === portIdentity(input)
    )
  )
  const missingOutputs = outputs.filter((output) =>
    !allEdges.some(
      (edge) => edge.source === nodeId && edge.sourceHandle === portIdentity(output)
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
    const cachedAmount = lastSystemInputs[buildResourceId(input.category, input.id)]
    const handleId = portIdentity(input)
    const endpointPortId = generateId()

    nodesToAdd.push({
      id: sourceId,
      type: 'sourceNode',
      position: { x: leftX, y },
      data: {
        mode: 'infinite',
        ports: [{ id: input.id, amount: cachedAmount === undefined ? 9999 : units.fromRate(cachedAmount, input.unit ?? defaultResourceUnit(input.category, input.id), 'rate_per_sec'), unit: input.unit, displayUnit: input.displayUnit, category: input.category, portId: endpointPortId, _uid: generateId() }],
      },
    })

    edgesToAdd.push({
      id: `e-${sourceId}-${input.id}-${nodeId}-${input.id}-${Date.now()}`,
      source: sourceId,
      sourceHandle: endpointPortId,
      target: nodeId,
      targetHandle: handleId,
      type: 'default',
    })
  })

  const outputOffset = (missingOutputs.length - 1) * spacing * 0.5
  missingOutputs.forEach((output, index) => {
    const targetId = makeId()
    const y = position.y + index * spacing - outputOffset
    const cachedAmount = lastSystemOutputs[buildResourceId(output.category, output.id)]
    const handleId = portIdentity(output)
    const endpointPortId = generateId()

    nodesToAdd.push({
      id: targetId,
      type: 'targetNode',
      position: { x: rightX, y },
      data: {
        mode: 'overflow',
        ports: [{ id: output.id, amount: cachedAmount === undefined ? 0 : units.fromRate(cachedAmount, output.unit ?? defaultResourceUnit(output.category, output.id), 'rate_per_sec'), unit: output.unit, displayUnit: output.displayUnit, category: output.category, portId: endpointPortId, _uid: generateId() }],
      },
    })

    edgesToAdd.push({
      id: `e-${nodeId}-${output.id}-${targetId}-${output.id}-${Date.now()}`,
      source: nodeId,
      sourceHandle: handleId,
      target: targetId,
      targetHandle: endpointPortId,
      type: 'default',
    })
  })

  return { nodesToAdd, edgesToAdd }
}
