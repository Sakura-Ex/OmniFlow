import { useCallback } from 'react'
import type { ChangeEvent, Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData } from '../types/recipe'
import { useRecipeStore } from '../stores/recipeStore'
import { stripState } from '../utils/canvasUtils'
import { migrateV1ToV2, type CanvasPayload, type CanvasPayloadV1, type CanvasPayloadV2 } from '../core/migration/v1ToV2'

type UseFileIOParams = {
  storageKey: string
  fileInputRef: MutableRefObject<HTMLInputElement | null>
  nodesRef: MutableRefObject<Node[]>
  edgesRef: MutableRefObject<Edge[]>
  setNodes: Dispatch<SetStateAction<Node[]>>
  setEdges: Dispatch<SetStateAction<Edge[]>>
  takeSnapshot: () => void
  normalizeCanvasNode: (node: Node) => Node
  resetSystemStats: () => void
}

export function useFileIO({
  storageKey,
  fileInputRef,
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  takeSnapshot,
  normalizeCanvasNode,
  resetSystemStats,
}: UseFileIOParams) {
  const serializeGraph = useCallback((): CanvasPayload => {
    return {
      version: 2,
      ui: {
        nodes: stripState(JSON.parse(JSON.stringify(nodesRef.current))),
        edges: stripState(JSON.parse(JSON.stringify(edgesRef.current))),
      },
      domain: {
        recipes: useRecipeStore.getState().dumpAll(),
      },
    }
  }, [edgesRef, nodesRef])

  const loadGraph = useCallback((payload: CanvasPayload) => {
    const raw = payload as Record<string, unknown>

    if (payload.version === 1 && Array.isArray(raw.nodes) && Array.isArray(raw.edges)) {
      const v2 = migrateV1ToV2(payload as CanvasPayloadV1)

      useRecipeStore.getState().loadAll(v2.domain.recipes)

      const normalizedNodes = v2.ui.nodes.map((node) => normalizeCanvasNode(node))
      takeSnapshot()
      setNodes(normalizedNodes)
      setEdges(v2.ui.edges)
      resetSystemStats()
      nodesRef.current = normalizedNodes
      edgesRef.current = v2.ui.edges
      return
    }

    if (payload.version === 2 && raw.ui && raw.domain) {
      const v2 = payload as CanvasPayloadV2

      if (!Array.isArray(v2.ui.nodes) || !Array.isArray(v2.ui.edges)) {
        alert('画布数据格式不正确')
        return
      }

      useRecipeStore.getState().loadAll(v2.domain.recipes)

      const normalizedNodes = v2.ui.nodes.map((node) => normalizeCanvasNode(node))
      takeSnapshot()
      setNodes(normalizedNodes)
      setEdges(v2.ui.edges)
      resetSystemStats()
      nodesRef.current = normalizedNodes
      edgesRef.current = v2.ui.edges
      return
    }

    alert('画布数据格式不正确')
  }, [edgesRef, nodesRef, normalizeCanvasNode, resetSystemStats, setEdges, setNodes, takeSnapshot])

  const handleSaveCanvas = useCallback(() => {
    try {
      const payload = serializeGraph()
      localStorage.setItem(storageKey, JSON.stringify(payload))
      alert('画布已保存到本地')
    } catch (error) {
      console.error('save canvas failed', error)
      alert('保存失败，请检查浏览器存储权限')
    }
  }, [serializeGraph, storageKey])

  const handleLoadCanvas = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) {
        alert('未找到已保存的画布')
        return
      }
      const payload = JSON.parse(raw)
      loadGraph(payload)
    } catch (error) {
      console.error('load canvas failed', error)
      alert('读取失败，请检查保存的数据格式')
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
        alert('导入失败，请检查 JSON 文件格式')
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
