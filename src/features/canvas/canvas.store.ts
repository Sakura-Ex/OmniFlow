import { stripCalculationResults } from '@/common/utils/calculationState'
import type { DiagnosticReport, ActiveLimit } from '@/features/calculation/diagnostics'
import type { StartupChecklist } from '@/common/types/api'
import { configureEndpointPorts } from '@/features/calculation/endpointConfiguration'
import { emptyNetworkConfiguration, NetworkConfigurationSchema, type NetworkConfiguration } from '@/common/schemas/network.schema'
import { useSettingsStore } from '@/features/settings/settings.store'
import { normalizeGraph } from './graphDocument'
import { normalizeCanvasNode } from './canvas.validators'
import { create } from 'zustand'
import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import type { CalculateResponse, NetSummary } from '@/common/types/api'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { formatCalculationError } from '@/features/calculation/calculationClient'

/**
 * Remove transient calculation values while retaining editable node data.
 * @param nodes - Current canvas nodes.
 * @returns Nodes without values from a previous calculation.
 */
function clearNodeResults(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    const data = stripCalculationResults(node.data)
    return { ...node, data }
  })
}

/** Root state and actions for the canvas Zustand store. */
export type CanvasStore = {
  lastCalculationResult: CalculateResponse | null
  beginCalculation: () => void
  diagnosticReport?: DiagnosticReport
  activeLimits: ActiveLimit[]
  startup?: StartupChecklist
  setDiagnosticReport: (report: DiagnosticReport | undefined) => void
  setActiveLimits: (limits: ActiveLimit[]) => void
  documentRevision: number
  calculationStatus: 'idle' | 'running' | 'success' | 'feasible' | 'stale' | 'error'
  calculationIssues: NonNullable<CalculateResponse['errors']>
  calculationMessage: string | null
  netSummaries: NetSummary[]
  systemSpills: Record<string, number>
  invalidateCalculation: () => void
  networkConfiguration: NetworkConfiguration
  setNetworkConfiguration: (configuration: NetworkConfiguration) => void
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
  loadFromDB: (canvasId: string, projectId: string, nodes: Node[], edges: Edge[], viewport: { x: number; y: number; zoom: number }, recipes?: Record<string, RecipeNodeData>, configuration?: NetworkConfiguration) => void
  /** Reset the canvas to its initial empty state (clears nodes, edges, and metadata). */
  resetCanvas: () => void

  /** Reset only the calculation-derived state (inputs, outputs, globals, capex, error). */
  resetCalculationState: () => void

  /** Append a single node to the canvas. */
  addNode: (node: Node) => void
  /** Add a recipe node and register its recipe data in the recipe store. */
  addRecipeNode: (id: string, nodeData: RecipeNodeData, newNode: Node) => void
  /** Delete all currently selected nodes and their connected edges. */
  deleteSelected: (scope?: 'all' | 'nodes') => void
  /** Delete all currently selected edges without removing nodes. */
  deleteSelectedEdges: () => void
  /** Clear all nodes, edges, and calculation state from the canvas. */
  clearAll: () => void

  /** Merge partial data into a node and update its edges if a handle reconnection occurred. */
  updateNodeData: (nodeId: string, nextData: Record<string, unknown>) => void
  /** Apply a calculation result to the canvas, updating node data, system balances, and CAPEX. */
  setCalculationResult: (result: CalculateResponse) => void
}

