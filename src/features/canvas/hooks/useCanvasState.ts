import { useLayoutEffect, useRef, useCallback } from 'react'
import { applyNodeChanges, applyEdgeChanges, type Edge, type Node, type NodeChange, type EdgeChange } from 'reactflow'
import { useCanvasStore } from '@/features/canvas/canvas.store'

export function useCanvasState(initialNodes: Node[], initialEdges: Edge[]) {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const setNodes = useCanvasStore((s) => s.setNodes)
  const setEdges = useCanvasStore((s) => s.setEdges)

  const nodesRef = useRef(nodes.length > 0 ? nodes : initialNodes)
  const edgesRef = useRef(edges.length > 0 ? edges : initialEdges)

  useLayoutEffect(() => {
    nodesRef.current = nodes
    edgesRef.current = edges
  }, [nodes, edges])

  const initRef = useRef(false)
  useLayoutEffect(() => {
    if (initRef.current) return
    setNodes(initialNodes)
    setEdges(initialEdges)
    nodesRef.current = initialNodes
    edgesRef.current = initialEdges
    initRef.current = true
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(applyNodeChanges(changes, nodesRef.current))
  }, [setNodes])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(applyEdgeChanges(changes, edgesRef.current))
  }, [setEdges])

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
