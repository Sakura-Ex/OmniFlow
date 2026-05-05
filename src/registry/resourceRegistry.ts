import { create } from 'zustand'
import type { ResourceCategoryDef, ResourceRegistryState, DimensionDef, ResourceOverride } from './types'
import { DEFAULT_RESOURCE_CATEGORIES, DimensionRegistry, ResourceOverrideRegistry } from './defaults'

const STORAGE_KEY = 'omniflow.resource_registry.v2'

type PersistedState = {
  categories: Record<string, ResourceCategoryDef>
  dimensions: Record<string, DimensionDef>
  overrides: Record<string, ResourceOverride>
}

function loadPersisted(): Partial<PersistedState> {
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

function persist(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore quota errors
  }
}

function buildInitial(): PersistedState {
  const persisted = loadPersisted()

  const categories: Record<string, ResourceCategoryDef> = {}
  for (const def of DEFAULT_RESOURCE_CATEGORIES) {
    categories[def.id] = persisted.categories?.[def.id] ?? def
  }
  for (const [id, def] of Object.entries(persisted.categories ?? {})) {
    if (!categories[id]) categories[id] = def
  }

  const dimensions: Record<string, DimensionDef> = { ...DimensionRegistry }
  for (const [id, def] of Object.entries(persisted.dimensions ?? {})) {
    dimensions[id] = def
  }

  const overrides: Record<string, ResourceOverride> = { ...ResourceOverrideRegistry }
  for (const [id, def] of Object.entries(persisted.overrides ?? {})) {
    overrides[id] = def
  }

  return { categories, dimensions, overrides }
}

function saveAll(
  categories: Record<string, ResourceCategoryDef>,
  dimensions: Record<string, DimensionDef>,
  overrides: Record<string, ResourceOverride>,
) {
  persist({ categories, dimensions, overrides })
}

export const useResourceRegistry = create<ResourceRegistryState>((set, get) => ({
  ...buildInitial(),

  addCategory: (def) => {
    set((state) => {
      const next = { ...state.categories, [def.id]: def }
      saveAll(next, state.dimensions, state.overrides)
      return { categories: next }
    })
  },

  updateCategory: (id, patch) => {
    set((state) => {
      const existing = state.categories[id]
      if (!existing) return state
      const next = { ...state.categories, [id]: { ...existing, ...patch } }
      saveAll(next, state.dimensions, state.overrides)
      return { categories: next }
    })
  },

  removeCategory: (id) => {
    set((state) => {
      const next = { ...state.categories }
      delete next[id]
      saveAll(next, state.dimensions, state.overrides)
      return { categories: next }
    })
  },

  getCategory: (id) => get().categories[id],

  setDimension: (id, def) => {
    set((state) => {
      const next = { ...state.dimensions, [id]: def }
      saveAll(state.categories, next, state.overrides)
      return { dimensions: next }
    })
  },

  setOverride: (id, def) => {
    set((state) => {
      const next = { ...state.overrides, [id]: def }
      saveAll(state.categories, state.dimensions, next)
      return { overrides: next }
    })
  },

  removeOverride: (id) => {
    set((state) => {
      const next = { ...state.overrides }
      delete next[id]
      saveAll(state.categories, state.dimensions, next)
      return { overrides: next }
    })
  },
}))
