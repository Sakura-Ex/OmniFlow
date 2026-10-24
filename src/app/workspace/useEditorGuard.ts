import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createEditorGuard } from './editorGuard'

/** Coordinate navigation around the active editor without owning its form data.
 * @returns Draft registration, guarded navigation and three-way leave actions.
 */
export function useEditorGuard() {
  const [controller] = useState(createEditorGuard)
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const lastEditorFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const remember = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('[data-workspace-properties]')) lastEditorFocus.current = event.target
    }
    document.addEventListener('focusin', remember)
    return () => document.removeEventListener('focusin', remember)
  }, [])
  useEffect(() => {
    if (!state.returnFocus) return
    // Run after the modal's cleanup restores its trigger so the invalid editor wins focus.
    const frame = requestAnimationFrame(() => {
      const panel = document.querySelector('[data-workspace-properties]')
      const invalid = panel?.querySelector<HTMLElement>('[aria-invalid="true"], input:invalid, [role="alert"]')
      const previous = lastEditorFocus.current?.isConnected ? lastEditorFocus.current : null
      const target = (state.failed ? invalid : null) ?? previous ?? panel?.querySelector<HTMLElement>('input, button')
      if (target) { if (!target.matches('input, button, select, textarea, [tabindex]')) target.tabIndex = -1; target.focus({ preventScroll: true }) }
    })
    return () => cancelAnimationFrame(frame)
  }, [state.failed, state.returnFocus])
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (!controller.hasDraft()) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', leave)
    return () => window.removeEventListener('beforeunload', leave)
  }, [controller])
  return { ...controller, ...state }
}
