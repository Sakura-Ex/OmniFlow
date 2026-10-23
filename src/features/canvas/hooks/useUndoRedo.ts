import { useRecipeStore } from '@/features/recipe/recipe.store'
import { normalizeGraph } from '@/features/canvas/graphDocument'
import { useCallback, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { Edge, Node } from 'reactflow'
import { deepClone, stripState } from '@/features/canvas/canvas.utils'

/** A snapshot of node/edge state for undo/redo history. */
type Snapshot = {
  nodes: Node[]
  edges: Edge[]
}

/** Parameters for the `useUndoRedo` hook. */
type UseUndoRedoParams = {
  nodesRef: MutableRefObject<Node[]>
  edgesRef: MutableRefObject<Edge[]>
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  historyLimit?: number
}

/**
 * Provides undo/redo history tracking for canvas node/edge state.
 *
 * @param root0 - Hook parameters.
 * @param root0.nodesRef - Mutable ref holding the current node array.
 * @param root0.edgesRef - Mutable ref holding the current edge array.
 * @param root0.setNodes - State setter for nodes.
 * @param root0.setEdges - State setter for edges.
 * @param root0.historyLimit - Maximum number of snapshots kept in the undo stack (defaults to 20).
 * @returns An object with `takeSnapshot`, `undo` and `redo` functions.
 */
export function useUndoRedo({
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  historyLimit = 20,
}: UseUndoRedoParams) {
  const [past, setPast] = useState<Snapshot[]>([])
  const [future, setFuture] = useState<Snapshot[]>([])

  const takeSnapshot = useCallback(() => {
    const currentNodes = captureNodes(nodesRef.current)
    const currentEdges = stripState(deepClone(edgesRef.current)) as Edge[]
    setPast((p) => {

      if (p.length > 0) {
        const last = p[p.length - 1]
        if (
          JSON.stringify(last.nodes) === JSON.stringify(currentNodes) &&
          JSON.stringify(last.edges) === JSON.stringify(currentEdges)
        ) {
          return p
        }
      }

      setFuture([])
      return [...p.slice(-(historyLimit - 1)), { nodes: currentNodes, edges: currentEdges }]
    })
  }, [edgesRef, historyLimit, nodesRef])

  const undo = useCallback(() => {
    if (past.length === 0) return
    const previous = past[past.length - 1]
    const current = {
      nodes: captureNodes(nodesRef.current),
      edges: stripState(deepClone(edgesRef.current)) as Edge[],
    }
    setPast((p) => p.slice(0, -1))
    setFuture((f) => [current, ...f])

    const selectedNodeIds = new Set(nodesRef.current.filter((n) => n.selected).map((n) => n.id))
    const selectedEdgeIds = new Set(edgesRef.current.filter((e) => e.selected).map((e) => e.id))

    restoreRecipes(previous.nodes)
    setNodes(previous.nodes.map((n) => ({ ...n, selected: selectedNodeIds.has(n.id) })))
    setEdges(previous.edges.map((e) => ({ ...e, selected: selectedEdgeIds.has(e.id) })))
  }, [edgesRef, nodesRef, past, setEdges, setNodes])

  const redo = useCallback(() => {
    if (future.length === 0) return
    const next = future[0]
    const current = {
      nodes: captureNodes(nodesRef.current),
      edges: stripState(deepClone(edgesRef.current)) as Edge[],
    }
    setFuture((f) => f.slice(1))
    setPast((p) => [...p, current])

    const selectedNodeIds = new Set(nodesRef.current.filter((n) => n.selected).map((n) => n.id))
    const selectedEdgeIds = new Set(edgesRef.current.filter((e) => e.selected).map((e) => e.id))

    restoreRecipes(next.nodes)
    setNodes(next.nodes.map((n) => ({ ...n, selected: selectedNodeIds.has(n.id) })))
    setEdges(next.edges.map((e) => ({ ...e, selected: selectedEdgeIds.has(e.id) })))
  }, [edgesRef, future, nodesRef, setEdges, setNodes])

  return {
    takeSnapshot,
    undo,
    redo,
  }
}

/**
 * Capture editable recipes from their owner, not stale canvas node data.
 * @returns Cloned nodes enriched with authoritative editable recipes.
 * @param nodes - Canvas nodes.
 */
export function captureNodes(nodes: Node[]): Node[] {
  const recipes = useRecipeStore.getState().dumpAll()
  return stripState(deepClone(nodes.map((node) => node.type === 'recipeNode' ? { ...node, data: recipes[node.id] ?? node.data } : node))) as Node[]
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