/** Zustand store managing all canvas state, including nodes, edges, viewport, calculation results, and derived data. */
export const useCanvasStore = create<CanvasStore>((set, get) => ({
  diagnosticReport: undefined, activeLimits: [], startup: undefined,
  setDiagnosticReport: (diagnosticReport) => set({ diagnosticReport }),
  setActiveLimits: (activeLimits) => set({ activeLimits }),
  documentRevision: 0,
  calculationStatus: 'idle',
  calculationMessage: null,
  calculationIssues: [],
  netSummaries: [],
  systemSpills: {},
  lastCalculationResult: null,
  beginCalculation: () => set({ calculationStatus: 'running', error: null, calculationMessage: null, calculationIssues: [], activeLimits: [], diagnosticReport: undefined }),
  invalidateCalculation: () => set(state => ({ documentRevision: state.documentRevision + 1, calculationStatus: 'stale', diagnosticReport: undefined, activeLimits: [], error: null, calculationMessage: null, calculationIssues: [] })),
  networkConfiguration: emptyNetworkConfiguration(),
  setNetworkConfiguration: (configuration) => set({ networkConfiguration: NetworkConfigurationSchema.parse(configuration), isDirty: true }),
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

  setNodes: (nodes) => set(state => {
    const ids = new Set(nodes.map(node => node.id))
    const ports = Object.fromEntries(Object.entries(state.networkConfiguration.ports).filter(([key]) => { try { return ids.has(JSON.parse(key)[0]) } catch { return true } }))
    const machines = Object.fromEntries(Object.entries(state.networkConfiguration.machines).filter(([id]) => ids.has(id)))
    return { nodes: nodes.map(node => ({ ...node, data: { ...node.data, ...state.lastCalculationResult?.node_results?.[node.id] } })), networkConfiguration: { ...state.networkConfiguration, ports, machines } }
  }),
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
  loadFromDB: (canvasId, projectId, nodes, edges, viewport, recipes = {}, configuration = emptyNetworkConfiguration()) => {
    const graph = normalizeGraph(nodes, edges, recipes, true)
    useRecipeStore.setState({ recipes: {} })
    useRecipeStore.getState().loadAll(graph.recipes)
    get().resetCalculationState()
    set({ canvasId, projectId, nodes: graph.nodes, edges: graph.edges, viewport, networkConfiguration: NetworkConfigurationSchema.parse(configuration), isDirty: false })
  },
  resetCanvas: () => set({ lastCalculationResult: null, calculationStatus: 'idle', diagnosticReport: undefined, activeLimits: [], startup: undefined, networkConfiguration: emptyNetworkConfiguration(), nodes: [], edges: [], canvasId: null, projectId: null, isDirty: false, systemInputs: {}, systemOutputs: {}, lastSystemInputs: {}, lastSystemOutputs: {}, globalInputIds: [], globalOutputIds: [], capexList: {}, error: null }),

  resetCalculationState: () => set((state) => ({
    lastCalculationResult: null,
    calculationStatus: 'idle', diagnosticReport: undefined, activeLimits: [], startup: undefined,
    calculationMessage: null,
    calculationIssues: [],
    netSummaries: [],
    systemSpills: {},
    nodes: clearNodeResults(state.nodes),
    systemInputs: {},
    systemOutputs: {},
    lastSystemInputs: {},
    lastSystemOutputs: {},
    globalInputIds: [],
    globalOutputIds: [],
    capexList: {},
    error: null,
  })),

  addNode: (node) => {
    set((state) => { const normalized = normalizeCanvasNode(node); return { nodes: [...state.nodes, normalized], networkConfiguration: configureEndpointPorts(state.networkConfiguration, normalized, useSettingsStore.getState().units) } })
  },

  addRecipeNode: (id, nodeData, newNode) => {
    useRecipeStore.getState().setRecipe(id, nodeData)
    set((state) => ({ nodes: [...state.nodes, { ...newNode, data: useRecipeStore.getState().recipes[id] }] }))
  },

  deleteSelected: (scope = 'all') => {
    set((state) => {
      const toRemove = state.nodes.filter((n) => n.selected).map((n) => n.id)
      if (toRemove.length === 0 && (scope === 'nodes' || !state.edges.some(edge => edge.selected))) return state
      const recipeStore = useRecipeStore.getState()
      for (const id of toRemove) {
        recipeStore.removeRecipe(id)
      }
      const removed = new Set(toRemove)
      const networkConfiguration = { ...state.networkConfiguration, machines: Object.fromEntries(Object.entries(state.networkConfiguration.machines).filter(([id]) => !removed.has(id))), ports: Object.fromEntries(Object.entries(state.networkConfiguration.ports).filter(([key]) => { try { return !removed.has(JSON.parse(key)[0]) } catch { return true } })) }
      return {
        networkConfiguration,
        nodes: state.nodes.filter((n) => !toRemove.includes(n.id)),
        edges: state.edges.filter(
          (e) => (scope === 'nodes' || !e.selected) && !toRemove.includes(e.source) && !toRemove.includes(e.target)
        ),
      }
    })
  },

  deleteSelectedEdges: () => {
    set((state) => ({ edges: state.edges.filter((e) => !e.selected) }))
  },

  clearAll: () => {
    get().resetCalculationState()
    useRecipeStore.setState({ recipes: {} })
    set({
      diagnosticReport: undefined, activeLimits: [], startup: undefined, networkConfiguration: emptyNetworkConfiguration(),
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

  updateNodeData: (nodeId, nextData) => {
    set((state) => {
      const currentNode = state.nodes.find((n) => n.id === nodeId)
      if (!currentNode) return state

      const currentData = (currentNode.data ?? {}) as Record<string, unknown>
      const merged = { ...currentData, ...nextData }
      const mergedData = currentNode.type === 'recipeNode' ? merged : normalizeCanvasNode({ ...currentNode, data: merged }).data

      if (currentNode.type === 'recipeNode') {
        useRecipeStore.getState().updateRecipe(nodeId, nextData)
      }

      const dataChanged = Object.keys(mergedData).some(
        (key) => currentData[key] !== mergedData[key]
      )
      if (!dataChanged) return state

      const nextNodes = state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...mergedData, ...state.lastCalculationResult?.node_results?.[nodeId] } } : node
      )

      const nextEdges = state.edges
      return { nodes: nextNodes, edges: nextEdges }
    })
  },

  setCalculationResult: (result) => {
    const nodeResults = result.node_results ?? {}
    const nextSystemInputs = result.system_inputs ?? {}
    const nextSystemOutputs = result.system_outputs ?? {}

    if (result.status !== 'success' && !(result.status === 'limit_reached' && result.has_verified_solution)) {
      set({
        activeLimits: [], diagnosticReport: undefined,
        error: formatCalculationError(result),
        calculationStatus: 'error',
        calculationMessage: result.message ?? null,
        calculationIssues: result.errors ?? [],
      })
      return
    }

    set((state) => {
      const nextNodes = state.nodes.map((node) => {
        let nextData = stripCalculationResults(node.data as Record<string, unknown>)
        const nodeResult = nodeResults[node.id]

        if (nodeResult) {
          nextData = { ...nextData, ...nodeResult }
        }

        if (nextData === node.data) return node
        return { ...node, data: nextData }
      })

      const capexMap = result.bom ?? {}

      return {
        lastCalculationResult: result, calculationIssues: [],
        nodes: nextNodes, startup: result.startup,
        error: null,
        calculationStatus: result.status === 'success' ? 'success' : 'feasible',
        calculationMessage: result.message ?? null,
        netSummaries: result.net_summaries ?? [],
        systemSpills: result.system_spills ?? {},
        systemInputs: nextSystemInputs,
        systemOutputs: nextSystemOutputs,
        lastSystemInputs: nextSystemInputs,
        lastSystemOutputs: nextSystemOutputs,
        capexList: capexMap,
      }
    })
  },
}))
