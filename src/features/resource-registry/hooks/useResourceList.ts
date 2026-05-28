import { useState, useCallback } from 'react'
import type { RoutingMode } from '@/common/types/resource'
import { toggleRouting } from '@/features/canvas/canvas.utils'

export function useResourceList<T extends { _uid?: string; routing_mode?: RoutingMode }>(initial: T[]) {
  const [items, setItems] = useState<T[]>(initial)

  const updateAtIndex = useCallback((index: number, patch: Partial<T>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }, [])

  const add = useCallback((factory: () => T) => {
    setItems((prev) => [...prev, factory()])
  }, [])

  const removeAtIndex = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const toggleRoutingAtIndex = useCallback((index: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        const entry = item as Record<string, unknown>
        if (entry.routing_locked) return item
        return toggleRouting(item)
      }),
    )
  }, [])

  return { items, setItems, updateAtIndex, add, removeAtIndex, toggleRoutingAtIndex }
}
