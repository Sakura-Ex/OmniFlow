import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Node } from 'reactflow'
import type { RecipeNodeData, SourceNodeData, TargetNodeData } from '../types/recipe'
import type { EndpointEditorTarget } from '../EndpointEditorContext'

type UseNodeEditorParams = {
  setNodes: Dispatch<SetStateAction<Node[]>>
  takeSnapshot: () => void
}

export function useNodeEditor({ setNodes, takeSnapshot }: UseNodeEditorParams) {
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
    setNodes((prev) => prev.map((node) =>
      node.id === id ? { ...node, data: { ...node.data, ...data } } : node
    ))
    setEditingNode(null)
  }, [setNodes, takeSnapshot])

  const handleEditEndpoint = useCallback((id: string, role: 'source' | 'target', data: SourceNodeData | TargetNodeData) => {
    setEditingEndpoint({ id, role, data })
  }, [])

  const handleCloseEndpointEditor = useCallback(() => {
    setEditingEndpoint(null)
  }, [])

  const handleSaveEndpoint = useCallback((id: string, patch: Partial<SourceNodeData & TargetNodeData>) => {
    takeSnapshot()
    setNodes((prev) => prev.map((node) =>
      node.id !== id ? node : { ...node, data: { ...node.data, ...patch } }
    ))
    setEditingEndpoint(null)
  }, [setNodes, takeSnapshot])

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
