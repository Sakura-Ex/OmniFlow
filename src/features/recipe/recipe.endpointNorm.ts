import type { EndpointPort, SourceNodeData, TargetNodeData } from '@/common/types/recipe'
import type { ResourceCategoryDef, UnitOverride } from '@/common/types/registry'
import { FALLBACK_CATEGORY } from '@/features/resource-registry/registry.defaults'
import { resolveResourceProps } from '@/features/resource-registry/registry.store'
import { getCategory, DEFAULT_RESOURCE_CATEGORY } from '@/common/utils/resourceId'
import { generateId } from '@/common/utils/id'

/** Resolve display properties (unit, colour, name) for a fully qualified resource ID. */
export { resolveResourceProps }

/**
 * Resolve a resource's category definition by looking up user-defined
 * categories and overrides, falling back to {@link FALLBACK_CATEGORY}.
 * @param typeId - Fully qualified resource type ID (e.g. `item:iron_ingot`).
 * @param userCategories - Optional map of user-defined category definitions.
 * @param userOverrides - Optional map of per-resource unit overrides.
 * @returns The resolved category definition.
 */
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

/**
 * Extract and filter valid endpoint ports from source/target node data.
 * Returns only ports that have both an `id` and a numeric `amount`.
 * @param data - Source or target node data.
 * @returns An array of valid endpoint ports.
 */
export function normalizeEndpointPorts(
  data: SourceNodeData | TargetNodeData
): EndpointPort[] {
  if (Array.isArray(data.ports) && data.ports.length > 0) {
    return data.ports.filter((p) => p.id && typeof p.amount === 'number')
  }
  return []
}

/**
 * Normalise source/target node data so it always contains a valid `ports` array.
 * If the data has no usable ports a single empty port is injected.
 * @param data - Source or target node data.
 * @returns The normalised node data with a guaranteed `ports` array.
 */
export function normalizeEndpointData<T extends SourceNodeData | TargetNodeData>(
  data: T
): T {
  if (!Array.isArray(data.ports) || data.ports.length === 0) {
    const ports = normalizeEndpointPorts(data)
    return {
      ...data,
      ports: ports.length > 0 ? ports : [{ id: '', amount: 0, category: DEFAULT_RESOURCE_CATEGORY, _uid: generateId() }],
    }
  }
  return data
}

/**
 * Create an empty endpoint port with sensible defaults.
 * @param category - Optional resource category; defaults to `DEFAULT_RESOURCE_CATEGORY`.
 * @returns A new endpoint port with default values.
 */
export function emptyEndpointPort(category?: string): EndpointPort {
  return {
    id: '',
    amount: 0,
    category: category ?? DEFAULT_RESOURCE_CATEGORY,
    routing_mode: 'wired',
    routing_locked: false,
    _uid: generateId(),
  }
}
