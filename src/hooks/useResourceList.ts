import { useState, useCallback } from 'react'

export function useResourceList<T extends { _uid?: string }>(initial: T[]) {
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

  const toggleRoutingAtIndex = useCallback((index: number, locked?: boolean) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        const entry = item as Record<string, unknown>
        if (entry.routing_locked) return item
        return { ...item, routing_mode: entry.routing_mode === 'global' ? 'wired' : 'global' } as T
      }),
    )
  }, [])

  return { items, setItems, updateAtIndex, add, removeAtIndex, toggleRoutingAtIndex }
}
