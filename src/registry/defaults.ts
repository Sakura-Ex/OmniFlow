import type { ResourceCategoryDef, DimensionDef, ResourceOverride, ResolvedResourceProps } from './types'

// ── Legacy: kept for backward compat with existing consumers ──
export const DEFAULT_RESOURCE_CATEGORIES: ResourceCategoryDef[] = [
  { id: 'item', displayName: '物品', base_unit: '个', themeColor: '#e5e7eb', defaultRouting: 'wired' },
  { id: 'fluid', displayName: '流体', base_unit: 'mB', themeColor: '#4ddcff', defaultRouting: 'wired' },
  { id: 'energy', displayName: '通用能源', base_unit: 'EU', themeColor: '#f59e0b', defaultRouting: 'global' },
  { id: 'stress', displayName: '应力', base_unit: 'su', themeColor: '#c084fc', defaultRouting: 'wired' },
  { id: 'heat', displayName: '热能', base_unit: 'HU', themeColor: '#fb7185', defaultRouting: 'global' },
  { id: 'gt:eu', displayName: '格雷电力', base_unit: 'EU', themeColor: '#fbbf24', defaultRouting: 'global' },
  { id: 'create:su', displayName: 'Create 应力', base_unit: 'RPM', themeColor: '#c084fc', defaultRouting: 'wired' },
  { id: 'thermal:rf', displayName: 'Thermal RF', base_unit: 'RF', themeColor: '#ef4444', defaultRouting: 'global' },
  { id: 'utility:water', displayName: '冷却水', base_unit: 'mB', themeColor: '#38bdf8', defaultRouting: 'global' },
]

export const FALLBACK_CATEGORY: ResourceCategoryDef = {
  id: '_fallback',
  displayName: '未定义',
  base_unit: '?',
  themeColor: 'rgba(148, 163, 184, 0.4)',
  defaultRouting: 'wired',
}

// ── Dimension Registry (物理量纲) ──
export const DimensionRegistry: Record<string, DimensionDef> = {
  item:   { default_unit: '个', display_mode: 'rate_per_sec',  themeColor: '#e5e7eb' },
  fluid:  { default_unit: 'mB', display_mode: 'rate_per_sec',  themeColor: '#4ddcff' },
  energy: { default_unit: 'EU', display_mode: 'rate_per_tick', themeColor: '#f59e0b' },
  stress: { default_unit: 'su', display_mode: 'rate_per_sec',  themeColor: '#c084fc' },
  heat:   { default_unit: 'HU', display_mode: 'rate_per_tick', themeColor: '#fb7185' },
}

export const FALLBACK_DIMENSION: DimensionDef = {
  default_unit: '?',
  display_mode: 'rate_per_sec',
  themeColor: 'rgba(148, 163, 184, 0.4)',
}

// ── Resource Override Registry (特化资产覆盖) ──
export const ResourceOverrideRegistry: Record<string, ResourceOverride> = {
  gt_eu: { unit_override: 'EU' },
  rf:    { unit_override: 'RF' },
  su:    { unit_override: 'RPM' },
  water: { unit_override: 'mB' },
}

// ── 3-Tier Resolver (merged static + user overrides) ──
export function resolveResourceProps(
  fullId: string,
  userDimensions?: Record<string, DimensionDef>,
  userOverrides?: Record<string, ResourceOverride>,
): ResolvedResourceProps {
  const idx = fullId.lastIndexOf(':')
  const dimensionId = idx > 0 ? fullId.slice(0, idx) : fullId
  const assetId = idx > 0 ? fullId.slice(idx + 1) : fullId

  const dimDef = userDimensions?.[dimensionId] ?? DimensionRegistry[dimensionId] ?? FALLBACK_DIMENSION
  const override = userOverrides?.[assetId] ?? ResourceOverrideRegistry[assetId]

  const isUnknown = !DimensionRegistry[dimensionId] && (idx <= 0 || !userDimensions?.[dimensionId])

  return {
    unit: override?.unit_override ?? dimDef.default_unit,
    display_mode: override?.display_mode_override ?? dimDef.display_mode,
    themeColor: dimDef.themeColor,
    is_unknown_dimension: isUnknown,
  }
}
