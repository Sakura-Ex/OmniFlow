import { useCallback } from 'react'
import type { ChangeEvent, Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { Edge, Node } from 'reactflow'

type CanvasPayload = {
  version: number
  nodes: Node[]
  edges: Edge[]
}

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

function stripState<T extends { selected?: boolean; dragging?: boolean }>(items: T[]) {
  return items.map((item) => {
    const { selected, dragging, ...rest } = item
    void selected
    void dragging
    return rest as unknown as T
  })
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
      version: 1,
      nodes: stripState(JSON.parse(JSON.stringify(nodesRef.current))),
      edges: stripState(JSON.parse(JSON.stringify(edgesRef.current))),
    }
  }, [edgesRef, nodesRef])

  const loadGraph = useCallback((payload: { nodes?: Node[]; edges?: Edge[] }) => {
    if (!payload || !Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) {
      alert('画布数据格式不正确')
      return
    }

    const normalizedNodes = payload.nodes.map((node) => normalizeCanvasNode(node))

    takeSnapshot()
    setNodes(normalizedNodes)
    setEdges(payload.edges)
    resetSystemStats()
    nodesRef.current = normalizedNodes
    edgesRef.current = payload.edges
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
    link.download = `computeflow-canvas-${Date.now()}.json`
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
