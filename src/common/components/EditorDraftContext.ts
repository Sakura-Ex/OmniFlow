import { createContext, useContext, useLayoutEffect } from 'react'

/** A mounted editor owns its draft; containers only coordinate leaving it. */
export type EditorDraft = {
  dirty: boolean
  save: () => boolean | Promise<boolean>
  discard: () => void
}

export const EditorDraftContext = createContext<((draft: EditorDraft | null) => void) | null>(null)

/** Register the latest draft actions before the next user interaction.
 * @param draft - Current unsaved state and validated commit/reset operations.
 */
export function useEditorDraft(draft: EditorDraft) {
  const register = useContext(EditorDraftContext)
  useLayoutEffect(() => {
    register?.(draft)
    return () => register?.(null)
  }, [register, draft])
}
