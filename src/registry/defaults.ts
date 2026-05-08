import type { ResourceCategoryDef, ResourceOverride, ResolvedResourceProps } from './types'
import { getCategory } from '../utils/resourceIdentifier'

export const DEFAULT_RESOURCE_CATEGORIES: ResourceCategoryDef[] = [
  { id: 'item',   displayName: '物品', base_unit: '个', themeColor: '#e5e7eb', preferred_time_base: 'rate_per_sec' },
  { id: 'fluid',  displayName: '流体', base_unit: 'mB', themeColor: '#4ddcff', preferred_time_base: 'rate_per_sec' },
  { id: 'energy', displayName: '能源', base_unit: 'EU', themeColor: '#f59e0b', preferred_time_base: 'rate_per_tick' },
  { id: 'stress', displayName: '应力', base_unit: 'su', themeColor: '#c084fc', preferred_time_base: 'rate_per_sec' },
  { id: 'heat',   displayName: '热能', base_unit: 'HU', themeColor: '#fb7185', preferred_time_base: 'rate_per_tick' },
]

export const FALLBACK_CATEGORY: ResourceCategoryDef = {
  id: '_fallback',
  displayName: '未定义',
  base_unit: '?',
  themeColor: 'rgba(148, 163, 184, 0.4)',
  preferred_time_base: 'rate_per_sec',
}

export const ResourceOverrideRegistry: Record<string, ResourceOverride> = {
  'stress:create_su':  { unit_override: 'RPM' },
  'energy:thermal_rf': { unit_override: 'RF' },
}

export function resolveResourceProps(
  fullId: string,
  userCategories?: Record<string, ResourceCategoryDef>,
  userOverrides?: Record<string, ResourceOverride>,
): ResolvedResourceProps {
  const categoryId = getCategory(fullId)

  const catDef = userCategories?.[fullId]
    ?? userCategories?.[categoryId]
    ?? findBuiltinCategory(fullId)
    ?? findBuiltinCategory(categoryId)
    ?? FALLBACK_CATEGORY

  const override = userOverrides?.[fullId] ?? ResourceOverrideRegistry[fullId]

  const isUnknown = !findBuiltinCategory(categoryId) && (fullId === categoryId || !userCategories?.[categoryId])

  return {
    unit: override?.unit_override ?? catDef.base_unit,
    themeColor: catDef.themeColor,
    preferred_time_base: catDef.preferred_time_base,
    is_unknown: isUnknown,
  }
}

function findBuiltinCategory(id: string): ResourceCategoryDef | undefined {
  return DEFAULT_RESOURCE_CATEGORIES.find((c) => c.id === id)
}
