import { useLayoutEffect, useRef } from 'react'
import { useEdgesState, useNodesState, type Edge, type Node } from 'reactflow'

export function useCanvasState(initialNodes: Node[], initialEdges: Edge[]) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)

  useLayoutEffect(() => {
    nodesRef.current = nodes
    edgesRef.current = edges
  })

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
