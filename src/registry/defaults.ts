import type { ResourceCategoryDef } from './types'

export const DEFAULT_RESOURCE_CATEGORIES: ResourceCategoryDef[] = [
  {
    id: 'item',
    displayName: '物品',
    base_unit: '个',
    themeColor: '#e5e7eb',
    defaultRouting: 'wired',
  },
  {
    id: 'fluid',
    displayName: '流体',
    base_unit: 'mB',
    themeColor: '#4ddcff',
    defaultRouting: 'wired',
  },
  {
    id: 'energy',
    displayName: '通用能源',
    base_unit: 'EU',
    themeColor: '#f59e0b',
    defaultRouting: 'global',
  },
  {
    id: 'stress',
    displayName: '应力',
    base_unit: 'su',
    themeColor: '#c084fc',
    defaultRouting: 'wired',
  },
  {
    id: 'heat',
    displayName: '热能',
    base_unit: 'HU',
    themeColor: '#fb7185',
    defaultRouting: 'global',
  },
  {
    id: 'gt:eu',
    displayName: '格雷电力',
    base_unit: 'EU',
    themeColor: '#fbbf24',
    defaultRouting: 'global',
  },
  {
    id: 'create:su',
    displayName: 'Create 应力',
    base_unit: 'RPM',
    themeColor: '#c084fc',
    defaultRouting: 'wired',
  },
  {
    id: 'thermal:rf',
    displayName: 'Thermal RF',
    base_unit: 'RF',
    themeColor: '#ef4444',
    defaultRouting: 'global',
  },
  {
    id: 'utility:water',
    displayName: '冷却水',
    base_unit: 'mB',
    themeColor: '#38bdf8',
    defaultRouting: 'global',
  },
]

export const FALLBACK_CATEGORY: ResourceCategoryDef = {
  id: '_fallback',
  displayName: '未定义单位',
  base_unit: '?',
  themeColor: 'rgba(148, 163, 184, 0.4)',
  defaultRouting: 'wired',
}
