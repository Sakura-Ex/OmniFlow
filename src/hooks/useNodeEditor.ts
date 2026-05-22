import { useCallback, useState } from 'react'
import type { Node } from 'reactflow'
import type { RecipeNodeData, SourceNodeData, TargetNodeData } from '../types/recipe'
import type { EndpointEditorTarget } from '../EndpointEditorContext'
import { useRecipeStore } from '../stores/recipeStore'
import { useCanvasStore } from '../stores/canvasStore'
import { useGlobalResourceTable } from '../registry/globalResourceTable'
import { buildResourceId, DEFAULT_RESOURCE_CATEGORY } from '../utils/resourceIdentifier'

type UseNodeEditorParams = {
  setNodes: (nodes: Node[]) => void
  takeSnapshot: () => void
  updateNodeInternals: (nodeId: string) => void
}

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

  const handleEditEndpoint = useCallback((id: string, role: 'source' | 'target', data: SourceNodeData | TargetNodeData) => {
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
