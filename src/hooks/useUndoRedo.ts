import { useCallback, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { Edge, Node } from 'reactflow'

type Snapshot = {
  nodes: Node[]
  edges: Edge[]
}

type UseUndoRedoParams = {
  nodesRef: MutableRefObject<Node[]>
  edgesRef: MutableRefObject<Edge[]>
  setNodes: Dispatch<SetStateAction<Node[]>>
  setEdges: Dispatch<SetStateAction<Edge[]>>
  historyLimit?: number
}

function stripState<T extends { selected?: boolean; dragging?: boolean }>(items: T[]) {
  return items.map((item) => {
    const { selected, dragging, ...rest } = item
    return rest as T
  })
}

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
    setPast((p) => {
      const currentNodes = stripState(JSON.parse(JSON.stringify(nodesRef.current)))
      const currentEdges = stripState(JSON.parse(JSON.stringify(edgesRef.current)))

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
    setPast((p) => p.slice(0, -1))

    setFuture((f) => [
      {
        nodes: stripState(JSON.parse(JSON.stringify(nodesRef.current))),
        edges: stripState(JSON.parse(JSON.stringify(edgesRef.current))),
      },
      ...f,
    ])

    const selectedNodeIds = new Set(nodesRef.current.filter((n) => n.selected).map((n) => n.id))
    const selectedEdgeIds = new Set(edgesRef.current.filter((e) => e.selected).map((e) => e.id))

    setNodes(previous.nodes.map((n) => ({ ...n, selected: selectedNodeIds.has(n.id) })))
    setEdges(previous.edges.map((e) => ({ ...e, selected: selectedEdgeIds.has(e.id) })))
  }, [edgesRef, nodesRef, past, setEdges, setNodes])

  const redo = useCallback(() => {
    if (future.length === 0) return
    const next = future[0]
    setFuture((f) => f.slice(1))

    setPast((p) => [
      ...p,
      {
        nodes: stripState(JSON.parse(JSON.stringify(nodesRef.current))),
        edges: stripState(JSON.parse(JSON.stringify(edgesRef.current))),
      },
    ])

    const selectedNodeIds = new Set(nodesRef.current.filter((n) => n.selected).map((n) => n.id))
    const selectedEdgeIds = new Set(edgesRef.current.filter((e) => e.selected).map((e) => e.id))

    setNodes(next.nodes.map((n) => ({ ...n, selected: selectedNodeIds.has(n.id) })))
    setEdges(next.edges.map((e) => ({ ...e, selected: selectedEdgeIds.has(e.id) })))
  }, [edgesRef, future, nodesRef, setEdges, setNodes])

  return {
    takeSnapshot,
    undo,
    redo,
  }
}
