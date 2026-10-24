import type { EditorDraft } from '@/common/components/EditorDraftContext'

/** The only observable navigation state; form data remains inside the editor. */
export interface EditorGuardState { asking: boolean; saving: boolean; failed: boolean; returnFocus: boolean }

/** Serialize guarded navigation so duplicate selection events cannot replace a pending action.
 * @returns A draft registry and navigation controller with an observable state.
 */
export function createEditorGuard() {
  let draft: EditorDraft | null = null
  let pending: { action: () => void; cancel?: () => void } | null = null
  let state: EditorGuardState = { asking: false, saving: false, failed: false, returnFocus: false }
  const listeners = new Set<() => void>()
  const publish = (next: EditorGuardState) => { state = next; listeners.forEach(listener => listener()) }
  const finish = (accepted: boolean, failed = false) => {
    const navigation = pending
    pending = null
    publish({ asking: false, saving: false, failed, returnFocus: !accepted })
    if (accepted) navigation?.action()
    else navigation?.cancel?.()
  }
  return {
    register: (next: EditorDraft | null) => { draft = next },
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    hasDraft: () => Boolean(draft?.dirty),
    request: (action: () => void, cancel?: () => void) => {
      if (pending) return
      if (!draft?.dirty) { action(); return }
      pending = { action, cancel }
      publish({ asking: true, saving: false, failed: false, returnFocus: false })
    },
    cancel: () => { if (!state.saving) finish(false) },
    discard: () => {
      if (!pending || state.saving) return
      draft?.discard()
      finish(true)
    },
    save: async () => {
      if (!pending || state.saving) return
      const navigation = pending
      const editor = draft
      publish({ asking: true, saving: true, failed: false, returnFocus: false })
      try {
        const saved = await editor?.save()
        if (pending === navigation) finish(Boolean(saved), !saved)
      } catch {
        if (pending === navigation) finish(false, true)
      }
    },
    reset: () => {
      pending = null
      draft = null
      publish({ asking: false, saving: false, failed: false, returnFocus: false })
    },
  }
}
