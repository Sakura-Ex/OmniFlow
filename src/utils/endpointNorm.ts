import type { EndpointPort, SourceNodeData, TargetNodeData } from '../types/recipe'
import type { ResourceCategoryDef, ResourceOverride } from '../registry/types'
import { FALLBACK_CATEGORY, resolveResourceProps } from '../registry/defaults'
import { getCategory } from './resourceIdentifier'

export { resolveResourceProps }

export function resolveCategoryDef(
  typeId?: string | null,
  userCategories?: Record<string, ResourceCategoryDef>,
  userOverrides?: Record<string, ResourceOverride>,
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
  if (typeof data.id === 'string' && data.id.length > 0) {
    return [{
      id: data.id,
      amount: data.amount ?? 0,
      category: data.category ?? 'item',
    }]
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
      ports: ports.length > 0 ? ports : [{ id: '', amount: 0, category: 'item', _uid: crypto.randomUUID() }],
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
    _uid: crypto.randomUUID(),
  }
}
