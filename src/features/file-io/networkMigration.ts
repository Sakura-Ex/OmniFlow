import type { Node } from 'reactflow'
import type { Resource } from '@/common/types/resource'
import type { UnitSnapshot } from '@/common/types/units'
import { emptyNetworkConfiguration, type NetworkConfiguration } from '@/common/schemas/network.schema'
import { UnitSystem } from '@/common/units/UnitSystem'
import { defaultResourceUnit } from '@/common/units/defaults'
import { portKey } from '@/features/calculation/topology'

/** Migrate only visible external endpoints; never create hidden supply or disposal.
 * @param nodes - Normalized legacy nodes with persistent ports.
 * @param environment - Saved quantity environment.
 * @returns Explicit policies for the visible endpoints.
 */
export function migrateNetworkConfiguration(nodes: Node[], environment: UnitSnapshot): NetworkConfiguration {
  const configuration = emptyNetworkConfiguration()
  const units = new UnitSystem(environment)
  for (const node of nodes) {
    if (node.type !== 'sourceNode' && node.type !== 'targetNode') continue
    for (const port of node.data.ports as Resource[]) {
      const amount = units.toRate(port.amount, port.unit ?? defaultResourceUnit(port.category, port.id), port.time_base ?? 'rate_per_sec', 1)
      const boundary = node.type === 'sourceNode'
        ? { kind: 'source' as const, capacity: node.data.mode === 'infinite' ? null : amount }
        : node.data.mode === 'overflow'
          ? { kind: 'spill' as const, capacity: null }
          : { kind: 'delivery' as const, mode: node.data.mode === 'maximize' ? 'maximize' as const : 'at_least' as const, amount: node.data.mode === 'maximize' ? 0 : amount, capacity: null,
            ...(node.data.mode === 'maximize' ? { objective: { priority: 0, weight: 1, scale: amount > 0 ? amount : 1 } } : {}) }
      configuration.ports[portKey(node.id, port.portId!)] = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary }
    }
  }
  return configuration
}
