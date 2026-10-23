import { flushSync } from 'react-dom'
import type { Node, Edge } from 'reactflow'
import type { CanvasDocument } from './canvasDocument'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'

/** Graph adapters belonging to the caller's document transaction. */
interface ReplacementAdapters {
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  normalizeCanvasNode: (node: Node) => Node
  resetSystemStats: () => void
}

/** Replace a validated document inside the caller's rollback-capable transaction.
 * React Flow retains rendered node data independently of our stores. Unmount old
 * nodes before replacing unit definitions so no old display unit is interpreted
 * against the new document's environment during its internal synchronization.
 * @param document - Validated incoming document.
 * @param adapters - Existing graph setters and normalization callbacks.
 * @returns Normalized nodes for the caller's synchronous refs.
 */
export function replaceDocument(document: CanvasDocument, adapters: ReplacementAdapters): Node[] {
  flushSync(() => { adapters.setNodes([]); adapters.setEdges([]) })
  useRecipeStore.setState({ recipes: {} })
  useSettingsStore.getState().setEnvironment(document.environment)
  useGlobalResourceTable.getState().restore(document.registry)
  useRecipeStore.getState().loadAll(document.domain.recipes)
  const nodes = document.ui.nodes.map(adapters.normalizeCanvasNode)
  adapters.resetSystemStats()
  useCanvasStore.getState().setNetworkConfiguration(document.networkConfiguration)
  adapters.setNodes(nodes)
  adapters.setEdges(document.ui.edges)
  return nodes
}
