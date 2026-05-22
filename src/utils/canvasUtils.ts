import type { Resource } from '../types/types'

export function stripState<T extends { selected?: boolean; dragging?: boolean }>(items: T[]): T[] {
  return items.map((item) => {
    const { selected, dragging, ...rest } = item
    void selected
    void dragging
    return rest as unknown as T
  })
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export function toggleRouting<T extends { routing_mode?: 'wired' | 'global' }>(item: T): T {
  const clone = { ...item }
  clone.routing_mode = clone.routing_mode === 'global' ? 'wired' : 'global'
  return clone
}

export function resolveAutoMode(data: { mode?: string; is_virtual?: boolean }): boolean {
  if (data.mode === 'auto' || data.mode === 'infinite' || data.mode === 'maximize' || data.mode === 'overflow') return true
  if (data.mode === 'limit' || data.mode === 'demand') return false
  if (typeof data.is_virtual === 'boolean') return data.is_virtual
  return true
}

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
