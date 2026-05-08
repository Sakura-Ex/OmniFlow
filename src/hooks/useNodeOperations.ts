import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData, EndpointPort } from '../types/recipe'
import { useRecipeStore } from '../stores/recipeStore'

export type HandleUpdate = {
  role: 'source' | 'target'
  previousId: string
  nextId: string
}

function makeId() {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

type UseNodeOperationsParams = {
  nodesRef: MutableRefObject<Node[]>
  edgesRef: MutableRefObject<Edge[]>
  setNodes: Dispatch<SetStateAction<Node[]>>
  setEdges: Dispatch<SetStateAction<Edge[]>>
  takeSnapshot: () => void
  lastSystemInputs: Record<string, number>
  lastSystemOutputs: Record<string, number>
}

export function useNodeOperations({
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  takeSnapshot,
  lastSystemInputs,
  lastSystemOutputs,
}: UseNodeOperationsParams) {
  const updateNodeData = useCallback((
    nodeId: string,
    nextData: Record<string, unknown>,
    handleUpdate?: HandleUpdate,
  ) => {
    const currentNode = nodesRef.current.find((n) => n.id === nodeId)
    if (!currentNode) return

    const currentData = currentNode.data ?? {}
    let mergedData = { ...currentData, ...nextData }

    const nextIsAuto = typeof mergedData.is_auto === 'boolean'
      ? mergedData.is_auto
      : typeof mergedData.is_virtual === 'boolean'
        ? mergedData.is_virtual
        : undefined

    if (typeof nextIsAuto === 'boolean') {
      if (currentNode.type === 'sourceNode') {
        const ports: EndpointPort[] = currentNode.data?.ports ?? []
        const actualAmounts: Record<string, number> = { ...currentNode.data?.actual_amounts }
        for (const port of ports) {
          if (port.id) {
            actualAmounts[port.id] = nextIsAuto
              ? (currentNode.data?.actual_amounts?.[port.id] ?? lastSystemInputs[port.id])
              : (currentNode.data?.actual_amounts?.[port.id])
          }
        }
        mergedData = {
          ...mergedData,
          is_auto: nextIsAuto,
          actual_amounts: actualAmounts,
        }
      } else if (currentNode.type === 'targetNode') {
        const ports: EndpointPort[] = currentNode.data?.ports ?? []
        const actualAmounts: Record<string, number> = { ...currentNode.data?.actual_amounts }
        for (const port of ports) {
          if (port.id) {
            actualAmounts[port.id] = nextIsAuto
              ? (currentNode.data?.actual_amounts?.[port.id] ?? lastSystemOutputs[port.id])
              : (currentNode.data?.actual_amounts?.[port.id])
          }
        }
        mergedData = {
          ...mergedData,
          is_auto: nextIsAuto,
          actual_amounts: actualAmounts,
        }
      } else if (currentNode.type === 'recipeNode') {
        mergedData = { ...mergedData, is_auto: nextIsAuto }
        useRecipeStore.getState().updateRecipe(nodeId, nextData)
      }
    }

    const dataChanged = Object.keys(mergedData).some((key) => currentData[key] !== mergedData[key])
    const handleChanged = !!(handleUpdate && handleUpdate.previousId !== handleUpdate.nextId)

    if (!dataChanged && !handleChanged) return

    takeSnapshot()
    const nextNodes = nodesRef.current.map((node) =>
      node.id === nodeId ? { ...node, data: mergedData } : node
    )
    setNodes(nextNodes)
    nodesRef.current = nextNodes

    if (handleChanged && handleUpdate) {
      const currentNode = nodesRef.current.find((n) => n.id === nodeId)
      const nodeCategory: string = currentNode?.data?.category ?? 'item'
      const ports: EndpointPort[] = currentNode?.data?.ports ?? []
      const oldPort = ports.find((p) => p.id === handleUpdate.previousId)
      const portCategory = oldPort?.category ?? nodeCategory
      const prevHandle = `${portCategory}:${handleUpdate.previousId}`
      const nextHandle = `${portCategory}:${handleUpdate.nextId}`
      const nextEdges = edgesRef.current.map((edge) => {
        if (
          handleUpdate.role === 'source' &&
          edge.source === nodeId &&
          edge.sourceHandle === prevHandle
        ) {
          return { ...edge, sourceHandle: nextHandle }
        }
        if (
          handleUpdate.role === 'target' &&
          edge.target === nodeId &&
          edge.targetHandle === prevHandle
        ) {
          return { ...edge, targetHandle: nextHandle }
        }
        return edge
      })
      setEdges(nextEdges)
      edgesRef.current = nextEdges
    }
  }, [nodesRef, edgesRef, setNodes, setEdges, takeSnapshot, lastSystemInputs, lastSystemOutputs])

  const autoFillEndpoints = useCallback((nodeId: string) => {
    const recipeNode = nodesRef.current.find((node) => node.id === nodeId)
    if (!recipeNode || recipeNode.type !== 'recipeNode') return

    const data = recipeNode.data as RecipeNodeData
    const inputs = data.inputs ?? []
    const outputs = data.outputs ?? []
    const baseInputs = data.base_inputs ?? data.inputs ?? []
    const baseOutputs = data.base_outputs ?? data.outputs ?? []
    const position = recipeNode.position ?? { x: 0, y: 0 }

    const inputCategoryMap = new Map<string, string>()
    for (const inp of baseInputs) {
      if (inp.id) inputCategoryMap.set(inp.id, inp.category ?? 'item')
    }
    for (const inp of data.base_utility_inputs ?? []) {
      if (inp.id) inputCategoryMap.set(inp.id, inp.category ?? 'item')
    }
    const outputCategoryMap = new Map<string, string>()
    for (const out of baseOutputs) {
      if (out.id) outputCategoryMap.set(out.id, out.category ?? 'item')
    }
    for (const out of data.base_utility_outputs ?? []) {
      if (out.id) outputCategoryMap.set(out.id, out.category ?? 'item')
    }

    const missingInputs = inputs.filter((input) =>
      !edgesRef.current.some(
        (edge) => edge.target === nodeId && edge.targetHandle === `${inputCategoryMap.get(input.id) ?? 'item'}:${input.id}`
      )
    )
    const missingOutputs = outputs.filter((output) =>
      !edgesRef.current.some(
        (edge) => edge.source === nodeId && edge.sourceHandle === `${outputCategoryMap.get(output.id) ?? 'item'}:${output.id}`
      )
    )

    if (missingInputs.length === 0 && missingOutputs.length === 0) return

    takeSnapshot()

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
      const handleId = `${cat}:${input.id}`

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
      const handleId = `${cat}:${output.id}`

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

    const nextNodes = [...nodesRef.current, ...nodesToAdd]
    const nextEdges = [...edgesRef.current, ...edgesToAdd]
    setNodes(nextNodes)
    setEdges(nextEdges)
    nodesRef.current = nextNodes
    edgesRef.current = nextEdges
  }, [nodesRef, edgesRef, setNodes, setEdges, takeSnapshot, lastSystemInputs, lastSystemOutputs])

  const handleAutoFillSelected = useCallback(() => {
    const selected = nodesRef.current.filter((node) => node.selected && node.type === 'recipeNode')
    if (selected.length === 0) return
    selected.forEach((node) => autoFillEndpoints(node.id))
  }, [nodesRef, autoFillEndpoints])

  return { updateNodeData, autoFillEndpoints, handleAutoFillSelected }
}
