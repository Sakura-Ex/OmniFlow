import type { Node, Edge } from 'reactflow'
import type { RecipeNodeData } from '../../types/recipe'
import { buildResourceId } from '../../utils/resourceIdentifier'

export type ComputeAutoFillParams = {
  nodeId: string
  recipeNodeData: RecipeNodeData
  allNodes: Node[]
  allEdges: Edge[]
  lastSystemInputs: Record<string, number>
  lastSystemOutputs: Record<string, number>
  makeId: () => string
}

export type AutoFillResult = {
  nodesToAdd: Node[]
  edgesToAdd: Edge[]
}

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
  const baseInputs = recipeNodeData.base_inputs ?? recipeNodeData.inputs ?? []
  const baseOutputs = recipeNodeData.base_outputs ?? recipeNodeData.outputs ?? []
  const recipeNode = allNodes.find((node) => node.id === nodeId)
  const position = recipeNode?.position ?? { x: 0, y: 0 }

  const inputCategoryMap = new Map<string, string>()
  for (const inp of baseInputs) {
    if (inp.id) inputCategoryMap.set(inp.id, inp.category ?? 'item')
  }
  for (const inp of recipeNodeData.base_utility_inputs ?? []) {
    if (inp.id) inputCategoryMap.set(inp.id, inp.category ?? 'item')
  }
  const outputCategoryMap = new Map<string, string>()
  for (const out of baseOutputs) {
    if (out.id) outputCategoryMap.set(out.id, out.category ?? 'item')
  }
  for (const out of recipeNodeData.base_utility_outputs ?? []) {
    if (out.id) outputCategoryMap.set(out.id, out.category ?? 'item')
  }

  const missingInputs = inputs.filter((input) =>
    !allEdges.some(
      (edge) => edge.target === nodeId && edge.targetHandle === buildResourceId(inputCategoryMap.get(input.id) ?? 'item', input.id)
    )
  )
  const missingOutputs = outputs.filter((output) =>
    !allEdges.some(
      (edge) => edge.source === nodeId && edge.sourceHandle === buildResourceId(outputCategoryMap.get(output.id) ?? 'item', output.id)
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
    const cat = inputCategoryMap.get(input.id) ?? 'item'
    const handleId = buildResourceId(cat, input.id)

    nodesToAdd.push({
      id: sourceId,
      type: 'sourceNode',
      position: { x: leftX, y },
      data: {
        id: input.id,
        label: input.id,
        amount: cachedAmount ?? 9999,
        is_auto: true,
        actual_amount: cachedAmount,
        category: cat,
        ports: [{ id: input.id, amount: cachedAmount ?? 9999, category: cat, _uid: crypto.randomUUID() }],
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
    const cat = outputCategoryMap.get(output.id) ?? 'item'
    const handleId = buildResourceId(cat, output.id)

    nodesToAdd.push({
      id: targetId,
      type: 'targetNode',
      position: { x: rightX, y },
      data: {
        id: output.id,
        label: output.id,
        amount: cachedAmount ?? 0,
        mode: 'overflow',
        is_auto: true,
        actual_amount: cachedAmount,
        category: cat,
        ports: [{ id: output.id, amount: cachedAmount ?? 0, category: cat, _uid: crypto.randomUUID() }],
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
