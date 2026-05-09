import type { ResourceCategoryDef, ResourceEntry, ResolvedResourceProps, UnitOverride, GlobalResourceTableState } from './types'
import { DEFAULT_RESOURCE_CATEGORIES, DEFAULT_OVERRIDES } from './defaults'
import { loadFromStorage, saveToStorage } from '../utils/storage'
import { create } from 'zustand'

const STORAGE_KEY = 'omniflow.global_resource_table.v2'

const cache = new Map<string, ResolvedResourceProps>()

const initialCategories: Record<string, ResourceCategoryDef> = {}
DEFAULT_RESOURCE_CATEGORIES.forEach((cat) => {
  initialCategories[cat.id] = cat
})

type Persisted = {
  categories?: Record<string, ResourceCategoryDef>
  overrides?: Record<string, UnitOverride>
  entries?: Record<string, ResourceEntry>
}
const persisted = loadFromStorage(STORAGE_KEY, {} as Persisted)

for (const [id, def] of Object.entries(persisted.categories ?? {})) {
  initialCategories[id] = def
}

const initialOverrides: Record<string, UnitOverride> = { ...DEFAULT_OVERRIDES }
for (const [id, ov] of Object.entries(persisted.overrides ?? {})) {
  initialOverrides[id] = ov
}

const initialEntries: Record<string, ResourceEntry> = {}
for (const [id, entry] of Object.entries(persisted.entries ?? {})) {
  initialEntries[id] = entry
}

function persistAll(
  categories: Record<string, ResourceCategoryDef>,
  overrides: Record<string, UnitOverride>,
  entries: Record<string, ResourceEntry>,
) {
  saveToStorage(STORAGE_KEY, { categories, overrides, entries })
  cache.clear()
}

export const useGlobalResourceTable = create<GlobalResourceTableState>((set, get) => ({
  categories: initialCategories,
  overrides: initialOverrides,
  entries: initialEntries,

  addCategory: (def) => set((state) => {
    const next = { ...state.categories, [def.id]: def }
    persistAll(next, state.overrides, state.entries)
    return { categories: next }
  }),

  updateCategory: (id, patch) => set((state) => {
    const next = { ...state.categories, [id]: { ...state.categories[id], ...patch } }
    persistAll(next, state.overrides, state.entries)
    return { categories: next }
  }),

  removeCategory: (id) => set((state) => {
    const next = { ...state.categories }
    delete next[id]
    persistAll(next, state.overrides, state.entries)
    return { categories: next }
  }),

  setOverride: (fullId, def) => set((state) => {
    const next = { ...state.overrides, [fullId]: def }
    persistAll(state.categories, next, state.entries)
    return { overrides: next }
  }),

  removeOverride: (fullId) => set((state) => {
    const next = { ...state.overrides }
    delete next[fullId]
    persistAll(state.categories, next, state.entries)
    return { overrides: next }
  }),

  ensureEntry: (fullId) => set((state) => {
    if (state.entries[fullId]) return state
    const next = { ...state.entries, [fullId]: { fullId } }
    persistAll(state.categories, state.overrides, next)
    return { entries: next }
  }),

  setEntry: (fullId, patch) => set((state) => {
    const next = { ...state.entries, [fullId]: { ...state.entries[fullId], ...patch, fullId } }
    persistAll(state.categories, state.overrides, next)
    return { entries: next }
  }),

  removeEntry: (fullId) => set((state) => {
    const next = { ...state.entries }
    delete next[fullId]
    persistAll(state.categories, state.overrides, next)
    return { entries: next }
  }),

  resolve: (fullId) => {
    const cached = cache.get(fullId)
    if (cached) return cached

    const colonIndex = fullId.indexOf(':')
    const categoryId = colonIndex === -1 ? 'item' : fullId.slice(0, colonIndex)

    const state = get()
    const category = state.categories[categoryId]
    const override = state.overrides[fullId]
    const entry = state.entries[fullId]

    const result: ResolvedResourceProps = {
      unit: override?.unit_override ?? category?.base_unit ?? '?',
      themeColor: category?.themeColor ?? 'gray',
      displayName: entry?.displayName ?? fullId,
      preferred_time_base: category?.preferred_time_base ?? 'per_second',
      is_unknown: !category,
    }

    cache.set(fullId, result)
    return result
  },
}))

export function resolveResourceProps(fullId: string): ResolvedResourceProps {
  return useGlobalResourceTable.getState().resolve(fullId)
}
