import type { Node } from 'reactflow'
import type { RecipeNodeData, SourceNodeData, TargetNodeData } from '@/common/types/recipe'
import { stripCalculationResults } from '@/common/utils/calculationState'
import { documentKey } from '@/common/utils/saveBaseline'
import { buildResourceId, DEFAULT_RESOURCE_CATEGORY } from '@/common/utils/resourceId'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { configureEndpointPorts } from '@/features/calculation/endpointConfiguration'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { disconnectNewGlobalPorts, editableRoutingPorts } from '@/features/recipe/routingTransitions'

/** User-actionable save failures shared by all node editor containers. */
export type EditorFailure = 'missing' | 'conflict' | 'invalid'
/** Preserve the open draft when its commit was rejected. */
export type EditorSaveResult = { ok: true } | { ok: false; reason: EditorFailure }
/** Execute all document mutations as one undoable transaction. */
export type EditorCommit = (action: () => void) => void

/** Capture editable data and its unit context without transient calculation fields.
 * @param id - Existing node identity.
 * @returns Stable edit baseline, or null for a missing node.
 */
export function nodeEditorBaseline(id: string): string | null {
  const node = useCanvasStore.getState().nodes.find(item => item.id === id)
  if (!node) return null
  const data = node.type === 'recipeNode' ? useRecipeStore.getState().dumpAll()[id] : stripCalculationResults(node.data)
  return documentKey({ type: node.type, data, environment: useSettingsStore.getState().units })
}

/** Refuse stale or deleted targets before entering the document transaction.
 * @param id - Node being edited.
 * @param baseline - Identity captured when the draft was opened.
 * @returns Failure reason, or null for a valid draft baseline.
 */
function conflict(id: string, baseline: string | null): EditorFailure | null {
  const current = nodeEditorBaseline(id)
  return current === null ? 'missing' : baseline === null || current !== baseline ? 'conflict' : null
}

/** Save a recipe and routing consequences as one reversible document edit.
 * @param id - Recipe node identity.
 * @param data - Validated draft recipe.
 * @param baseline - Original editable identity.
 * @param commit - History-aware atomic transaction.
 * @param setNodes - Canvas node setter.
 * @returns Save outcome; failures leave the editor open.
 */
export function commitRecipeEditor(id: string, data: RecipeNodeData, baseline: string | null, commit: EditorCommit, setNodes: (nodes: Node[]) => void): EditorSaveResult {
  const reason = conflict(id, baseline)
  if (reason) return { ok: false, reason }
  if (useCanvasStore.getState().nodes.find(node => node.id === id)?.type !== 'recipeNode') return { ok: false, reason: 'missing' }
  try {
    commit(() => {
      const previous = useRecipeStore.getState().recipes[id]
      useRecipeStore.getState().setRecipe(id, stripCalculationResults(data))
      const saved = useRecipeStore.getState().recipes[id]
      const canvas = useCanvasStore.getState()
      const nextEdges = disconnectNewGlobalPorts(id, previous ? editableRoutingPorts('recipeNode', previous) : [], editableRoutingPorts('recipeNode', saved), canvas.edges)
      if (nextEdges !== canvas.edges) canvas.setEdges(nextEdges)
      setNodes(canvas.nodes.map(node => node.id === id ? { ...node, data: { ...node.data, label: data.machine_name } } : node))
    })
    return { ok: true }
  } catch { return { ok: false, reason: 'invalid' } }
}

/** Save endpoint resources, routing and new boundary defaults in one transaction.
 * @param id - Endpoint identity.
 * @param patch - Validated editable endpoint fields.
 * @param baseline - Original editable identity.
 * @param commit - History-aware atomic transaction.
 * @param setNodes - Canvas node setter.
 * @returns Save outcome, with no partial writes on failure.
 */
export function commitEndpointEditor(id: string, patch: Partial<SourceNodeData & TargetNodeData>, baseline: string | null, commit: EditorCommit, setNodes: (nodes: Node[]) => void): EditorSaveResult {
  const reason = conflict(id, baseline)
  if (reason) return { ok: false, reason }
  const canvas = useCanvasStore.getState()
  const previous = canvas.nodes.find(node => node.id === id)!
  if (previous.type !== 'sourceNode' && previous.type !== 'targetNode') return { ok: false, reason: 'missing' }
  try {
    const edited = { ...previous, data: { ...previous.data, ...stripCalculationResults(patch) } }
    const configuration = configureEndpointPorts(canvas.networkConfiguration, edited, useSettingsStore.getState().units)
    const edges = disconnectNewGlobalPorts(id, editableRoutingPorts(previous.type, previous.data), editableRoutingPorts(previous.type, edited.data), canvas.edges)
    commit(() => {
      const registry = useGlobalResourceTable.getState()
      for (const port of patch.ports ?? []) {
        if (port.id?.trim()) registry.ensureEntry(buildResourceId(port.category ?? DEFAULT_RESOURCE_CATEGORY, port.id))
      }
      setNodes(canvas.nodes.map(node => node.id === id ? edited : node))
      if (edges !== canvas.edges) useCanvasStore.getState().setEdges(edges)
      useCanvasStore.getState().setNetworkConfiguration(configuration)
    })
    return { ok: true }
  } catch { return { ok: false, reason: 'invalid' } }
}
