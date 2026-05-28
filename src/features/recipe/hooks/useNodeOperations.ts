import { useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import { useCanvasStore, type HandleUpdate } from '@/features/canvas/canvas.store'
import { computeAutoFillEndpoints } from '@/features/calculation/autoFillEndpoints'

type UseNodeOperationsParams = {
  nodesRef: MutableRefObject<Node[]>
  edgesRef: MutableRefObject<Edge[]>
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  takeSnapshot: () => void
  lastSystemInputs: Record<string, number>
  lastSystemOutputs: Record<string, number>
}

function makeId() {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
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
    takeSnapshot()
    useCanvasStore.getState().updateNodeData(nodeId, nextData, handleUpdate)
  }, [takeSnapshot])

  const autoFillEndpoints = useCallback((nodeId: string) => {
    const recipeNode = nodesRef.current.find((node) => node.id === nodeId)
    if (!recipeNode || recipeNode.type !== 'recipeNode') return

    const result = computeAutoFillEndpoints({
      nodeId,
      recipeNodeData: recipeNode.data as RecipeNodeData,
      allNodes: nodesRef.current,
      allEdges: edgesRef.current,
      lastSystemInputs,
      lastSystemOutputs,
      makeId,
    })

    if (result.nodesToAdd.length === 0 && result.edgesToAdd.length === 0) return

    takeSnapshot()

    const nextNodes = [...nodesRef.current, ...result.nodesToAdd]
    const nextEdges = [...edgesRef.current, ...result.edgesToAdd]
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
