import { useRef } from 'react'
import { useEdgesState, useNodesState, type Edge, type Node } from 'reactflow'

export function useCanvasState(initialNodes: Node<any>[], initialEdges: Edge[]) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Update refs synchronously during render so any callback that fires after
  // the render (e.g. handleCalculate triggered by a button click) always
  // reads the latest committed state rather than a stale snapshot.
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  const edgesRef = useRef(edges)
  edgesRef.current = edges

  return {
    nodes,
    setNodes,
    onNodesChange,
    edges,
    setEdges,
    onEdgesChange,
    nodesRef,
    edgesRef,
  }
}
