import { useEffect } from 'react'

/** Parameters for the `useKeyboardShortcuts` hook. */
type UseKeyboardShortcutsParams = {
  takeSnapshot: () => void
  undo: () => void
  redo: () => void
  handleSelectAll: () => void
  handleClearSelection: () => void
  handleCopy: () => Promise<void>
  handleCut: () => Promise<void>
  handlePaste: () => Promise<void>
  handleDuplicate: () => void
  onDelete: () => void
  isEditing: boolean
}

/**
 * Registers global keyboard shortcuts for canvas actions (Ctrl+Z/Y, Ctrl+C/V,
 * Ctrl+D, Ctrl+A, Delete, Escape, etc.).
 *
 * @param root0 - Hook parameters.
 * @param root0.takeSnapshot - Pushes the current state onto the undo stack.
 * @param root0.undo - Undo callback.
 * @param root0.redo - Redo callback.
 * @param root0.handleSelectAll - Select-all callback.
 * @param root0.handleClearSelection - Clear-selection callback.
 * @param root0.handleCopy - Copy callback.
 * @param root0.handleCut - Cut callback.
 * @param root0.handlePaste - Paste callback.
 * @param root0.handleDuplicate - Duplicate callback.
 * @param root0.onDelete - Delete-selected callback.
 * @param root0.isEditing - When `true`, keyboard shortcuts are suppressed.
 */
export function useKeyboardShortcuts({
  takeSnapshot,
  undo,
  redo,
  handleSelectAll,
  handleClearSelection,
  handleCopy,
  handleCut,
  handlePaste,
  handleDuplicate,
  onDelete,
  isEditing,
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

      if (isEditing) {
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
        onDelete()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    handleClearSelection,
    handleCopy,
    handleCut,
    handleDuplicate,
    handlePaste,
    handleSelectAll,
    isEditing,
    onDelete,
    redo,
    takeSnapshot,
    undo,
  ])
}
