export interface ResourceCategoryDef {
  id: string
  displayName: string
  base_unit: string
  themeColor: string
  defaultRouting: 'wired' | 'global'
}

export interface ResourceRegistryState {
  categories: Record<string, ResourceCategoryDef>
  addCategory: (def: ResourceCategoryDef) => void
  updateCategory: (id: string, patch: Partial<ResourceCategoryDef>) => void
  removeCategory: (id: string) => void
  getCategory: (id: string) => ResourceCategoryDef | undefined
  dimensions: Record<string, DimensionDef>
  overrides: Record<string, ResourceOverride>
  setDimension: (id: string, def: DimensionDef) => void
  setOverride: (id: string, def: ResourceOverride) => void
  removeOverride: (id: string) => void
}

export interface DimensionDef {
  default_unit: string
  display_mode: 'rate_per_sec' | 'rate_per_tick' | 'per_cycle'
  themeColor: string
}

export interface ResourceOverride {
  unit_override?: string
  display_mode_override?: 'rate_per_sec' | 'rate_per_tick' | 'per_cycle'
}

export interface ResolvedResourceProps {
  unit: string
  display_mode: 'rate_per_sec' | 'rate_per_tick' | 'per_cycle'
  themeColor: string
  is_unknown_dimension: boolean
}
