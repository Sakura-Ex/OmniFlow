import { configureEndpointPorts } from '@/features/calculation/endpointConfiguration'
import { emptyNetworkConfiguration, type NetworkConfiguration } from '@/common/schemas/network.schema'
import { useSettingsStore } from '@/features/settings/settings.store'
import type { UnitSnapshot } from '@/common/types/units'
import { normalizeGraph } from '@/features/canvas/graphDocument'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useLayoutEffect, useRef, useCallback } from 'react'
import { applyNodeChanges, applyEdgeChanges, type Edge, type Node, type NodeChange, type EdgeChange } from 'reactflow'
import { useCanvasStore } from '@/features/canvas/canvas.store'

/**
 * Manages React Flow node/edge state and synchronises it with the canvas store.
 *
 * @param initialNodes  Nodes to seed the store with on first render.
 * @param initialEdges  Edges to seed the store with on first render.
 * @param initialConfiguration - Explicit starter policies, without implicit external supply.
 * @param initialEnvironment - Unit definitions belonging to the starter document.
 * @returns An object containing the current `nodes`, `edges`, their setters,
 *          React Flow-compatible change handlers (`onNodesChange`,
 *          `onEdgesChange`), and mutable refs (`nodesRef`, `edgesRef`).
 */
export function useCanvasState(initialNodes: Node[], initialEdges: Edge[], initialConfiguration?: NetworkConfiguration, initialEnvironment?: UnitSnapshot) {
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
    if (initialEnvironment) useSettingsStore.getState().setEnvironment(initialEnvironment)
    const graph = normalizeGraph(initialNodes, initialEdges, {}, true)
    useRecipeStore.getState().loadAll(graph.recipes)
    setNodes(graph.nodes)
    setEdges(graph.edges)
    useCanvasStore.getState().setNetworkConfiguration(graph.nodes.reduce((configuration, node) => configureEndpointPorts(configuration, node, useSettingsStore.getState().units), initialConfiguration ?? emptyNetworkConfiguration()))
    nodesRef.current = graph.nodes
    edgesRef.current = graph.edges
    initRef.current = true
  }, [initialNodes, initialEdges, initialConfiguration, initialEnvironment, setNodes, setEdges])

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
