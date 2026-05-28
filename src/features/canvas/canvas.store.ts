import { create } from 'zustand'
import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData, EndpointPort, EndpointRole } from '@/common/types/recipe'
import type { CalculateResponse } from '@/common/types/api'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { normalizeEndpointPorts } from '@/features/recipe/recipe.endpointNorm'
import { buildResourceId, normalizeResourceKey, DEFAULT_RESOURCE_CATEGORY } from '@/common/utils/resourceId'
import { computeCapexList } from '@/features/calculation/capEx'

/**
 * Normalize and extract `actual_amounts` from a single sub-node calculation result.
 * @param subResult - An optional sub-result containing `actual_amounts`.
 * @returns A record of resource keys (normalized) to their actual amounts.
 */
function extractActualAmounts(
  subResult: { actual_amounts?: Record<string, number> } | undefined,
): Record<string, number> {
  if (!subResult?.actual_amounts) return {}
  const result: Record<string, number> = {}
  for (const [key, value] of Object.entries(subResult.actual_amounts)) {
    result[normalizeResourceKey(key)] = value
  }
  return result
}

/**
 * Describes a handle (port) reconnection event on a node.
 * Used when a user drags an edge from one port to another.
 */
export type HandleUpdate = {
  /** Whether the handle belongs to a source or target role. */
  role: EndpointRole
  /** The ID of the port being disconnected. */
  previousId: string
  /** The ID of the port being connected. */
  nextId: string
}

/** Root state and actions for the canvas Zustand store. */
export type CanvasStore = {
  /** All React Flow nodes currently on the canvas. */
  nodes: Node[]
  /** All React Flow edges currently on the canvas. */
  edges: Edge[]
  /** Current viewport position and zoom level. */
  viewport: { x: number; y: number; zoom: number }
  /** Aggregated system-wide input resource amounts keyed by resource ID. */
  systemInputs: Record<string, number>
  /** Aggregated system-wide output resource amounts keyed by resource ID. */
  systemOutputs: Record<string, number>
  /** Snapshot of `systemInputs` from the most recent calculation. */
  lastSystemInputs: Record<string, number>
  /** Snapshot of `systemOutputs` from the most recent calculation. */
  lastSystemOutputs: Record<string, number>
  /** IDs of resources routed globally as inputs. */
  globalInputIds: string[]
  /** IDs of resources routed globally as outputs. */
  globalOutputIds: string[]
  /** Computed CAPEX (capital expenditure) map keyed by recipe node ID. */
  capexList: Record<string, number>
  /** Latest calculation error message, or `null` if none. */
  error: string | null
  /** Whether the canvas has unsaved changes. */
  isDirty: boolean
  /** The loaded canvas document ID from the database, or `null`. */
  canvasId: string | null
  /** The owning project ID, or `null`. */
  projectId: string | null

  /** Replace all nodes on the canvas. */
  setNodes: (nodes: Node[]) => void
  /** Replace all edges on the canvas. */
  setEdges: (edges: Edge[]) => void
  /** Set the system-wide input resource amounts. */
  setSystemInputs: (v: Record<string, number>) => void
  /** Set the system-wide output resource amounts. */
  setSystemOutputs: (v: Record<string, number>) => void
  /** Set the snapshot of system inputs from the last calculation. */
  setLastSystemInputs: (v: Record<string, number>) => void
  /** Set the snapshot of system outputs from the last calculation. */
  setLastSystemOutputs: (v: Record<string, number>) => void
  /** Set the list of globally routed input resource IDs. */
  setGlobalInputIds: (v: string[]) => void
  /** Set the list of globally routed output resource IDs. */
  setGlobalOutputIds: (v: string[]) => void
  /** Set the computed CAPEX map. */
  setCapexList: (v: Record<string, number>) => void
  /** Set the current calculation error (or clear it with `null`). */
  setError: (v: string | null) => void
  /** Mark the canvas as having unsaved changes. */
  markDirty: () => void
  /** Load a canvas from the database, replacing all state and clearing the dirty flag. */
  loadFromDB: (canvasId: string, projectId: string, nodes: Node[], edges: Edge[], viewport: { x: number; y: number; zoom: number }) => void
  /** Reset the canvas to its initial empty state (clears nodes, edges, and metadata). */
  resetCanvas: () => void

  /** Reset only the calculation-derived state (inputs, outputs, globals, capex, error). */
  resetCalculationState: () => void

  /** Append a single node to the canvas. */
  addNode: (node: Node) => void
  /** Add a recipe node and register its recipe data in the recipe store. */
  addRecipeNode: (id: string, nodeData: RecipeNodeData, newNode: Node) => void
  /** Delete all currently selected nodes and their connected edges. */
  deleteSelected: () => void
  /** Delete all currently selected edges without removing nodes. */
  deleteSelectedEdges: () => void
  /** Clear all nodes, edges, and calculation state from the canvas. */
  clearAll: () => void

  /** Merge partial data into a node and update its edges if a handle reconnection occurred. */
  updateNodeData: (nodeId: string, nextData: Record<string, unknown>, handleUpdate?: HandleUpdate) => void
  /** Apply a calculation result to the canvas, updating node data, system balances, and CAPEX. */
  setCalculationResult: (result: CalculateResponse) => void
}

