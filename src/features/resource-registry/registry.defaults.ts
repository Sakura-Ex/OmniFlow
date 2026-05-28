import type { ResourceCategoryDef, UnitOverride } from '@/common/types/registry'

/** Built-in resource categories shipped with the application. */
export const DEFAULT_RESOURCE_CATEGORIES: ResourceCategoryDef[] = [
  { id: 'item',   displayName: '物品', base_unit: '个', themeColor: '#e5e7eb', preferred_time_base: 'per_cycle' },
  { id: 'fluid',  displayName: '流体', base_unit: 'mB', themeColor: '#4ddcff', preferred_time_base: 'per_cycle' },
  { id: 'energy', displayName: '能源', base_unit: 'EU', themeColor: '#f59e0b', preferred_time_base: 'rate_per_tick' },
  { id: 'stress', displayName: '应力', base_unit: 'su', themeColor: '#c084fc', preferred_time_base: 'per_cycle' },
  { id: 'heat',   displayName: '热能', base_unit: 'HU', themeColor: '#fb7185', preferred_time_base: 'rate_per_tick' },
]

/** Fallback category used when a resource type cannot be resolved. */
export const FALLBACK_CATEGORY: ResourceCategoryDef = {
  id: '_fallback',
  displayName: '未定义',
  base_unit: '?',
  themeColor: 'rgba(148, 163, 184, 0.4)',
  preferred_time_base: 'rate_per_sec',
}

/** Per-resource unit overrides that replace the default unit of the parent category. */
export const DEFAULT_OVERRIDES: Record<string, UnitOverride> = {
  'stress:create_su':  { unit_override: 'RPM' },
  'energy:thermal_rf': { unit_override: 'RF' },
}
