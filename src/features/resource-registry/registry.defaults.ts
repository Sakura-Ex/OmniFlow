import { RESOURCE_COLORS } from '@/common/utils/resourcePalette'
import type { ResourceCategoryDef, UnitOverride } from '@/common/types/registry'

/** Built-in resource categories shipped with the application. */
export const DEFAULT_RESOURCE_CATEGORIES: ResourceCategoryDef[] = [
  { id: 'item',   displayName: '物品', base_unit: '个', themeColor: RESOURCE_COLORS.item, preferred_time_base: 'per_cycle' },
  { id: 'fluid',  displayName: '流体', base_unit: 'mB', themeColor: RESOURCE_COLORS.fluid, preferred_time_base: 'per_cycle' },
  { id: 'energy', displayName: '能源', base_unit: 'EU', themeColor: RESOURCE_COLORS.energy, preferred_time_base: 'rate_per_tick' },
  { id: 'stress', displayName: '应力', base_unit: 'su', themeColor: RESOURCE_COLORS.stress, preferred_time_base: 'per_cycle' },
  { id: 'heat',   displayName: '热能', base_unit: 'HU', themeColor: RESOURCE_COLORS.heat, preferred_time_base: 'rate_per_tick' },
]

/** Fallback category used when a resource type cannot be resolved. */
export const FALLBACK_CATEGORY: ResourceCategoryDef = {
  id: '_fallback',
  displayName: '未定义',
  base_unit: '?',
  themeColor: RESOURCE_COLORS.fallback,
  preferred_time_base: 'rate_per_sec',
}

/** Per-resource unit overrides that replace the default unit of the parent category. */
export const DEFAULT_OVERRIDES: Record<string, UnitOverride> = {
  'stress:create_su':  { unit_override: 'RPM' },
  'energy:thermal_rf': { unit_override: 'RF' },
}
