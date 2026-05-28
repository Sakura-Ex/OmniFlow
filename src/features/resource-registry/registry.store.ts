import { create } from 'zustand'
import type { ResourceCategoryDef, ResourceEntry, ResolvedResourceProps, UnitOverride, GlobalResourceTableState } from '@/common/types/registry'
import { DEFAULT_RESOURCE_CATEGORIES, DEFAULT_OVERRIDES } from './registry.defaults'
import { DEFAULT_RESOURCE_CATEGORY } from '@/common/utils/resourceId'

const cache = new Map<string, ResolvedResourceProps>()

const initialCategories: Record<string, ResourceCategoryDef> = {}
DEFAULT_RESOURCE_CATEGORIES.forEach((cat) => {
  initialCategories[cat.id] = cat
})

const initialOverrides: Record<string, UnitOverride> = { ...DEFAULT_OVERRIDES }

const initialEntries: Record<string, ResourceEntry> = {}

/**
 * Zustand store that manages the global resource table, including resource
 * categories, per-resource unit overrides, and tracked resource entries.
 */
export const useGlobalResourceTable = create<GlobalResourceTableState>((set, get) => ({
  categories: initialCategories,
  overrides: initialOverrides,
  entries: initialEntries,

  /**
   * Add a new resource category definition.
   * @param def - The category definition to add.
   * @returns The updated state.
   */
  addCategory: (def) => set((state) => {
    const next = { ...state.categories, [def.id]: def }
    cache.clear()
    return { categories: next }
  }),

  /**
   * Partially update an existing resource category.
   * @param id - The category ID.
   * @param patch - The partial category definition to merge.
   * @returns The updated state.
   */
  updateCategory: (id, patch) => set((state) => {
    const next = { ...state.categories, [id]: { ...state.categories[id], ...patch } }
    cache.clear()
    return { categories: next }
  }),

  /**
   * Remove a resource category by its ID.
   * @param id - The category ID to remove.
   * @returns The updated state.
   */
  removeCategory: (id) => set((state) => {
    const next = { ...state.categories }
    delete next[id]
    cache.clear()
    return { categories: next }
  }),

  /**
   * Set a unit override for a fully qualified resource ID.
   * @param fullId - The fully qualified resource ID.
   * @param def - The override definition.
   * @returns The updated state.
   */
  setOverride: (fullId, def) => set((state) => {
    const next = { ...state.overrides, [fullId]: def }
    cache.clear()
    return { overrides: next }
  }),

  /**
   * Remove a unit override for a fully qualified resource ID.
   * @param fullId - The fully qualified resource ID to remove.
   * @returns The updated state.
   */
  removeOverride: (fullId) => set((state) => {
    const next = { ...state.overrides }
    delete next[fullId]
    cache.clear()
    return { overrides: next }
  }),

  /**
   * Ensure a resource entry exists in the table (creates it if missing).
   * @param fullId - The fully qualified resource ID to ensure.
   * @returns The updated state.
   */
  ensureEntry: (fullId) => set((state) => {
    if (state.entries[fullId]) return state
    const next = { ...state.entries, [fullId]: { fullId } }
    cache.clear()
    return { entries: next }
  }),

  /**
   * Set or update a resource entry's metadata.
   * @param fullId - The fully qualified resource ID.
   * @param patch - The partial entry data to merge.
   * @returns The updated state.
   */
  setEntry: (fullId, patch) => set((state) => {
    const next = { ...state.entries, [fullId]: { ...state.entries[fullId], ...patch, fullId } }
    cache.clear()
    return { entries: next }
  }),

  /**
   * Remove a resource entry from the table.
   * @param fullId - The fully qualified resource ID to remove.
   * @returns The updated state.
   */
  removeEntry: (fullId) => set((state) => {
    const next = { ...state.entries }
    delete next[fullId]
    cache.clear()
    return { entries: next }
  }),

  /**
   * Resolve the display properties (unit, colour, display name, etc.) for a
   * fully qualified resource ID. Results are cached in an LRU-like map.
   * @param fullId - The fully qualified resource ID.
   * @returns The resolved resource properties.
   */
  resolve: (fullId) => {
    const cached = cache.get(fullId)
    if (cached) return cached

    const colonIndex = fullId.indexOf(':')
    const categoryId = colonIndex === -1 ? DEFAULT_RESOURCE_CATEGORY : fullId.slice(0, colonIndex)

    const state = get()
    const category = state.categories[categoryId]
    const override = state.overrides[fullId]
    const entry = state.entries[fullId]

    const result: ResolvedResourceProps = {
      unit: override?.unit_override ?? category?.base_unit ?? '?',
      themeColor: category?.themeColor ?? 'gray',
      displayName: entry?.displayName ?? fullId,
      preferred_time_base: category?.preferred_time_base ?? 'rate_per_sec',
      is_unknown: !category,
    }

    cache.set(fullId, result)
    return result
  },
}))

/**
 * Convenience function to resolve resource display properties without
 * subscribing to the store. Calls `resolve` on the current store state.
 * @param fullId - Fully qualified resource ID (e.g. `item:iron_ingot`).
 * @returns The resolved resource properties.
 */
export function resolveResourceProps(fullId: string): ResolvedResourceProps {
  return useGlobalResourceTable.getState().resolve(fullId)
}
