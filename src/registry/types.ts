import type { TimeBase } from '../types/types'

export interface ResourceCategoryDef {
  id: string
  displayName: string
  base_unit: string
  themeColor: string
  preferred_time_base: TimeBase
}

export interface ResourceRegistryState {
  categories: Record<string, ResourceCategoryDef>
  addCategory: (def: ResourceCategoryDef) => void
  updateCategory: (id: string, patch: Partial<ResourceCategoryDef>) => void
  removeCategory: (id: string) => void
  getCategory: (id: string) => ResourceCategoryDef | undefined
  overrides: Record<string, ResourceOverride>
  setOverride: (id: string, def: ResourceOverride) => void
  removeOverride: (id: string) => void
}

export interface ResourceOverride {
  unit_override?: string
}

export interface ResolvedResourceProps {
  unit: string
  themeColor: string
  preferred_time_base: TimeBase
  is_unknown: boolean
}
