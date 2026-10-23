import type { RoutingMode } from '@/common/types/resource'

/**
 * Toggle a resource's explicit routing mode without changing other fields.
 * @param item - Resource routing configuration.
 * @returns A shallow copy with the alternate routing mode.
 */
export function toggleRouting<T extends { routing_mode?: RoutingMode }>(item: T): T {
  return { ...item, routing_mode: item.routing_mode === 'global' ? 'wired' : 'global' }
}
