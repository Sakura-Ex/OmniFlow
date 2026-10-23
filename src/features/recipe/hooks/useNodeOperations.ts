import { configureEndpointPorts } from '@/features/calculation/endpointConfiguration'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import { useCanvasStore } from '@/features/canvas/canvas.store'
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
  ) => {
    takeSnapshot()
    useCanvasStore.getState().updateNodeData(nodeId, nextData)
  }, [takeSnapshot])

  const fillNodes = useCallback((ids: string[]) => {
    let nextNodes = nodesRef.current, nextEdges = edgesRef.current
    let configuration = useCanvasStore.getState().networkConfiguration
    const environment = useSettingsStore.getState().units
    for (const nodeId of ids) {
      const recipeNode = nextNodes.find(node => node.id === nodeId)
      if (!recipeNode || recipeNode.type !== 'recipeNode') continue
      const result = computeAutoFillEndpoints({ nodeId, configuration,
        recipeNodeData: useRecipeStore.getState().recipes[nodeId] ?? recipeNode.data as RecipeNodeData,
        environment, allNodes: nextNodes, allEdges: nextEdges, lastSystemInputs, lastSystemOutputs, makeId })
      if (!result.nodesToAdd.length && !result.edgesToAdd.length) continue
      nextNodes = [...nextNodes, ...result.nodesToAdd]
      nextEdges = [...nextEdges, ...result.edgesToAdd]
      configuration = result.nodesToAdd.reduce((current, node) => configureEndpointPorts(current, node, environment), configuration)
    }
    if (nextNodes === nodesRef.current && nextEdges === edgesRef.current) return
    takeSnapshot()
    setNodes(nextNodes)
    useCanvasStore.getState().setNetworkConfiguration(configuration)
    setEdges(nextEdges)
    nodesRef.current = nextNodes
    edgesRef.current = nextEdges
  }, [nodesRef, edgesRef, setNodes, setEdges, takeSnapshot, lastSystemInputs, lastSystemOutputs])
  const autoFillEndpoints = useCallback((nodeId: string) => fillNodes([nodeId]), [fillNodes])
  const handleAutoFillSelected = useCallback(() => {
    fillNodes(nodesRef.current.filter(node => node.selected && node.type === 'recipeNode').map(node => node.id))
  }, [nodesRef, fillNodes])

  return { updateNodeData, autoFillEndpoints, handleAutoFillSelected }
}
