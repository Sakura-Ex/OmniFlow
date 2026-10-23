import { stripCalculationResults } from '@/common/utils/calculationState'
import { t } from '@/common/i18n'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { remapNetworkConfiguration } from '@/features/calculation/networkConfig'
import { readClipboardDocument } from '../clipboardDocument'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import type { CanvasDocument } from '../canvasDocument'
import { cloneSubgraph } from '@/features/canvas/cloneSubgraph'
import { useCallback, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import { stripState } from '@/features/canvas/canvas.utils'
import { useRecipeStore } from '@/features/recipe/recipe.store'

/** Shape of the clipboard serialisation payload. */
type ClipboardPayload = CanvasDocument

/** Parameters for the `useClipboard` hook. */
type UseClipboardParams = {
  nodesRef: MutableRefObject<Node[]>
  edgesRef: MutableRefObject<Edge[]>
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  takeSnapshot: () => void
  onDeleteSelected: () => void
}

/**
 * Provides clipboard operations — copy, cut, paste, and duplicate — for
 * selected nodes and edges.
 *
 * @param root0 - Hook parameters.
 * @param root0.nodesRef - Mutable ref holding the current node array.
 * @param root0.edgesRef - Mutable ref holding the current edge array.
 * @param root0.setNodes - State setter for nodes.
 * @param root0.setEdges - State setter for edges.
 * @param root0.takeSnapshot - Pushes the current state onto the undo stack.
 * @param root0.onDeleteSelected - Callback that deletes the currently selected items.
 * @returns An object with {@link handleCopy}, {@link handlePaste},
 *          {@link handleCut} and {@link handleDuplicate}.
 */
export function useClipboard({
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  takeSnapshot,
  onDeleteSelected,
}: UseClipboardParams) {
  const copyBufferRef = useRef<ClipboardPayload | null>(null)
  const pasteCountRef = useRef(0)

  const collectSelection = useCallback(() => {
    const selectedNodes = nodesRef.current.filter((node) => node.selected)
    const selectedNodeIds = new Set(selectedNodes.map((node) => node.id))
    const selectedEdges = edgesRef.current.filter(
      (edge) => edge.selected || (selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target))
    )
    return { selectedNodes, selectedEdges }
  }, [edgesRef, nodesRef])

  const buildCopyPayload = useCallback((): ClipboardPayload | null => {
    try {
      const { selectedNodes, selectedEdges } = collectSelection()
      if (selectedNodes.length === 0) return null

      const recipes = useRecipeStore.getState().dumpAll()
      const enrichedNodes = selectedNodes.map((node) => {
        if (node.type === 'recipeNode' && recipes[node.id]) {
          return { ...node, data: stripCalculationResults(recipes[node.id]) }
        }
        return { ...node, data: stripCalculationResults(node.data) }
      })

      const { categories, overrides, entries } = useGlobalResourceTable.getState()
      return structuredClone({
        version: 5, pluginApiVersion: 2,
        networkConfiguration: (() => {
          const configuration = useCanvasStore.getState().networkConfiguration
          const ids = new Set(selectedNodes.map((node) => node.id))
          const nodeIds = Object.fromEntries(selectedNodes.map((node) => [node.id, node.id]))
          const addresses = Object.fromEntries(Object.keys(configuration.ports).filter((key) => ids.has(JSON.parse(key)[0])).map((key) => [key, key]))
          return remapNetworkConfiguration(configuration, nodeIds, addresses)
        })(),
        environment: useSettingsStore.getState().units,
        registry: { categories, overrides, entries },
        ui: { nodes: stripState(JSON.parse(JSON.stringify(enrichedNodes))), edges: stripState(JSON.parse(JSON.stringify(selectedEdges))) },
        domain: { recipes: Object.fromEntries(selectedNodes.filter((n) => n.type === 'recipeNode').map((n) => [n.id, recipes[n.id] ?? n.data])) },
      })
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error))
      return null
    }
  }, [collectSelection])

  const writePayload = useCallback(async (payload: ClipboardPayload) => {
    copyBufferRef.current = payload

    try {
      await navigator.clipboard?.writeText(JSON.stringify(payload))
    } catch (error) {
      console.warn('clipboard write failed', error)
    }
  }, [])

  const handleCopy = useCallback(async () => {
    const payload = buildCopyPayload()
    if (payload) await writePayload(payload)
  }, [buildCopyPayload, writePayload])

  const pastePayload = useCallback((payload: ClipboardPayload, offset: number) => {
    if (!payload.ui.nodes.length) return

    const cloned = cloneSubgraph(payload.ui.nodes, payload.ui.edges, offset)
    const { nodes: nextNodes, edges: nextEdges } = cloned
    for (const address of Object.keys(payload.networkConfiguration.ports)) {
      const [nodeId, portId] = JSON.parse(address) as [string, string]
      if (cloned.nodeIds[nodeId]) cloned.portAddresses[address] = JSON.stringify([cloned.nodeIds[nodeId], cloned.remapPort(nodeId, portId)])
    }
    const copied = remapNetworkConfiguration(payload.networkConfiguration, cloned.nodeIds, cloned.portAddresses)
    const current = useCanvasStore.getState().networkConfiguration
    useCanvasStore.getState().setNetworkConfiguration({ ...current, ports: { ...current.ports, ...copied.ports }, machines: { ...current.machines, ...copied.machines } })

    const clearedNodes = nodesRef.current.map((node) => ({ ...node, selected: false }))
    const clearedEdges = edgesRef.current.map((edge) => ({ ...edge, selected: false }))
    const mergedNodes = [...clearedNodes, ...nextNodes]
    const mergedEdges = [...clearedEdges, ...nextEdges]

    nextNodes.forEach((node) => {
      if (node.type === 'recipeNode' && node.data) {
        useRecipeStore.getState().setRecipe(node.id, node.data as RecipeNodeData)
      }
    })

    setNodes(mergedNodes)
    setEdges(mergedEdges)
    nodesRef.current = mergedNodes
    edgesRef.current = mergedEdges
  }, [edgesRef, nodesRef, setEdges, setNodes])

  const handlePaste = useCallback(async () => {
    let payload: ClipboardPayload | null
    let text: string | undefined
    try {
      if (navigator.clipboard?.readText) text = await navigator.clipboard.readText()
    } catch {
      // A denied/unavailable system clipboard may use this tab's explicit copy.
    }
    if (text === undefined) payload = copyBufferRef.current
    else {
      if (!text.trim()) { alert(t('shell.clipboardEmpty')); return }
      try { payload = readClipboardDocument(JSON.parse(text), useSettingsStore.getState().units) }
      catch (error) { alert(error instanceof Error ? error.message : String(error)); return }
    }
    if (!payload) return
    try { payload = readClipboardDocument(payload, useSettingsStore.getState().units) }
    catch (error) { alert(error instanceof Error ? error.message : String(error)); return }
    takeSnapshot()
    pasteCountRef.current += 1
    pastePayload(payload, 30 * pasteCountRef.current)
  }, [pastePayload, takeSnapshot])

  const handleCut = useCallback(async () => {
    const payload = buildCopyPayload()
    if (!payload) return
    const copy = writePayload(payload)
    onDeleteSelected()
    await copy
  }, [buildCopyPayload, writePayload, onDeleteSelected])

  const handleDuplicate = useCallback(() => {
    const payload = buildCopyPayload()
    if (!payload) return
    copyBufferRef.current = payload
    takeSnapshot()
    pasteCountRef.current += 1
    pastePayload(payload, 20 * pasteCountRef.current)
  }, [buildCopyPayload, pastePayload, takeSnapshot])

  return {
    handleCopy,
    handlePaste,
    handleCut,
    handleDuplicate,
  }
}
