import type { Node } from 'reactflow'
import type { NetworkConfiguration } from './networkConfig'
import { identifyPorts } from '@/common/utils/ports'
import type { EndpointPort } from '@/common/types/recipe'
import { UnitSystem } from '@/common/units/UnitSystem'
import type { UnitSnapshot } from '@/common/types/units'
import { defaultResourceUnit } from '@/common/units/defaults'
import { portKey } from './topology'

/**
 * New endpoint ports get explicit policies; existing user policies are preserved.
 * @param configuration - Current document policies.
 * @param node - Newly created or edited endpoint.
 * @param environment - Captured unit environment.
 * @returns Policies including new persistent endpoint ports.
 */
export function configureEndpointPorts(configuration: NetworkConfiguration, node: Node, environment: UnitSnapshot): NetworkConfiguration {
  if (node.type !== 'sourceNode' && node.type !== 'targetNode') return configuration
  const units = new UnitSystem(environment)
  const ports = { ...configuration.ports }
  for (const port of identifyPorts<EndpointPort>(node.data.ports ?? [], 'endpoint')) {
    const key = portKey(node.id, port.portId!)
    if (ports[key]) continue
    const amount = units.toRate(port.amount, port.unit ?? defaultResourceUnit(port.category, port.id), 'rate_per_sec', 1)
    const mode = node.data.mode ?? (node.type === 'sourceNode' ? 'infinite' : 'maximize')
    ports[key] = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: node.type === 'sourceNode'
      ? { kind: 'source', capacity: mode === 'limit' ? amount : null }
      : mode === 'overflow'
        ? { kind: 'spill', capacity: null }
        : { kind: 'delivery', mode: mode === 'maximize' ? 'maximize' : 'at_least', amount: mode === 'maximize' ? 0 : amount, capacity: null, ...(mode === 'maximize' ? { objective: { priority: 0, weight: 1, scale: amount > 0 ? amount : 1 } } : {}) } }
  }
  return { ...configuration, ports }
}
