import type { ResourceCategoryDef, ResourceEntry, ResolvedResourceProps, UnitOverride, GlobalResourceTableState } from './types'
import { DEFAULT_RESOURCE_CATEGORIES, DEFAULT_OVERRIDES } from './defaults'
import { DEFAULT_RESOURCE_CATEGORY } from '../utils/resourceIdentifier'
import { create } from 'zustand'

const cache = new Map<string, ResolvedResourceProps>()

const initialCategories: Record<string, ResourceCategoryDef> = {}
DEFAULT_RESOURCE_CATEGORIES.forEach((cat) => {
  initialCategories[cat.id] = cat
})

const initialOverrides: Record<string, UnitOverride> = { ...DEFAULT_OVERRIDES }

const initialEntries: Record<string, ResourceEntry> = {}

export const useGlobalResourceTable = create<GlobalResourceTableState>((set, get) => ({
  categories: initialCategories,
  overrides: initialOverrides,
  entries: initialEntries,

  addCategory: (def) => set((state) => {
    const next = { ...state.categories, [def.id]: def }
    cache.clear()
    return { categories: next }
  }),

  updateCategory: (id, patch) => set((state) => {
    const next = { ...state.categories, [id]: { ...state.categories[id], ...patch } }
    cache.clear()
    return { categories: next }
  }),

  removeCategory: (id) => set((state) => {
    const next = { ...state.categories }
    delete next[id]
    cache.clear()
    return { categories: next }
  }),

  setOverride: (fullId, def) => set((state) => {
    const next = { ...state.overrides, [fullId]: def }
    cache.clear()
    return { overrides: next }
  }),

  removeOverride: (fullId) => set((state) => {
    const next = { ...state.overrides }
    delete next[fullId]
    cache.clear()
    return { overrides: next }
  }),

  ensureEntry: (fullId) => set((state) => {
    if (state.entries[fullId]) return state
    const next = { ...state.entries, [fullId]: { fullId } }
    cache.clear()
    return { entries: next }
  }),

  setEntry: (fullId, patch) => set((state) => {
    const next = { ...state.entries, [fullId]: { ...state.entries[fullId], ...patch, fullId } }
    cache.clear()
    return { entries: next }
  }),

  removeEntry: (fullId) => set((state) => {
    const next = { ...state.entries }
    delete next[fullId]
    cache.clear()
    return { entries: next }
  }),

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

export function resolveResourceProps(fullId: string): ResolvedResourceProps {
  return useGlobalResourceTable.getState().resolve(fullId)
}
