import type { Node, Edge } from 'reactflow'
import type { GraphPort } from './graphPorts'
import type { NetworkConfiguration } from './networkConfig'
import { portKey } from './topology'

/**
 * Explicitly mark eligible unconnected recipe inputs as unlimited external supply.
 * @param ports - Final compiled port descriptions.
 * @param nodes - Nodes used to identify recipes only.
 * @param edges - Existing edges, including invalid connections pending repair.
 * @param configuration - Current document policies, preserved immutably.
 * @returns A fresh configuration with only eligible closed flow inputs supplied.
 */
export function supplyUnconnectedInputs(ports: readonly GraphPort[], nodes: readonly Node[], edges: readonly Edge[], configuration: NetworkConfiguration): NetworkConfiguration {
  const recipeIds = new Set(nodes.filter(node => node.type === 'recipeNode').map(node => node.id))
  const next = { ...configuration, ports: { ...configuration.ports } }
  for (const port of ports) {
    if (!recipeIds.has(port.nodeId) || port.direction !== 'input' || port.port.routing_mode === 'global' || !(port.port.amount > 0) || port.port.consumable === false || port.port.probability === 0) continue
    const key = portKey(port.nodeId, port.portId)
    const current = configuration.ports[key]
    if (current?.boundary || (current && current.semantics.kind !== 'flow')) continue
    const connected = edges.some(edge => (edge.source === port.nodeId && edge.sourceHandle === port.portId) || (edge.target === port.nodeId && edge.targetHandle === port.portId))
    if (connected) continue
    next.ports[key] = { ...(current ?? { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' as const } }), boundary: { kind: 'source', capacity: null } }
  }
  return next
}
