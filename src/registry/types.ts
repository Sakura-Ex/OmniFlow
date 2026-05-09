import type { TimeBase } from '../types/types'

export interface ResourceCategoryDef {
  id: string
  displayName: string
  base_unit: string
  themeColor: string
  preferred_time_base: TimeBase
}

export interface UnitOverride {
  unit_override?: string
}

export interface ResourceEntry {
  fullId: string
  displayName?: string
}

export interface ResolvedResourceProps {
  unit: string
  themeColor: string
  displayName: string
  preferred_time_base: TimeBase
  is_unknown: boolean
}

export interface GlobalResourceTableState {
  categories: Record<string, ResourceCategoryDef>
  overrides: Record<string, UnitOverride>
  entries: Record<string, ResourceEntry>

  addCategory: (def: ResourceCategoryDef) => void
  updateCategory: (id: string, patch: Partial<ResourceCategoryDef>) => void
  removeCategory: (id: string) => void

  setOverride: (fullId: string, def: UnitOverride) => void
  removeOverride: (fullId: string) => void

  ensureEntry: (fullId: string) => void
  setEntry: (fullId: string, patch: Partial<ResourceEntry>) => void
  removeEntry: (fullId: string) => void

  resolve: (fullId: string) => ResolvedResourceProps
}
