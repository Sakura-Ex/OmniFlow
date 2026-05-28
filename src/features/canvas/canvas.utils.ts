import type { Resource, RoutingMode } from '@/common/types/resource'

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
 * Toggle the `routing_mode` between `'global'` and `'wired'`.
 * @param item - An object with an optional `routing_mode` field.
 * @returns A shallow clone with the toggled `routing_mode`.
 */
export function toggleRouting<T extends { routing_mode?: RoutingMode }>(item: T): T {
  const clone = { ...item }
  clone.routing_mode = clone.routing_mode === 'global' ? 'wired' : 'global'
  return clone
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

/**
 * Collect all resources (inputs, outputs, utilities) from a recipe into a flat array.
 * @param recipe - An object with optional resource arrays on four port categories.
 * @param recipe.base_inputs
 * @param recipe.base_outputs
 * @param recipe.base_utility_inputs
 * @param recipe.base_utility_outputs
 * @returns A flat array of all resources referenced by the recipe.
 */
export function flattenRecipeResources(recipe: {
  base_inputs?: Resource[]
  base_outputs?: Resource[]
  base_utility_inputs?: Resource[]
  base_utility_outputs?: Resource[]
}): Resource[] {
  return [
    ...(recipe.base_inputs ?? []),
    ...(recipe.base_outputs ?? []),
    ...(recipe.base_utility_inputs ?? []),
    ...(recipe.base_utility_outputs ?? []),
  ]
}
