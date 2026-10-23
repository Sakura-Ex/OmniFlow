/**
 * Strip transient UI state (`selected`, `dragging`) from an array of items.
 * @param items - Array of items potentially carrying UI state.
 * @returns A new array with `selected` and `dragging` removed.
 */
export function stripState<T extends { selected?: boolean; dragging?: boolean }>(items: T[]): T[] {
  return items.map((item) => {
    const { selected, dragging, ...rest } = item
    void selected
    void dragging
    return rest as unknown as T
  })
}

/**
 * Deep-clone a value via JSON serialisation/deserialisation.
 * @param obj - The value to clone.
 * @returns A deeply-cloned copy.
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Resolve whether a source/target node operates in automatic (unlimited) mode.
 * @param data - An object with an optional `mode` and `is_virtual` field.
 * @param data.mode
 * @param data.is_virtual
 * @returns `true` when the mode is neither `'limit'` nor `'demand'`, or when `is_virtual` is set.
 */
export function resolveAutoMode(data: { mode?: string; is_virtual?: boolean }): boolean {
  if (data.mode === 'auto' || data.mode === 'infinite' || data.mode === 'maximize' || data.mode === 'overflow') return true
  if (data.mode === 'limit' || data.mode === 'demand') return false
  if (typeof data.is_virtual === 'boolean') return data.is_virtual
  return true
}
