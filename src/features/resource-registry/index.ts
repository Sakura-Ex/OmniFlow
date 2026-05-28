/** Core registry types. */
export type { ResourceCategoryDef, ResourceEntry, ResolvedResourceProps, UnitOverride, GlobalResourceTableState } from '@/common/types/registry'
/** Default and fallback resource categories. */
export { DEFAULT_RESOURCE_CATEGORIES, FALLBACK_CATEGORY } from './registry.defaults'
/** Global resource table store and resource property resolver. */
export { useGlobalResourceTable, resolveResourceProps } from './registry.store'
