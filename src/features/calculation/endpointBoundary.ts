import { BoundarySchema, NetworkConfigurationSchema, type Boundary, type NetworkConfiguration } from './networkConfig'
import { portKey } from './topology'

/** Everyday endpoint controls, independent of legacy node.mode. */
export type EndpointMode = 'unlimited' | 'limited' | 'demand' | 'exact' | 'maximize' | 'spill' | 'export'

/** Change only the explicitly selected boundary behavior.
 * @param previous - Existing authoritative boundary.
 * @param mode - User-selected endpoint mode.
 * @param fallbackAmount - Canonical quantity retained by the current card draft.
 * @returns Validated boundary without mutating the previous policy.
 */
export function changeEndpointBoundaryMode(previous: Boundary | undefined, mode: EndpointMode, fallbackAmount: number): Boundary {
  const amount = Number.isFinite(fallbackAmount) && fallbackAmount >= 0 ? fallbackAmount : 0
  if (mode === 'unlimited' || mode === 'limited') return BoundarySchema.parse({
    kind: 'source', capacity: mode === 'unlimited' ? null : previous?.kind === 'source' && previous.capacity !== null ? previous.capacity : amount,
    ...(previous?.kind === 'source' && previous.cost ? { cost: previous.cost } : {}),
  })
  if (mode === 'spill') return { kind: 'spill', capacity: null }
  const existing = previous?.kind === 'delivery' ? previous : undefined
  return BoundarySchema.parse({ kind: 'delivery', mode: mode === 'demand' ? 'at_least' : mode,
    amount: mode === 'demand' || mode === 'exact' ? existing && ['at_least', 'exact'].includes(existing.mode) ? existing.amount : amount : 0,
    capacity: existing?.capacity ?? null,
    ...(mode === 'maximize' ? { objective: existing?.objective ?? { priority: 0, weight: 1, scale: 1 } } : {}),
  })
}

/** Commit a numeric draft without changing its mode or advanced constraints.
 * @param previous - Authoritative finite-supply or quantity-demand boundary.
 * @param amount - Canonical nonnegative quantity after display-unit conversion.
 * @returns Validated updated boundary.
 */
export function changeEndpointBoundaryAmount(previous: Boundary, amount: number): Boundary {
  if (previous.kind === 'source' && previous.capacity !== null) return BoundarySchema.parse({ ...previous, capacity: amount })
  if (previous.kind === 'delivery' && ['at_least', 'exact'].includes(previous.mode)) return BoundarySchema.parse({ ...previous, amount })
  throw new Error('此模式不支持直接编辑数量')
}

/** Replace only one flow boundary, keeping all document policies authoritative.
 * @param configuration - Current document configuration.
 * @param nodeId - Persistent endpoint node identity.
 * @param portId - Persistent endpoint port identity.
 * @param boundary - New explicit boundary.
 * @returns Validated independent document configuration.
 */
export function replaceEndpointBoundary(configuration: NetworkConfiguration, nodeId: string, portId: string, boundary: Boundary): NetworkConfiguration {
  return replaceEndpointBoundaries(configuration, nodeId, { [portId]: boundary })
}

/** Validate a node-wide mode change before committing any of its ports.
 * @param configuration - Authoritative configuration.
 * @param nodeId - Endpoint identity.
 * @param boundaries - New boundaries keyed by persistent port identity.
 * @returns One immutable configuration for a single undo transaction.
 */
export function replaceEndpointBoundaries(configuration: NetworkConfiguration, nodeId: string, boundaries: Record<string, Boundary>): NetworkConfiguration {
  const ports = { ...configuration.ports }
  for (const [portId, boundary] of Object.entries(boundaries)) {
    const key = portKey(nodeId, portId)
    const previous = ports[key] ?? { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' as const } }
    if (previous.semantics.kind !== 'flow') throw new Error('容量与状态请在高级设置中编辑')
    ports[key] = { ...previous, boundary }
  }
  return NetworkConfigurationSchema.parse({ ...configuration, ports })
}
