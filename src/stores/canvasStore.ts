import { create } from 'zustand'
import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData, EndpointPort } from '../types/recipe'
import type { CalculateResponse } from '../types/api'
import { useRecipeStore } from './recipeStore'
import { normalizeEndpointPorts } from '../utils/endpointNorm'
import { buildResourceId } from '../utils/resourceIdentifier'
import { computeCapexList } from '../core/calculation/capEx'

export type HandleUpdate = {
  role: 'source' | 'target'
  previousId: string
  nextId: string
}

export type CanvasStore = {
  nodes: Node[]
  edges: Edge[]
  systemInputs: Record<string, number>
  systemOutputs: Record<string, number>
  lastSystemInputs: Record<string, number>
  lastSystemOutputs: Record<string, number>
  globalInputIds: string[]
  globalOutputIds: string[]
  capexList: Record<string, number>
  error: string | null

  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  setSystemInputs: (v: Record<string, number>) => void
  setSystemOutputs: (v: Record<string, number>) => void
  setLastSystemInputs: (v: Record<string, number>) => void
  setLastSystemOutputs: (v: Record<string, number>) => void
  setGlobalInputIds: (v: string[]) => void
  setGlobalOutputIds: (v: string[]) => void
  setCapexList: (v: Record<string, number>) => void
  setError: (v: string | null) => void

  resetCalculationState: () => void

  addNode: (node: Node) => void
  addRecipeNode: (id: string, nodeData: RecipeNodeData, newNode: Node) => void
  deleteSelected: () => void
  deleteSelectedEdges: () => void
  clearAll: () => void

  updateNodeData: (nodeId: string, nextData: Record<string, unknown>, handleUpdate?: HandleUpdate) => void
  setCalculationResult: (result: CalculateResponse) => void
}

export const useCanvasStore = create<CanvasStore>((set, _get) => ({
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

      let nextNodes = state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: mergedData } : node
      )

      let nextEdges = state.edges
      if (handleChanged && handleUpdate) {
        const currentNodeData = currentNode.data as Record<string, unknown>
        const nodeCategory: string = (currentNodeData.category as string) ?? 'item'
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

        if (node.type === 'sourceNode') {
          const ports = normalizeEndpointPorts(node.data)
          const actualAmounts: Record<string, number> = {}
          for (let pi = 0; pi < ports.length; pi++) {
            const port = ports[pi]
            const subNodeId = `${node.id}__p${pi}`
            const subResult = nodeResults[subNodeId]
            const amt = subResult?.actual_amounts?.[port.id] ?? 0
            actualAmounts[port.id] = amt
          }
          nextData = {
            ...nextData,
            actual_amounts: actualAmounts,
          }
        }

        if (node.type === 'targetNode') {
          const ports = normalizeEndpointPorts(node.data)
          const actualAmounts: Record<string, number> = {}
          for (let pi = 0; pi < ports.length; pi++) {
            const port = ports[pi]
            const subNodeId = `${node.id}__p${pi}`
            const subResult = nodeResults[subNodeId]
            const amt = subResult?.actual_amounts?.[port.id] ?? 0
            actualAmounts[port.id] = amt
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
