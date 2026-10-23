import { useCanvasStore } from '@/features/canvas/canvas.store'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { stripCalculationResults } from '@/common/utils/calculationState'
import type { CanvasDocument } from './canvasDocument'

/** Capture only persisted document content, excluding selection, measurements and results.
 * @returns An independent save/export snapshot from authoritative stores.
 */
export function captureDocument(): CanvasDocument {
  const canvas = useCanvasStore.getState()
  const recipes = useRecipeStore.getState().dumpAll()
  const { categories, overrides, entries } = useGlobalResourceTable.getState()
  return structuredClone({ version: 5, pluginApiVersion: 2,
    networkConfiguration: canvas.networkConfiguration,
    environment: useSettingsStore.getState().units,
    registry: { categories, overrides, entries },
    ui: {
      nodes: canvas.nodes.map(node => {
        const { selected, dragging, width, height, positionAbsolute, ...editable } = node
        void selected; void dragging; void width; void height; void positionAbsolute
        return { ...editable, data: node.type === 'recipeNode'
          ? { label: recipes[node.id]?.machine_name }
          : stripCalculationResults(node.data) }
      }),
      edges: canvas.edges.map(edge => { const { selected, ...editable } = edge; void selected; return editable }),
    }, domain: { recipes },
  })
}
