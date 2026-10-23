import { stripCalculationResults } from '@/common/utils/calculationState'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import type { NetworkConfiguration } from '@/common/schemas/network.schema'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import type { UnitSnapshot } from '@/common/types/units'
import type { GlobalResourceTableState } from '@/common/types/registry'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { normalizeGraph } from '@/features/canvas/graphDocument'
import { useState, useSyncExternalStore } from 'react'
import { createHistory } from '@/common/utils/history'
import type { Edge, Node } from 'reactflow'
import { deepClone, stripState } from '@/features/canvas/canvas.utils'

/** A snapshot of node/edge state for undo/redo history. */
type Snapshot = {
  nodes: Node[]
  edges: Edge[]
  networkConfiguration: NetworkConfiguration
  environment: UnitSnapshot
  registry: Pick<GlobalResourceTableState, 'categories' | 'overrides' | 'entries'>
}

/** Parameters for the `useUndoRedo` hook. */
type UseUndoRedoParams = {
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  historyLimit?: number
}

/**
 * Provides undo/redo history tracking for canvas node/edge state.
 *
 * @param root0 - Hook parameters.
 * @param root0.setNodes - State setter for nodes.
 * @param root0.setEdges - State setter for edges.
 * @param root0.historyLimit - Maximum number of snapshots kept in the undo stack (defaults to 20).
 * @returns An object with `takeSnapshot`, `undo` and `redo` functions.
 */
export function useUndoRedo({
  setNodes,
  setEdges,
  historyLimit = 20,
}: UseUndoRedoParams) {
  const [history] = useState(() => createHistory({
    capture: () => captureSnapshot(useCanvasStore.getState().nodes, useCanvasStore.getState().edges),
    restore: (snapshot: Snapshot) => {
      const canvas = useCanvasStore.getState()
      const selectedNodes = new Set(canvas.nodes.filter(node => node.selected).map(node => node.id))
      const selectedEdges = new Set(canvas.edges.filter(edge => edge.selected).map(edge => edge.id))
      restoreSnapshot(snapshot)
      setNodes(snapshot.nodes.map(node => ({ ...node, selected: selectedNodes.has(node.id) })))
      setEdges(snapshot.edges.map(edge => ({ ...edge, selected: selectedEdges.has(edge.id) })))
    },
    limit: historyLimit,
  }))
  useSyncExternalStore(history.subscribe, history.getRevision, history.getRevision)
  return { canUndo: history.canUndo(), canRedo: history.canRedo(), takeSnapshot: history.takeSnapshot,
    commitEdit: history.commit, clearHistory: history.clear, undo: history.undo, redo: history.redo }

}

/**
 * Capture editable recipes from their owner, not stale canvas node data.
 * @returns Cloned nodes enriched with authoritative editable recipes.
 * @param nodes - Canvas nodes.
 */
export function captureNodes(nodes: Node[]): Node[] {
  const recipes = useRecipeStore.getState().dumpAll()
  return stripState(deepClone(nodes.map((node) => node.type === 'recipeNode' ? { ...node, data: stripCalculationResults(recipes[node.id] ?? node.data) } : { ...node, data: stripCalculationResults(node.data) }))) as Node[]
}

/**
 * Atomically replace recipe identities when restoring a graph snapshot.
 * @param nodes - Canvas nodes.
 */
export function restoreRecipes(nodes: Node[]): void {
  const graph = normalizeGraph(nodes, [])
  useRecipeStore.setState({ recipes: {} })
  useRecipeStore.getState().loadAll(graph.recipes)
}

/** Capture graph data and the environment that gives quantities their meaning.
 * @param nodes - Current graph nodes.
 * @param edges - Current graph edges.
 * @returns Independent document snapshot.
 */
export function captureSnapshot(nodes: Node[], edges: Edge[]): Snapshot {
  const { categories, overrides, entries } = useGlobalResourceTable.getState()
  return { nodes: captureNodes(nodes), edges: stripState(deepClone(edges)) as Edge[],
    networkConfiguration: structuredClone(useCanvasStore.getState().networkConfiguration),
    environment: structuredClone(useSettingsStore.getState().units),
    registry: structuredClone({ categories, overrides, entries }) }
}

/** Restore the environment before compiling the restored recipes.
 * @param snapshot - Complete historical document.
 */
export function restoreSnapshot(snapshot: Snapshot): void {
  useCanvasStore.getState().setNetworkConfiguration(structuredClone(snapshot.networkConfiguration))
  useCanvasStore.getState().invalidateCalculation()
  useRecipeStore.setState({ recipes: {} })
  useGlobalResourceTable.getState().restore(structuredClone(snapshot.registry))
  useSettingsStore.getState().setEnvironment(snapshot.environment)
  restoreRecipes(snapshot.nodes)
}
