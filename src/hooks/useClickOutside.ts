import { useEffect, type RefObject } from 'react'

/**
 * Calls `handler` when a mouse-down event occurs outside the referenced element.
 *
 * @param ref     Reference to the element whose bounds define "outside".
 * @param handler Callback invoked on an outside click.
 * @param enabled When `false` the effect is skipped (defaults to `true`).
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  enabled: boolean = true,
) {
  useEffect(() => {
    if (!enabled) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      handler()
    }
    document.addEventListener('mousedown', handleClick, true)
    return () => document.removeEventListener('mousedown', handleClick, true)
  }, [ref, handler, enabled])
}
