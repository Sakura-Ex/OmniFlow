import { useCallback, useState } from 'react'
import type { Node } from 'reactflow'
import type { EndpointRole, RecipeNodeData, SourceNodeData, TargetNodeData } from '@/common/types/recipe'
import type { EndpointEditorTarget } from '@/features/canvas/contexts/EndpointEditorContext'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { buildResourceId, DEFAULT_RESOURCE_CATEGORY } from '@/common/utils/resourceId'

/**
 *
 */
type UseNodeEditorParams = {
  setNodes: (nodes: Node[]) => void
  takeSnapshot: () => void
  updateNodeInternals: (nodeId: string) => void
}

/**
 * Manages the editing state for recipe nodes and endpoints on the canvas.
 *
 * @param root0 - Hook parameters.
 * @param root0.setNodes - State setter for nodes.
 * @param root0.takeSnapshot - Pushes the current state onto the undo stack.
 * @param root0.updateNodeInternals - ReactFlow function to update node internals.
 * @returns An object containing:
 *  - `editingNode` - the currently-being-edited node (id + RecipeNodeData) or null.
 *  - `handleEditNode` - open the editor for a given node.
 *  - `handleCloseEditor` - close the node editor without saving.
 *  - `handleSaveEditor` - persist node changes, update the canvas store and snapshot.
 *  - `editingEndpoint` - the currently-being-edited endpoint target or null.
 *  - `handleEditEndpoint` - open the endpoint editor for a given node and role.
 *  - `handleCloseEndpointEditor` - close the endpoint editor without saving.
 *  - `handleSaveEndpoint` - persist endpoint changes and ensure resources are registered.
 */
export function useNodeEditor({ setNodes, takeSnapshot, updateNodeInternals }: UseNodeEditorParams) {
  const [editingNode, setEditingNode] = useState<{ id: string; data: RecipeNodeData } | null>(null)
  const [editingEndpoint, setEditingEndpoint] = useState<EndpointEditorTarget | null>(null)

  const handleEditNode = useCallback((id: string, data: RecipeNodeData) => {
    setEditingNode({ id, data })
  }, [])

  const handleCloseEditor = useCallback(() => {
    setEditingNode(null)
  }, [])

  const handleSaveEditor = useCallback((id: string, data: RecipeNodeData) => {
    takeSnapshot()
    useRecipeStore.getState().setRecipe(id, data)
    const prev = useCanvasStore.getState().nodes
    setNodes(prev.map((node) =>
      node.id === id ? { ...node, data: { ...node.data, label: data.machine_name } } : node
    ))
    setEditingNode(null)
    updateNodeInternals(id)
  }, [setNodes, takeSnapshot, updateNodeInternals])

  const handleEditEndpoint = useCallback((id: string, role: EndpointRole, data: SourceNodeData | TargetNodeData) => {
    setEditingEndpoint({ id, role, data })
  }, [])

  const handleCloseEndpointEditor = useCallback(() => {
    setEditingEndpoint(null)
  }, [])

  const handleSaveEndpoint = useCallback((id: string, patch: Partial<SourceNodeData & TargetNodeData>) => {
    takeSnapshot()
    const ports = patch.ports
    const grt = useGlobalResourceTable.getState()
    if (Array.isArray(ports)) {
      for (const port of ports) {
        if (port.id && String(port.id).trim().length > 0) {
          grt.ensureEntry(buildResourceId(port.category ?? DEFAULT_RESOURCE_CATEGORY, String(port.id)))
        }
      }
    }
    const prev = useCanvasStore.getState().nodes
    setNodes(prev.map((node) =>
      node.id !== id ? node : { ...node, data: { ...node.data, ...patch } }
    ))
    setEditingEndpoint(null)
    updateNodeInternals(id)
  }, [setNodes, takeSnapshot, updateNodeInternals])

  return {
    editingNode,
    handleEditNode,
    handleCloseEditor,
    handleSaveEditor,
    editingEndpoint,
    handleEditEndpoint,
    handleCloseEndpointEditor,
    handleSaveEndpoint,
  }
}
