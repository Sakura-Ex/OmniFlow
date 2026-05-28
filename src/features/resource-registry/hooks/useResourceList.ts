import { useState, useCallback } from 'react'
import type { RoutingMode } from '@/common/types/resource'
import { toggleRouting } from '@/features/canvas/canvas.utils'

/**
 * Manages a mutable list of resource items with helpers for update, add, remove and routing toggle.
 *
 * @param initial – The initial array of resource items.
 * @returns An object containing:
 *  - `items` – the current list.
 *  - `setItems` – replace the entire list.
 *  - `updateAtIndex` – apply a partial patch at a given index.
 *  - `add` – append a new item created by the supplied factory.
 *  - `removeAtIndex` – remove an item at a given index.
 *  - `toggleRoutingAtIndex` – cycle the routing mode of an item (unless `routing_locked`).
 */
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
