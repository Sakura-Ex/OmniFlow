import { useEffect, type RefObject } from 'react'

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
