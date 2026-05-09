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

export function resolveAutoMode(data: { is_auto?: boolean; is_virtual?: boolean }): boolean {
  if (typeof data.is_auto === 'boolean') return data.is_auto
  if (typeof data.is_virtual === 'boolean') return data.is_virtual
  return true
}

export function flattenRecipeResources<T extends { base_inputs?: T[]; base_outputs?: T[]; base_utility_inputs?: T[]; base_utility_outputs?: T[] }>(recipe: T): T[] {
  return [
    ...(recipe.base_inputs ?? []),
    ...(recipe.base_outputs ?? []),
    ...(recipe.base_utility_inputs ?? []),
    ...(recipe.base_utility_outputs ?? []),
  ]
}
