import { create } from 'zustand'
import type { ResourceDef } from '../types/types'

const STORAGE_KEY = 'omniflow.resource_index.v1'

type ResourceIndexState = {
  entries: Record<string, ResourceDef>

  ensureEntry: (fullId: string) => void
  setEntry: (fullId: string, def: ResourceDef) => void
  removeEntry: (fullId: string) => void
  getEntry: (fullId: string) => ResourceDef | undefined
}

function loadPersisted(): Record<string, ResourceDef> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null) return parsed
    }
  } catch {
    // ignore
  }
  return {}
}

function persist(entries: Record<string, ResourceDef>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

export const useResourceIndex = create<ResourceIndexState>((set, get) => ({
  entries: loadPersisted(),

  ensureEntry: (fullId) => {
    set((state) => {
      if (state.entries[fullId]) return state
      const next = { ...state.entries, [fullId]: { fullId } }
      persist(next)
      return { entries: next }
    })
  },

  setEntry: (fullId, def) => {
    set((state) => {
      const next = { ...state.entries, [fullId]: def }
      persist(next)
      return { entries: next }
    })
  },

  removeEntry: (fullId) => {
    set((state) => {
      const next = { ...state.entries }
      delete next[fullId]
      persist(next)
      return { entries: next }
    })
  },

  getEntry: (fullId) => get().entries[fullId],
}))
