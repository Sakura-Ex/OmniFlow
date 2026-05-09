import { create } from 'zustand'
import type { ResourceCategoryDef, ResourceRegistryState, ResourceOverride } from './types'
import { DEFAULT_RESOURCE_CATEGORIES, ResourceOverrideRegistry } from './defaults'
import { loadFromStorage, saveToStorage } from '../utils/storage'

const STORAGE_KEY = 'omniflow.resource_registry.v4'

type PersistedState = {
  categories: Record<string, ResourceCategoryDef>
  overrides: Record<string, ResourceOverride>
}

function buildInitial(): PersistedState {
  const persisted = loadFromStorage(STORAGE_KEY, {} as PersistedState)

  const categories: Record<string, ResourceCategoryDef> = {}
  for (const def of DEFAULT_RESOURCE_CATEGORIES) {
    categories[def.id] = persisted.categories?.[def.id] ?? def
  }
  for (const [id, def] of Object.entries(persisted.categories ?? {})) {
    if (!categories[id]) categories[id] = def
  }

  const overrides: Record<string, ResourceOverride> = { ...ResourceOverrideRegistry }
  for (const [id, def] of Object.entries(persisted.overrides ?? {})) {
    overrides[id] = def
  }

  return { categories, overrides }
}

function saveAll(
  categories: Record<string, ResourceCategoryDef>,
  overrides: Record<string, ResourceOverride>,
) {
  saveToStorage(STORAGE_KEY, { categories, overrides })
}

export const useResourceRegistry = create<ResourceRegistryState>((set, get) => ({
  ...buildInitial(),

  addCategory: (def) => {
    set((state) => {
      const next = { ...state.categories, [def.id]: def }
      saveAll(next, state.overrides)
      return { categories: next }
    })
  },

  updateCategory: (id, patch) => {
    set((state) => {
      const existing = state.categories[id]
      if (!existing) return state
      const next = { ...state.categories, [id]: { ...existing, ...patch } }
      saveAll(next, state.overrides)
      return { categories: next }
    })
  },

  removeCategory: (id) => {
    set((state) => {
      const next = { ...state.categories }
      delete next[id]
      saveAll(next, state.overrides)
      return { categories: next }
    })
  },

  getCategory: (id) => get().categories[id],

  setOverride: (id, def) => {
    set((state) => {
      const next = { ...state.overrides, [id]: def }
      saveAll(state.categories, next)
      return { overrides: next }
    })
  },

  removeOverride: (id) => {
    set((state) => {
      const next = { ...state.overrides }
      delete next[id]
      saveAll(state.categories, next)
      return { overrides: next }
    })
  },
}))
