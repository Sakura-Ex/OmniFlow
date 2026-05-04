import type { EndpointPort, SourceNodeData, TargetNodeData } from '../types/recipe'
import type { ResourceCategoryDef } from '../registry/types'
import { FALLBACK_CATEGORY } from '../registry/defaults'

export function resolveCategoryDef(
  categories: Record<string, ResourceCategoryDef>,
  typeId?: string | null
): ResourceCategoryDef {
  if (!typeId) return FALLBACK_CATEGORY
  const exact = categories[typeId]
  if (exact) return exact
  const colonIdx = typeId.indexOf(':')
  if (colonIdx > 0) {
    const ns = typeId.slice(0, colonIdx)
    const nsMatch = categories[ns]
    if (nsMatch) return nsMatch
  }
  return FALLBACK_CATEGORY
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
