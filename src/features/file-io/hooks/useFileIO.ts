import { readCanvasDocument, type CanvasDocument } from '../canvasDocument'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { useCallback } from 'react'
import type { ChangeEvent, MutableRefObject } from 'react'
import type { Edge, Node } from 'reactflow'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { stripState } from '@/features/canvas/canvas.utils'

/** Parameters for the `useFileIO` hook. */
type UseFileIOParams = {
  storageKey: string
  fileInputRef: MutableRefObject<HTMLInputElement | null>
  nodesRef: MutableRefObject<Node[]>
  edgesRef: MutableRefObject<Edge[]>
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  takeSnapshot: () => void
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
 * @param root0.takeSnapshot - Pushes the current state onto the undo stack.
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
  takeSnapshot,
  normalizeCanvasNode,
  resetSystemStats,
}: UseFileIOParams) {
  const serializeGraph = useCallback((): CanvasDocument => {
    return {
      version: 4,
      pluginApiVersion: 2,
      environment: useSettingsStore.getState().units,
      registry: (() => { const { categories, overrides, entries } = useGlobalResourceTable.getState(); return { categories, overrides, entries } })(),
      ui: {
        nodes: stripState(nodesRef.current.map((node) => {
          const data = { ...node.data }
          delete data._computed
          delete data.machines_exact
          delete data.machines_actual
          delete data.utilization
          delete data.actual_amounts
          return { ...node, data: node.type === 'recipeNode' ? { label: useRecipeStore.getState().recipes[node.id]?.machine_name } : data }
        })),
        edges: stripState(JSON.parse(JSON.stringify(edgesRef.current))),
      },
      domain: {
        recipes: useRecipeStore.getState().dumpAll(),
      },
    }
  }, [edgesRef, nodesRef])

  const loadGraph = useCallback((payload: unknown) => {
    const { document, warnings } = readCanvasDocument(payload)
    takeSnapshot()
    useSettingsStore.getState().setEnvironment(document.environment)
    useGlobalResourceTable.getState().restore(document.registry)
    useRecipeStore.setState({ recipes: {} })
    useRecipeStore.getState().loadAll(document.domain.recipes)
    const normalizedNodes = document.ui.nodes.map(normalizeCanvasNode)
    setNodes(normalizedNodes)
    setEdges(document.ui.edges)
    resetSystemStats()
    nodesRef.current = normalizedNodes
    edgesRef.current = document.ui.edges
    if (warnings.length) alert(warnings.join('\n'))

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
