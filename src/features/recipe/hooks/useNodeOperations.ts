import { useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import { useCanvasStore, type HandleUpdate } from '@/features/canvas/canvas.store'
import { computeAutoFillEndpoints } from '@/features/calculation/autoFillEndpoints'

/** Parameters for the `useNodeOperations` hook. */
type UseNodeOperationsParams = {
  nodesRef: MutableRefObject<Node[]>
  edgesRef: MutableRefObject<Edge[]>
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  takeSnapshot: () => void
  lastSystemInputs: Record<string, number>
  lastSystemOutputs: Record<string, number>
}

/**
 * Generate a unique node identifier.
 * @returns A unique node ID string.
 */
function makeId() {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Provides utility actions for updating recipe node data and auto-filling endpoints.
 *
 * @param root0 - Hook parameters.
 * @param root0.nodesRef - Mutable ref holding the current node array.
 * @param root0.edgesRef - Mutable ref holding the current edge array.
 * @param root0.setNodes - State setter for nodes.
 * @param root0.setEdges - State setter for edges.
 * @param root0.takeSnapshot - Pushes the current state onto the undo stack.
 * @param root0.lastSystemInputs - Last computed system input rates.
 * @param root0.lastSystemOutputs - Last computed system output rates.
 * @returns An object containing:
 *  - `updateNodeData` - apply a partial data patch to a node and take a snapshot.
 *  - `autoFillEndpoints` - compute and add missing source/target endpoints for a recipe node.
 *  - `handleAutoFillSelected` - run `autoFillEndpoints` on every currently-selected recipe node.
 */
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
