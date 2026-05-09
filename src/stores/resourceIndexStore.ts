import { create } from 'zustand'
import type { ResourceDef } from '../types/types'
import { loadFromStorage, saveToStorage } from '../utils/storage'

const STORAGE_KEY = 'omniflow.resource_index.v1'

type ResourceIndexState = {
  entries: Record<string, ResourceDef>

  ensureEntry: (fullId: string) => void
  setEntry: (fullId: string, def: ResourceDef) => void
  removeEntry: (fullId: string) => void
  getEntry: (fullId: string) => ResourceDef | undefined
}

export const useResourceIndexStore = create<ResourceIndexState>((set, get) => ({
  entries: loadFromStorage(STORAGE_KEY, {} as Record<string, ResourceDef>),

  ensureEntry: (fullId) => {
    set((state) => {
      if (state.entries[fullId]) return state
      const next = { ...state.entries, [fullId]: { fullId } }
      saveToStorage(STORAGE_KEY, next)
      return { entries: next }
    })
  },

  setEntry: (fullId, def) => {
    set((state) => {
      const next = { ...state.entries, [fullId]: def }
      saveToStorage(STORAGE_KEY, next)
      return { entries: next }
    })
  },

  removeEntry: (fullId) => {
    set((state) => {
      const next = { ...state.entries }
      delete next[fullId]
      saveToStorage(STORAGE_KEY, next)
      return { entries: next }
    })
  },

  getEntry: (fullId) => get().entries[fullId],
}))
