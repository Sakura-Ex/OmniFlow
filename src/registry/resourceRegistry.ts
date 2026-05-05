import { create } from 'zustand'
import type { ResourceCategoryDef, ResourceRegistryState } from './types'
import { DEFAULT_RESOURCE_CATEGORIES } from './defaults'

const STORAGE_KEY = 'omniflow.resource_registry.v1'

function loadPersisted(): Record<string, ResourceCategoryDef> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null) return parsed
    }
  } catch {
    // ignore corrupted storage
  }
  return {}
}

function persist(categories: Record<string, ResourceCategoryDef>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))
  } catch {
    // ignore quota errors
  }
}

function buildInitial(): Record<string, ResourceCategoryDef> {
  const persisted = loadPersisted()
  const merged: Record<string, ResourceCategoryDef> = {}

  for (const def of DEFAULT_RESOURCE_CATEGORIES) {
    merged[def.id] = persisted[def.id] ?? def
  }

  for (const [id, def] of Object.entries(persisted)) {
    if (!merged[id]) merged[id] = def
  }

  return merged
}

export const useResourceRegistry = create<ResourceRegistryState>((set, get) => ({
  categories: buildInitial(),

  addCategory: (def) => {
    set((state) => {
      const next = { ...state.categories, [def.id]: def }
      persist(next)
      return { categories: next }
    })
  },

  updateCategory: (id, patch) => {
    set((state) => {
      const existing = state.categories[id]
      if (!existing) return state
      const next = { ...state.categories, [id]: { ...existing, ...patch } }
      persist(next)
      return { categories: next }
    })
  },

  removeCategory: (id) => {
    set((state) => {
      const next = { ...state.categories }
      delete next[id]
      persist(next)
      return { categories: next }
    })
  },

  getCategory: (id) => {
    return get().categories[id]
  },
}))
