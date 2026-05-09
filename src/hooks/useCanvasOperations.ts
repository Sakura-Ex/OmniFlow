import { useCallback } from 'react'
import type { Dispatch, MouseEvent, MutableRefObject, SetStateAction } from 'react'
import { addEdge, type Connection, type Edge, type Node } from 'reactflow'
import type { RecipeNodeData } from '../types/recipe'
import { useCanvasStore } from '../stores/canvasStore'

type UseCanvasOperationsParams = {
  setNodes: Dispatch<SetStateAction<Node[]>>
  setEdges: Dispatch<SetStateAction<Edge[]>>
  takeSnapshot: () => void
}

function makeId() {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function useCanvasOperations({
  setNodes,
  setEdges,
  takeSnapshot,
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
    setEdges((eds) => addEdge(edge, eds))
  }, [setEdges, takeSnapshot])

  const onEdgeDoubleClick = useCallback((_: MouseEvent, edge: Edge) => {
    takeSnapshot()
    setEdges((eds) => eds.filter((e) => e.id !== edge.id))
  }, [setEdges, takeSnapshot])

  const handleAddSource = useCallback(() => {
    takeSnapshot()
    const id = makeId()
    const newNode: Node = {
      id,
      type: 'sourceNode',
      position: { x: 320 + Math.random() * 50, y: 180 + Math.random() * 50 },
      data: { id: `item_${id.slice(-4)}`, label: `item_${id.slice(-4)}`, amount: 100, is_auto: true, category: 'item' },
    }
    useCanvasStore.getState().addNode(newNode)
  }, [takeSnapshot])

  const handleAddFurnace = useCallback(() => {
    takeSnapshot()
    const id = makeId()
    const nodeData: RecipeNodeData = {
      recipe_id: `recipe_${id}`,
      machine_name: 'Generic Machine',
      system: 'gregtech',
      inputs: [],
      outputs: [],
      duration_seconds: 5,
      is_auto: true,
      metadata: { eu_per_tick: 32, can_overclock: true },
    }
    const newNode: Node<RecipeNodeData> = {
      id,
      type: 'recipeNode',
      position: { x: 320 + Math.random() * 50, y: 180 + Math.random() * 50 },
      data: nodeData,
    }
    useCanvasStore.getState().addRecipeNode(id, nodeData, newNode)
  }, [takeSnapshot])

  const handleAddCustomRecipe = useCallback(() => {
    takeSnapshot()
    const id = makeId()
    const nodeData: RecipeNodeData = {
      recipe_id: `custom_${id}`,
      machine_name: 'Custom Machine',
      system: 'custom',
      inputs: [],
      outputs: [],
      duration_seconds: 0,
      is_auto: true,
      metadata: {},
    }
    const newNode: Node<RecipeNodeData> = {
      id,
      type: 'recipeNode',
      position: { x: 320 + Math.random() * 50, y: 180 + Math.random() * 50 },
      data: nodeData,
    }
    useCanvasStore.getState().addRecipeNode(id, nodeData, newNode)
  }, [takeSnapshot])

  const handleAddTarget = useCallback(() => {
    takeSnapshot()
    const id = makeId()
    const newNode: Node = {
      id,
      type: 'targetNode',
      position: { x: 320 + Math.random() * 50, y: 180 + Math.random() * 50 },
      data: { id: `demand_${id.slice(-4)}`, label: `demand_${id.slice(-4)}`, amount: 100, is_auto: true, category: 'item' },
    }
    useCanvasStore.getState().addNode(newNode)
  }, [takeSnapshot])

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
    setNodes((prev) => prev.map((node) => ({ ...node, selected: true })))
    setEdges((prev) => prev.map((edge) => ({ ...edge, selected: true })))
  }, [setEdges, setNodes])

  const handleClearSelection = useCallback(() => {
    setNodes((prev) => prev.map((node) => ({ ...node, selected: false })))
    setEdges((prev) => prev.map((edge) => ({ ...edge, selected: false })))
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
