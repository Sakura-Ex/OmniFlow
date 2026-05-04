export interface ResourceCategoryDef {
  id: string
  displayName: string
  unit: string
  themeColor: string
  defaultRouting: 'wired' | 'global'
}

export interface ResourceRegistryState {
  categories: Record<string, ResourceCategoryDef>
  addCategory: (def: ResourceCategoryDef) => void
  updateCategory: (id: string, patch: Partial<ResourceCategoryDef>) => void
  removeCategory: (id: string) => void
  getCategory: (id: string) => ResourceCategoryDef | undefined
}
