import { captureDocument } from '../captureDocument'
import { t } from '@/common/i18n'
import { readCanvasDocument, type CanvasDocument } from '../canvasDocument'
import { replaceDocument } from '../replaceDocument'
import { useCallback } from 'react'
import type { ChangeEvent, MutableRefObject } from 'react'
import type { Edge, Node } from 'reactflow'
import { useNodeDisplayStore } from '@/features/settings/nodeDisplay.store'

/** Parameters for the `useFileIO` hook. */
type UseFileIOParams = {
  storageKey: string
  fileInputRef: MutableRefObject<HTMLInputElement | null>
  nodesRef: MutableRefObject<Node[]>
  edgesRef: MutableRefObject<Edge[]>
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  commitEdit: (action: () => void) => void
  confirmReplace: () => boolean
  onLoaded: (snapshot: CanvasDocument) => void
  onSaved: (snapshot: CanvasDocument) => void
  normalizeCanvasNode: (node: Node) => Node
  resetSystemStats: () => void
}

/**
 * Provides canvas save/load, JSON export/import and local-storage persistence.
 *
 * @param root0 - Hook parameters.
 * @param root0.storageKey - localStorage key used for saving/loading.
 * @param root0.fileInputRef - Hidden `<input>` ref triggered for JSON import.
 * @param root0.nodesRef - Mutable ref holding the current node array.
 * @param root0.edgesRef - Mutable ref holding the current edge array.
 * @param root0.setNodes - State setter for nodes.
 * @param root0.setEdges - State setter for edges.
 * @param root0.commitEdit - Apply replacement atomically.
 * @param root0.confirmReplace - Protect unsaved document content.
 * @param root0.onLoaded - Establish the loaded baseline.
 * @param root0.onSaved - Acknowledge a successful save.
 * @param root0.normalizeCanvasNode - Callback that normalises a deserialised node.
 * @param root0.resetSystemStats - Resets system-level statistics after loading.
 * @returns An object with {@link handleSaveCanvas}, {@link handleLoadCanvas},
 *          {@link handleExportJson}, {@link handleImportClick} and
 *          {@link handleImportJson}.
 */
export function useFileIO({
  storageKey,
  fileInputRef,
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  commitEdit, confirmReplace, onLoaded, onSaved,
  normalizeCanvasNode,
  resetSystemStats,
}: UseFileIOParams) {
  const serializeGraph = captureDocument

  const loadGraph = useCallback((payload: unknown) => {
    const { document, warnings } = readCanvasDocument(payload)
    if (!confirmReplace()) return
    commitEdit(() => {
      const normalizedNodes = replaceDocument(document, { setNodes, setEdges, normalizeCanvasNode, resetSystemStats })
      nodesRef.current = normalizedNodes
      edgesRef.current = document.ui.edges
      })
    // Apply presentation only after model replacement succeeds; rollback remains model-owned.
    useNodeDisplayStore.getState().restoreMode(document.ui.nodeDisplayMode)
    onLoaded(captureDocument())
    if (warnings.length) alert(warnings.join('\n'))

  }, [edgesRef, nodesRef, normalizeCanvasNode, resetSystemStats, setEdges, setNodes, commitEdit, confirmReplace, onLoaded])

  const handleSaveCanvas = useCallback(() => {
    try {
      const payload = serializeGraph()
      localStorage.setItem(storageKey, JSON.stringify(payload))
      onSaved(payload)
      alert(t('canvas.canvas_saved_locally'))
    } catch (error) {
      console.error('save canvas failed', error)
      alert(t('canvas.save_failed_check_browser_storage_permissions'))
    }
  }, [serializeGraph, storageKey, onSaved])

  const handleLoadCanvas = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) {
        alert(t('canvas.no_saved_canvas_found'))
        return
      }
      const payload = JSON.parse(raw)
      loadGraph(payload)
    } catch (error) {
      console.error('load canvas failed', error)
      alert(t('canvas.load_failed_check_the_saved_data_format'))
    }
  }, [loadGraph, storageKey])

  const handleExportJson = useCallback(() => {
    const payload = serializeGraph()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `omniflow-canvas-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }, [serializeGraph])

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [fileInputRef])

  const handleImportJson = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result ?? ''))
        loadGraph(payload)
      } catch (error) {
        console.error('import canvas failed', error)
        alert(t('canvas.import_failed_check_the_json_file_format'))
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }, [loadGraph])

  return {
    handleSaveCanvas,
    handleLoadCanvas,
    handleExportJson,
    handleImportClick,
    handleImportJson,
  }
}
