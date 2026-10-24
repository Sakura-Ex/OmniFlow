import { useCallback, useRef, useState } from 'react'
import type { Node } from 'reactflow'
import type { EndpointRole, RecipeNodeData, SourceNodeData, TargetNodeData } from '@/common/types/recipe'
import type { EndpointEditorTarget } from '@/features/canvas/contexts/EndpointEditorContext'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { commitEndpointEditor, commitRecipeEditor, nodeEditorBaseline, type EditorCommit, type EditorFailure } from './editorCommit'

/** Application dependencies for opening and committing node edit sessions. */
type UseNodeEditorParams = {
  setNodes: (nodes: Node[]) => void
  commitEdit: EditorCommit
  updateNodeInternals: (nodeId: string) => void
  onError: (reason: EditorFailure) => void
}

/** Coordinate node editing with baseline checks and atomic document commits.
 * @param params - Canvas mutations, history transaction and failure reporting.
 * @param params.setNodes - Apply authoritative canvas node changes.
 * @param params.commitEdit - Commit one atomic history entry.
 * @param params.updateNodeInternals - Refresh ReactFlow handles after a successful edit.
 * @param params.onError - Present a localized failure while preserving the draft.
 * @returns Editor targets and consistent open, close and save actions.
 */
export function useNodeEditor({ setNodes, commitEdit, updateNodeInternals, onError }: UseNodeEditorParams) {
  const sessionId = useRef(0)
  const [editingNode, setEditingNode] = useState<{ id: string; data: RecipeNodeData; sessionId: number } | null>(null)
  const [editingEndpoint, setEditingEndpoint] = useState<(EndpointEditorTarget & { sessionId: number }) | null>(null)
  const [recipeBaseline, setRecipeBaseline] = useState<string | null>(null)
  const [endpointBaseline, setEndpointBaseline] = useState<string | null>(null)

  const handleEditNode = useCallback((id: string, data: RecipeNodeData) => {
    const baseline = nodeEditorBaseline(id)
    if (baseline === null) { onError('missing'); return }
    setRecipeBaseline(baseline)
    setEditingNode({ id, data: structuredClone(useRecipeStore.getState().recipes[id] ?? data), sessionId: ++sessionId.current })
  }, [onError])
  const handleCloseEditor = useCallback(() => setEditingNode(null), [])
  const handleSaveEditor = useCallback((id: string, data: RecipeNodeData) => {
    const result = commitRecipeEditor(id, data, editingNode?.id === id ? recipeBaseline : null, commitEdit, setNodes)
    if (!result.ok) { onError(result.reason); return result }
    setRecipeBaseline(nodeEditorBaseline(id))
    setEditingNode(previous => previous && { ...previous, data: structuredClone(useRecipeStore.getState().recipes[id]) })
    updateNodeInternals(id)
    return result
  }, [editingNode, recipeBaseline, commitEdit, setNodes, updateNodeInternals, onError])

  const handleEditEndpoint = useCallback((id: string, role: EndpointRole, data: SourceNodeData | TargetNodeData) => {
    const baseline = nodeEditorBaseline(id)
    if (baseline === null) { onError('missing'); return }
    setEndpointBaseline(baseline)
    const current = useCanvasStore.getState().nodes.find(node => node.id === id)?.data ?? data
    setEditingEndpoint({ id, role, data: structuredClone(current), sessionId: ++sessionId.current })
  }, [onError])
  const handleCloseEndpointEditor = useCallback(() => setEditingEndpoint(null), [])
  const handleSaveEndpoint = useCallback((id: string, patch: Partial<SourceNodeData & TargetNodeData>) => {
    const result = commitEndpointEditor(id, patch, editingEndpoint?.id === id ? endpointBaseline : null, commitEdit, setNodes)
    if (!result.ok) { onError(result.reason); return result }
    setEndpointBaseline(nodeEditorBaseline(id))
    const current = useCanvasStore.getState().nodes.find(node => node.id === id)!
    setEditingEndpoint(previous => previous && { ...previous, data: structuredClone(current.data) })
    updateNodeInternals(id)
    return result
  }, [editingEndpoint, endpointBaseline, commitEdit, setNodes, updateNodeInternals, onError])

  return { editingNode, handleEditNode, handleCloseEditor, handleSaveEditor,
    editingEndpoint, handleEditEndpoint, handleCloseEndpointEditor, handleSaveEndpoint }
}
