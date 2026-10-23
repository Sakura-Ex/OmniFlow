/** Dependencies for a synchronous, semantic document history. */
interface HistoryOptions<T> {
  capture: () => T
  restore: (snapshot: T) => void
  limit?: number
}

/**
 * Keep history mutations synchronous and independent of React scheduling.
 * @param options - Document capture/restore and bounded history capacity.
 * @param options.capture - Capture the authoritative document state.
 * @param options.restore - Restore a previously captured document.
 * @param options.limit - Maximum number of undo entries.
 * @returns A history controller with atomic commits and observable revision.
 */
export function createHistory<T>({ capture, restore, limit = 20 }: HistoryOptions<T>) {
  let past: T[] = [], future: T[] = [], revision = 0
  const listeners = new Set<() => void>()
  const changed = () => { revision++; listeners.forEach(listener => listener()) }
  const equal = (a: T, b: T) => JSON.stringify(a) === JSON.stringify(b)
  const record = (before: T) => {
    future = []
    if (!past.length || !equal(past[past.length - 1], before)) past = [...past, before].slice(-Math.max(1, limit))
    changed()
  }
  return {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    getRevision: () => revision,
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    takeSnapshot: () => record(capture()),
    commit: (action: () => void) => {
      const before = capture()
      try { action() } catch (error) { restore(before); throw error }
      if (!equal(before, capture())) record(before)
    },
    clear: () => { past = []; future = []; changed() },
    undo: () => {
      if (!past.length) return
      const target = past[past.length - 1], current = capture()
      restore(target)
      past = past.slice(0, -1); future = [current, ...future]; changed()
    },
    redo: () => {
      if (!future.length) return
      const target = future[0], current = capture()
      restore(target)
      future = future.slice(1); past = [...past, current].slice(-Math.max(1, limit)); changed()
    },
  }
}
