import { useCallback, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import { stripState } from '@/features/canvas/canvas.utils'
import { useRecipeStore } from '@/features/recipe/recipe.store'

/** Shape of the clipboard serialisation payload. */
type ClipboardPayload = {
  nodes: Node[]
  edges: Edge[]
}

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
 * Generate a unique node identifier.
 * @returns A unique node ID string.
 */
function makeId() {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
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
    const { selectedNodes, selectedEdges } = collectSelection()
    if (selectedNodes.length === 0) return null

    const recipes = useRecipeStore.getState().recipes
    const enrichedNodes = selectedNodes.map((node) => {
      if (node.type === 'recipeNode' && recipes[node.id]) {
        return { ...node, data: recipes[node.id] }
      }
      return { ...node }
    })

    return {
      nodes: stripState(JSON.parse(JSON.stringify(enrichedNodes))),
      edges: stripState(JSON.parse(JSON.stringify(selectedEdges))),
    }
  }, [collectSelection])

  const handleCopy = useCallback(async () => {
    const payload = buildCopyPayload()
    if (!payload) return
    copyBufferRef.current = payload

    try {
      await navigator.clipboard?.writeText(JSON.stringify(payload))
    } catch (error) {
      console.warn('clipboard write failed', error)
    }
  }, [buildCopyPayload])

  const pastePayload = useCallback((payload: ClipboardPayload, offset: number) => {
    if (!payload.nodes.length) return

    const idMap = new Map<string, string>()
    const nextNodes = payload.nodes.map((node) => {
      const nextId = makeId()
      idMap.set(node.id, nextId)
      const nextData =
        node.type === 'recipeNode' && node.data?.recipe_id
          ? { ...node.data, recipe_id: `${node.data.recipe_id}_${nextId.slice(-6)}` }
          : node.data
      return {
        ...node,
        id: nextId,
        data: nextData,
        position: {
          x: node.position.x + offset,
          y: node.position.y + offset,
        },
        selected: true,
      }
    })

    const nextEdges = payload.edges.map((edge) => ({
      ...edge,
      id: `e-${makeId()}`,
      source: idMap.get(edge.source) ?? edge.source,
      target: idMap.get(edge.target) ?? edge.target,
      selected: true,
    }))

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
    let payload = copyBufferRef.current
    if (!payload) {
      try {
        const text = await navigator.clipboard?.readText()
        if (text) {
          const parsed = JSON.parse(text)
          if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
            payload = parsed
          }
        }
      } catch (error) {
        console.warn('clipboard read failed', error)
      }
    }

    if (!payload) return
    takeSnapshot()
    pasteCountRef.current += 1
    pastePayload(payload, 30 * pasteCountRef.current)
  }, [pastePayload, takeSnapshot])

  const handleCut = useCallback(async () => {
    await handleCopy()
    onDeleteSelected()
  }, [handleCopy, onDeleteSelected])

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
