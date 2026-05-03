import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData } from '../types/recipe'

export type HandleUpdate = {
  role: 'source' | 'target'
  previousId: string
  nextId: string
}

function makeId() {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function edgeStyleForPort(portType?: string) {
  const isFluid = portType === 'fluid'
  return {
    className: isFluid ? 'custom-edge-fluid' : 'custom-edge-item',
    stroke: isFluid ? '#4ddcff' : '#e5e7eb',
  }
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
    nextData: Record<string, any>,
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
        mergedData = {
          ...mergedData,
          is_auto: nextIsAuto,
          actual_amount: nextIsAuto
            ? (currentData.actual_amount ?? lastSystemInputs[mergedData.id])
            : currentData.actual_amount,
        }
      } else if (currentNode.type === 'targetNode') {
        mergedData = {
          ...mergedData,
          is_auto: nextIsAuto,
          actual_amount: nextIsAuto
            ? (currentData.actual_amount ?? lastSystemOutputs[mergedData.id])
            : currentData.actual_amount,
        }
      } else if (currentNode.type === 'recipeNode') {
        mergedData = { ...mergedData, is_auto: nextIsAuto }
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
      const nextEdges = edgesRef.current.map((edge) => {
        if (
          handleUpdate.role === 'source' &&
          edge.source === nodeId &&
          edge.sourceHandle === handleUpdate.previousId
        ) {
          return { ...edge, sourceHandle: handleUpdate.nextId }
        }
        if (
          handleUpdate.role === 'target' &&
          edge.target === nodeId &&
          edge.targetHandle === handleUpdate.previousId
        ) {
          return { ...edge, targetHandle: handleUpdate.nextId }
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
    const position = recipeNode.position ?? { x: 0, y: 0 }

    const missingInputs = inputs.filter((input) =>
      !edgesRef.current.some(
        (edge) => edge.target === nodeId && edge.targetHandle === input.id
      )
    )
    const missingOutputs = outputs.filter((output) =>
      !edgesRef.current.some(
        (edge) => edge.source === nodeId && edge.sourceHandle === output.id
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
        },
      })

      const style = edgeStyleForPort(input.category ?? (input as any).type)
      edgesToAdd.push({
        id: `e-${sourceId}-${input.id}-${nodeId}-${input.id}-${Date.now()}`,
        source: sourceId,
        sourceHandle: input.id,
        target: nodeId,
        targetHandle: input.id,
        type: 'default',
        className: style.className,
        style: { stroke: style.stroke, strokeWidth: 2 },
      })
    })

    const outputOffset = (missingOutputs.length - 1) * spacing * 0.5
    missingOutputs.forEach((output, index) => {
      const targetId = makeId()
      const y = position.y + index * spacing - outputOffset
      const cachedAmount = lastSystemOutputs[output.id]

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
        },
      })

      const style = edgeStyleForPort(output.category ?? (output as any).type)
      edgesToAdd.push({
        id: `e-${nodeId}-${output.id}-${targetId}-${output.id}-${Date.now()}`,
        source: nodeId,
        sourceHandle: output.id,
        target: targetId,
        targetHandle: output.id,
        type: 'default',
        className: style.className,
        style: { stroke: style.stroke, strokeWidth: 2 },
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
