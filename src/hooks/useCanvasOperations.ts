import { useCallback } from 'react'
import type { Dispatch, MouseEvent, MutableRefObject, SetStateAction } from 'react'
import { addEdge, type Connection, type Edge, type Node } from 'reactflow'
import type { RecipeNodeData } from '../types/recipe'

type UseCanvasOperationsParams = {
  setNodes: Dispatch<SetStateAction<Node[]>>
  setEdges: Dispatch<SetStateAction<Edge[]>>
  nodesRef: MutableRefObject<Node[]>
  edgesRef: MutableRefObject<Edge[]>
  takeSnapshot: () => void
  setSystemInputs: Dispatch<SetStateAction<Record<string, number>>>
  setSystemOutputs: Dispatch<SetStateAction<Record<string, number>>>
  setLastSystemInputs: Dispatch<SetStateAction<Record<string, number>>>
  setLastSystemOutputs: Dispatch<SetStateAction<Record<string, number>>>
}

function makeId() {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function useCanvasOperations({
  setNodes,
  setEdges,
  nodesRef,
  takeSnapshot,
  setSystemInputs,
  setSystemOutputs,
  setLastSystemInputs,
  setLastSystemOutputs,
}: UseCanvasOperationsParams) {
  const isValidConnection = useCallback((connection: Connection) => {
    return connection.sourceHandle === connection.targetHandle
  }, [])

  const onConnect = useCallback((params: Connection) => {
    takeSnapshot()
    const sourceNode = nodesRef.current.find((n) => n.id === params.source)
    const sourcePort = sourceNode?.data?.outputs?.find((o: { id: string; category?: string; type?: string }) => o.id === params.sourceHandle)

    const sourcePortCategory = sourcePort?.category ?? sourcePort?.type
    const isFluid = sourcePortCategory === 'fluid' || params.sourceHandle === 'water'
    const strokeColor = isFluid ? '#4ddcff' : '#e5e7eb'
    const edgeClass = isFluid ? 'custom-edge-fluid' : 'custom-edge-item'

    const edge: Edge = {
      id: `e-${params.source}-${params.sourceHandle || ''}-${params.target}-${params.targetHandle || ''}-${Date.now()}`,
      source: params.source!,
      sourceHandle: params.sourceHandle,
      target: params.target!,
      targetHandle: params.targetHandle,
      type: 'default',
      className: edgeClass,
      style: { stroke: strokeColor, strokeWidth: 2 },
    }
    setEdges((eds) => addEdge(edge, eds))
  }, [nodesRef, setEdges, takeSnapshot])

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
      data: { id: `item_${id.slice(-4)}`, label: `item_${id.slice(-4)}`, amount: 100, is_auto: true, item_type: 'item' },
    }
    setNodes((nds) => nds.concat(newNode))
  }, [setNodes, takeSnapshot])

  const handleAddFurnace = useCallback(() => {
    takeSnapshot()
    const id = makeId()
    const newNode: Node<RecipeNodeData> = {
      id,
      type: 'recipeNode',
      position: { x: 320 + Math.random() * 50, y: 180 + Math.random() * 50 },
      data: {
        recipe_id: `recipe_${id}`,
        machine_name: 'Generic Machine',
        system: 'gregtech',
        inputs: [],
        outputs: [],
        duration_seconds: 5,
        is_auto: true,
        metadata: { eu_per_tick: 32, can_overclock: true },
      },
    }
    setNodes((nds) => nds.concat(newNode))
  }, [setNodes, takeSnapshot])

  const handleAddCustomRecipe = useCallback(() => {
    takeSnapshot()
    const id = makeId()
    const newNode: Node<RecipeNodeData> = {
      id,
      type: 'recipeNode',
      position: { x: 320 + Math.random() * 50, y: 180 + Math.random() * 50 },
      data: {
        recipe_id: `custom_${id}`,
        machine_name: 'Custom Machine',
        system: 'custom',
        inputs: [],
        outputs: [],
        duration_seconds: 0,
        is_auto: true,
        metadata: {},
      },
    }
    setNodes((nds) => nds.concat(newNode))
  }, [setNodes, takeSnapshot])

  const handleAddTarget = useCallback(() => {
    takeSnapshot()
    const id = makeId()
    const newNode: Node = {
      id,
      type: 'targetNode',
      position: { x: 320 + Math.random() * 50, y: 180 + Math.random() * 50 },
      data: { id: `demand_${id.slice(-4)}`, label: `demand_${id.slice(-4)}`, amount: 100, is_auto: true, item_type: 'item' },
    }
    setNodes((nds) => nds.concat(newNode))
  }, [setNodes, takeSnapshot])

  const handleClear = useCallback(() => {
    takeSnapshot()
    setNodes([])
    setEdges([])
    setSystemInputs({})
    setSystemOutputs({})
    setLastSystemInputs({})
    setLastSystemOutputs({})
  }, [setEdges, setLastSystemInputs, setLastSystemOutputs, setNodes, setSystemInputs, setSystemOutputs, takeSnapshot])

  const handleDeleteSelected = useCallback(() => {
    takeSnapshot()
    setNodes((nds) => {
      const toRemove = nds.filter((n) => n.selected).map((n) => n.id)
      if (toRemove.length === 0) return nds
      setEdges((es) => es.filter((ed) => !toRemove.includes(ed.source) && !toRemove.includes(ed.target)))
      return nds.filter((n) => !toRemove.includes(n.id))
    })
    setEdges((eds) => eds.filter((e) => !e.selected))
  }, [setEdges, setNodes, takeSnapshot])

  const handleDeleteSelectedEdges = useCallback(() => {
    takeSnapshot()
    setEdges((eds) => eds.filter((e) => !e.selected))
  }, [setEdges, takeSnapshot])

  const handleDeleteSelectedNodes = useCallback(() => {
    takeSnapshot()
    const toRemove = nodesRef.current.filter((n) => n.selected).map((n) => n.id)
    if (toRemove.length === 0) return
    setNodes((prev) => prev.filter((n) => !toRemove.includes(n.id)))
    setEdges((prev) => prev.filter((e) => !toRemove.includes(e.source) && !toRemove.includes(e.target)))
  }, [nodesRef, setEdges, setNodes, takeSnapshot])

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
