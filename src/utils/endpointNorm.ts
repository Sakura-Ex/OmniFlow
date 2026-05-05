import type { EndpointPort, SourceNodeData, TargetNodeData } from '../types/recipe'
import type { ResourceCategoryDef, DimensionDef, ResourceOverride } from '../registry/types'
import { FALLBACK_CATEGORY, resolveResourceProps, DimensionRegistry } from '../registry/defaults'

export { resolveResourceProps } from '../registry/defaults'

export function resolveCategoryDef(
  typeId?: string | null,
  userDimensions?: Record<string, DimensionDef>,
  userOverrides?: Record<string, ResourceOverride>,
): ResourceCategoryDef {
  if (!typeId) return FALLBACK_CATEGORY
  const idx = typeId.lastIndexOf(':')
  const dimensionId = idx > 0 ? typeId.slice(0, idx) : typeId
  const dimDef = userDimensions?.[dimensionId] ?? DimensionRegistry[dimensionId]
  const props = resolveResourceProps(typeId, userDimensions, userOverrides)
  return {
    id: typeId,
    displayName: dimDef ? dimensionId : typeId,
    base_unit: props.unit,
    themeColor: props.themeColor,
    defaultRouting: 'wired',
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
      item_type: data.item_type ?? 'item',
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
      ports: ports.length > 0 ? ports : [{ id: '', amount: 0, item_type: 'item', _uid: crypto.randomUUID() }],
    }
  }
  return data
}

export function emptyEndpointPort(itemType?: string): EndpointPort {
  return {
    id: '',
    amount: 0,
    item_type: itemType ?? 'item',
    _uid: crypto.randomUUID(),
  }
}