/** Zustand store managing all canvas state, including nodes, edges, viewport, calculation results, and derived data. */
export const useCanvasStore = create<CanvasStore>((set) => ({
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  systemInputs: {},
  systemOutputs: {},
  lastSystemInputs: {},
  lastSystemOutputs: {},
  globalInputIds: [],
  globalOutputIds: [],
  capexList: {},
  error: null,
  isDirty: false,
  canvasId: null,
  projectId: null,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSystemInputs: (v) => set({ systemInputs: v }),
  setSystemOutputs: (v) => set({ systemOutputs: v }),
  setLastSystemInputs: (v) => set({ lastSystemInputs: v }),
  setLastSystemOutputs: (v) => set({ lastSystemOutputs: v }),
  setGlobalInputIds: (v) => set({ globalInputIds: v }),
  setGlobalOutputIds: (v) => set({ globalOutputIds: v }),
  setCapexList: (v) => set({ capexList: v }),
  setError: (v) => set({ error: v }),
  markDirty: () => set({ isDirty: true }),
  loadFromDB: (canvasId, projectId, nodes, edges, viewport) => set({ canvasId, projectId, nodes, edges, viewport, isDirty: false }),
  resetCanvas: () => set({ nodes: [], edges: [], canvasId: null, projectId: null, isDirty: false, systemInputs: {}, systemOutputs: {}, lastSystemInputs: {}, lastSystemOutputs: {}, globalInputIds: [], globalOutputIds: [], capexList: {}, error: null }),

  resetCalculationState: () => set({
    systemInputs: {},
    systemOutputs: {},
    lastSystemInputs: {},
    lastSystemOutputs: {},
    globalInputIds: [],
    globalOutputIds: [],
    capexList: {},
    error: null,
  }),

  addNode: (node) => {
    set((state) => ({ nodes: [...state.nodes, node] }))
  },

  addRecipeNode: (id, nodeData, newNode) => {
    useRecipeStore.getState().setRecipe(id, nodeData)
    set((state) => ({ nodes: [...state.nodes, newNode] }))
  },

  deleteSelected: () => {
    set((state) => {
      const toRemove = state.nodes.filter((n) => n.selected).map((n) => n.id)
      if (toRemove.length === 0) return state
      const recipeStore = useRecipeStore.getState()
      for (const id of toRemove) {
        recipeStore.removeRecipe(id)
      }
      return {
        nodes: state.nodes.filter((n) => !toRemove.includes(n.id)),
        edges: state.edges.filter(
          (e) => !toRemove.includes(e.source) && !toRemove.includes(e.target)
        ),
      }
    })
  },

  deleteSelectedEdges: () => {
    set((state) => ({ edges: state.edges.filter((e) => !e.selected) }))
  },

  clearAll: () => {
    useRecipeStore.setState({ recipes: {} })
    set({
      nodes: [],
      edges: [],
      systemInputs: {},
      systemOutputs: {},
      lastSystemInputs: {},
      lastSystemOutputs: {},
      globalInputIds: [],
      globalOutputIds: [],
      capexList: {},
      error: null,
    })
  },

  updateNodeData: (nodeId, nextData, handleUpdate) => {
    set((state) => {
      const currentNode = state.nodes.find((n) => n.id === nodeId)
      if (!currentNode) return state

      const currentData = (currentNode.data ?? {}) as Record<string, unknown>
      const mergedData = { ...currentData, ...nextData }

      if (currentNode.type === 'recipeNode') {
        useRecipeStore.getState().updateRecipe(nodeId, nextData)
      }

      const dataChanged = Object.keys(mergedData).some(
        (key) => currentData[key] !== mergedData[key]
      )
      const handleChanged = !!(
        handleUpdate && handleUpdate.previousId !== handleUpdate.nextId
      )

      if (!dataChanged && !handleChanged) return state

      const nextNodes = state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: mergedData } : node
      )

      let nextEdges = state.edges
      if (handleChanged && handleUpdate) {
        const currentNodeData = currentNode.data as Record<string, unknown>
        const nodeCategory: string = (currentNodeData.category as string) ?? DEFAULT_RESOURCE_CATEGORY
        const ports: EndpointPort[] = (currentNodeData.ports as EndpointPort[]) ?? []
        const oldPort = ports.find((p) => p.id === handleUpdate.previousId)
        const portCategory = oldPort?.category ?? nodeCategory
        const prevHandle = buildResourceId(portCategory, handleUpdate.previousId)
        const nextHandle = buildResourceId(portCategory, handleUpdate.nextId)
        nextEdges = state.edges.map((edge) => {
          if (
            handleUpdate.role === 'source' &&
            edge.source === nodeId &&
            edge.sourceHandle === prevHandle
          ) {
            return { ...edge, sourceHandle: nextHandle }
          }
          if (
            handleUpdate.role === 'target' &&
            edge.target === nodeId &&
            edge.targetHandle === prevHandle
          ) {
            return { ...edge, targetHandle: nextHandle }
          }
          return edge
        })
      }

      return { nodes: nextNodes, edges: nextEdges }
    })
  },

  setCalculationResult: (result) => {
    const nodeResults = result.node_results ?? {}
    const nextSystemInputs = result.system_inputs ?? {}
    const nextSystemOutputs = result.system_outputs ?? {}

    if (result.status !== 'success') {
      const messages: Record<string, string> = {
        unbounded: 'Unbounded: Found "Maximize" nodes, but no physical bottleneck. Set a machine cap or source limit upstream.',
        infeasible: 'Infeasible: Check for conflicting constraints or missing input sources.',
      }
      set({
        systemInputs: {},
        systemOutputs: {},
        globalInputIds: [],
        globalOutputIds: [],
        error: messages[result.status ?? ''] ?? 'Calculation failed. Please try again later.',
      })
      return
    }

    set((state) => {
      const recipeStore = useRecipeStore.getState()
      const nextNodes = state.nodes.map((node) => {
        let nextData = node.data as Record<string, unknown>
        const directNodeResult = nodeResults[node.id]
        const shaped = recipeStore.recipes[node.id]
        const recipeId =
          shaped?.recipe_id && typeof shaped.recipe_id === 'string'
            ? shaped.recipe_id
            : null
        const nodeResult =
          directNodeResult ?? (recipeId ? nodeResults[recipeId] : undefined)

        if (nodeResult) {
          nextData = { ...nextData, ...nodeResult }
        }

        if (node.type === 'sourceNode' || node.type === 'targetNode') {
          const ports = normalizeEndpointPorts(node.data)
          const actualAmounts: Record<string, number> = {}
          for (let pi = 0; pi < ports.length; pi++) {
            const subNodeId = `${node.id}__p${pi}`
            const subResult = nodeResults[subNodeId]
            Object.assign(actualAmounts, extractActualAmounts(subResult))
          }
          nextData = {
            ...nextData,
            actual_amounts: actualAmounts,
          }
        }

        if (nextData === node.data) return node
        return { ...node, data: nextData }
      })

      const capexMap = computeCapexList(recipeStore.recipes, nodeResults)

      return {
        nodes: nextNodes,
        systemInputs: nextSystemInputs,
        systemOutputs: nextSystemOutputs,
        lastSystemInputs: nextSystemInputs,
        lastSystemOutputs: nextSystemOutputs,
        capexList: capexMap,
      }
    })
  },
}))
