import { useCallback } from 'react'
import type { MouseEvent } from 'react'
import { addEdge, type Connection, type Edge, type Node } from 'reactflow'
import type { RecipeNodeData } from '../types/recipe'
import { useCanvasStore } from '../stores/canvasStore'
import { DEFAULT_RESOURCE_CATEGORY } from '../utils/resourceIdentifier'

type UseCanvasOperationsParams = {
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  takeSnapshot: () => void
  getViewportCenter: () => { x: number; y: number }
}

function makeId() {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function useCanvasOperations({
  setNodes,
  setEdges,
  takeSnapshot,
  getViewportCenter,
}: UseCanvasOperationsParams) {
  const isValidConnection = useCallback((connection: Connection) => {
    return connection.sourceHandle === connection.targetHandle
      && typeof connection.sourceHandle === 'string'
      && connection.sourceHandle.length > 0
  }, [])

  const onConnect = useCallback((params: Connection) => {
    takeSnapshot()
    const edge: Edge = {
      id: `e-${params.source}-${params.sourceHandle || ''}-${params.target}-${params.targetHandle || ''}-${Date.now()}`,
      source: params.source!,
      sourceHandle: params.sourceHandle,
      target: params.target!,
      targetHandle: params.targetHandle,
      type: 'default',
    }
    setEdges(addEdge(edge, useCanvasStore.getState().edges))
  }, [setEdges, takeSnapshot])

  const onEdgeDoubleClick = useCallback((_: MouseEvent, edge: Edge) => {
    takeSnapshot()
    setEdges(useCanvasStore.getState().edges.filter((e) => e.id !== edge.id))
  }, [setEdges, takeSnapshot])

  const handleAddSource = useCallback(() => {
    takeSnapshot()
    const id = makeId()
    const center = getViewportCenter()
    const newNode: Node = {
      id,
      type: 'sourceNode',
      position: { x: center.x + (Math.random() - 0.5) * 100, y: center.y + (Math.random() - 0.5) * 100 },
      data: { id: `item_${id.slice(-4)}`, label: `item_${id.slice(-4)}`, amount: 100, is_auto: true, category: DEFAULT_RESOURCE_CATEGORY },
    }
    useCanvasStore.getState().addNode(newNode)
  }, [takeSnapshot, getViewportCenter])

  const handleAddFurnace = useCallback(() => {
    takeSnapshot()
    const id = makeId()
    const center = getViewportCenter()
    const nodeData: RecipeNodeData = {
      recipe_id: `recipe_${id}`,
      machine_name: 'Generic Machine',
      system: 'gregtech',
      inputs: [],
      outputs: [],
      duration_seconds: 5,
      mode: 'auto',
      metadata: { eu_per_tick: 32, can_overclock: true },
    }
    const newNode: Node<RecipeNodeData> = {
      id,
      type: 'recipeNode',
      position: { x: center.x + (Math.random() - 0.5) * 100, y: center.y + (Math.random() - 0.5) * 100 },
      data: nodeData,
    }
    useCanvasStore.getState().addRecipeNode(id, nodeData, newNode)
  }, [takeSnapshot, getViewportCenter])

  const handleAddCustomRecipe = useCallback(() => {
    takeSnapshot()
    const id = makeId()
    const center = getViewportCenter()
    const nodeData: RecipeNodeData = {
      recipe_id: `custom_${id}`,
      machine_name: 'Custom Machine',
      system: 'custom',
      inputs: [],
      outputs: [],
      duration_seconds: 0,
      mode: 'auto',
      metadata: {},
    }
    const newNode: Node<RecipeNodeData> = {
      id,
      type: 'recipeNode',
      position: { x: center.x + (Math.random() - 0.5) * 100, y: center.y + (Math.random() - 0.5) * 100 },
      data: nodeData,
    }
    useCanvasStore.getState().addRecipeNode(id, nodeData, newNode)
  }, [takeSnapshot, getViewportCenter])

  const handleAddTarget = useCallback(() => {
    takeSnapshot()
    const id = makeId()
    const center = getViewportCenter()
    const newNode: Node = {
      id,
      type: 'targetNode',
      position: { x: center.x + (Math.random() - 0.5) * 100, y: center.y + (Math.random() - 0.5) * 100 },
      data: { mode: 'maximize', ports: [{ id: `demand_${id.slice(-4)}`, amount: 100, category: DEFAULT_RESOURCE_CATEGORY }] },
    }
    useCanvasStore.getState().addNode(newNode)
  }, [takeSnapshot, getViewportCenter])

  const handleClear = useCallback(() => {
    takeSnapshot()
    useCanvasStore.getState().clearAll()
  }, [takeSnapshot])

  const handleDeleteSelected = useCallback(() => {
    takeSnapshot()
    useCanvasStore.getState().deleteSelected()
  }, [takeSnapshot])

  const handleDeleteSelectedEdges = useCallback(() => {
    takeSnapshot()
    useCanvasStore.getState().deleteSelectedEdges()
  }, [takeSnapshot])

  const handleDeleteSelectedNodes = useCallback(() => {
    takeSnapshot()
    useCanvasStore.getState().deleteSelected()
  }, [takeSnapshot])

  const handleSelectAll = useCallback(() => {
    const state = useCanvasStore.getState()
    setNodes(state.nodes.map((node) => ({ ...node, selected: true })))
    setEdges(state.edges.map((edge) => ({ ...edge, selected: true })))
  }, [setEdges, setNodes])

  const handleClearSelection = useCallback(() => {
    const state = useCanvasStore.getState()
    setNodes(state.nodes.map((node) => ({ ...node, selected: false })))
    setEdges(state.edges.map((edge) => ({ ...edge, selected: false })))
  }, [setEdges, setNodes])

  return {
    isValidConnection,
    onConnect,
    onEdgeDoubleClick,
    handleAddSource,
    handleAddFurnace,
    handleAddCustomRecipe,
    handleAddTarget,
    handleClear,
    handleDeleteSelected,
    handleDeleteSelectedEdges,
    handleDeleteSelectedNodes,
    handleSelectAll,
    handleClearSelection,
  }
}
