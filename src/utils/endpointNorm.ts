import type { EndpointPort, SourceNodeData, TargetNodeData } from '../types/recipe'
import type { ResourceCategoryDef, UnitOverride } from '../registry/types'
import { FALLBACK_CATEGORY } from '../registry/defaults'
import { resolveResourceProps } from '../registry/globalResourceTable'
import { getCategory } from './resourceIdentifier'
import { generateId } from './generateId'

export { resolveResourceProps }

export function resolveCategoryDef(
  typeId?: string | null,
  userCategories?: Record<string, ResourceCategoryDef>,
  userOverrides?: Record<string, UnitOverride>,
): ResourceCategoryDef {
  if (!typeId) return FALLBACK_CATEGORY
  const categoryId = getCategory(typeId)

  const catDef = userCategories?.[typeId] ?? userCategories?.[categoryId]
  if (catDef) return catDef

  const override = userOverrides?.[typeId]
  return {
    id: typeId,
    displayName: typeId,
    base_unit: override?.unit_override ?? '?',
    themeColor: FALLBACK_CATEGORY.themeColor,
    preferred_time_base: FALLBACK_CATEGORY.preferred_time_base,
  }
}

export function normalizeEndpointPorts(
  data: SourceNodeData | TargetNodeData
): EndpointPort[] {
  if (Array.isArray(data.ports) && data.ports.length > 0) {
    return data.ports.filter((p) => p.id && typeof p.amount === 'number')
  }
  return []
}

export function normalizeEndpointData<T extends SourceNodeData | TargetNodeData>(
  data: T
): T {
  if (!Array.isArray(data.ports) || data.ports.length === 0) {
    const ports = normalizeEndpointPorts(data)
    return {
      ...data,
      ports: ports.length > 0 ? ports : [{ id: '', amount: 0, category: 'item', _uid: generateId() }],
    }
  }
  return data
}

export function emptyEndpointPort(category?: string): EndpointPort {
  return {
    id: '',
    amount: 0,
    category: category ?? 'item',
    routing_mode: 'wired',
    routing_locked: false,
    _uid: generateId(),
  }
}