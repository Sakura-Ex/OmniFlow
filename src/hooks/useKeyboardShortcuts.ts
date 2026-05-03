import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { Edge, Node } from 'reactflow'

type UseKeyboardShortcutsParams = {
  nodesRef: MutableRefObject<Node[]>
  edgesRef: MutableRefObject<Edge[]>
  setNodes: Dispatch<SetStateAction<Node[]>>
  setEdges: Dispatch<SetStateAction<Edge[]>>
  takeSnapshot: () => void
  undo: () => void
  redo: () => void
  handleSelectAll: () => void
  handleClearSelection: () => void
  handleCopy: () => Promise<void>
  handleCut: () => Promise<void>
  handlePaste: () => Promise<void>
  handleDuplicate: () => void
}

export function useKeyboardShortcuts({
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  takeSnapshot,
  undo,
  redo,
  handleSelectAll,
  handleClearSelection,
  handleCopy,
  handleCut,
  handlePaste,
  handleDuplicate,
}: UseKeyboardShortcutsParams) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        handleSelectAll()
      } else if (e.key === 'Escape') {
        handleClearSelection()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        void handleCopy()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault()
        void handleCut()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        void handlePaste()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        handleDuplicate()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        redo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const toRemoveNodes = nodesRef.current.filter((n) => n.selected).map((n) => n.id)
        const toRemoveEdges = edgesRef.current.filter((edge) => edge.selected).map((edge) => edge.id)

        if (toRemoveNodes.length === 0 && toRemoveEdges.length === 0) return

        takeSnapshot()
        if (toRemoveNodes.length > 0) {
          setNodes((prev) => prev.filter((n) => !toRemoveNodes.includes(n.id)))
          setEdges((es) => es.filter((edge) => !toRemoveNodes.includes(edge.source) && !toRemoveNodes.includes(edge.target)))
        }
        if (toRemoveEdges.length > 0) {
          setEdges((es) => es.filter((edge) => !toRemoveEdges.includes(edge.id)))
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    edgesRef,
    handleClearSelection,
    handleCopy,
    handleCut,
    handleDuplicate,
    handlePaste,
    handleSelectAll,
    nodesRef,
    redo,
    setEdges,
    setNodes,
    takeSnapshot,
    undo,
  ])
}
