import type { Node, Edge, Connection } from 'reactflow'
import type { RecipeNodeData, EndpointPort } from '@/common/types/recipe'
import type { Resource, NormalizedResource } from '@/common/types/resource'
import type { UnitSnapshot } from '@/common/types/units'
import { portIdentity } from '@/common/utils/ports'
import { buildResourceId } from '@/common/utils/resourceId'
import { runModifierPipeline } from '@/features/modifier/modifier.pipeline'
import { identifyPorts } from '@/common/utils/ports'
import { UnitSystem } from '@/common/units/UnitSystem'
import { defaultResourceUnit, DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'

/** A port address always includes direction and persistent identity. */
export interface GraphPort {
  nodeId: string
  portId: string
  direction: 'input' | 'output'
  resourceId: string
  port: Resource | EndpointPort | NormalizedResource
}

/**
 * Index final recipe ports and endpoint ports without aggregating resources.
 * @returns Final independent graph ports, checked for compatible resource quantities.
 * @param nodes - Canvas nodes.
 * @param recipes - Authoritative recipes keyed by node identity.
 * @param environment - Serializable environment, definitions and prefixes.
 */
export function graphPorts(nodes: Node[], recipes: Record<string, RecipeNodeData>, environment: UnitSnapshot = DEFAULT_UNIT_SNAPSHOT): GraphPort[] {
  const ports = nodes.flatMap((node): GraphPort[] => {
    if (node.type === 'recipeNode') {
      const data = recipes[node.id]
      if (!data) throw new Error(`Missing recipe: ${node.id}`)
      const payload = runModifierPipeline(data, environment)
      return payload.final_ports.map(({ port, direction }) => ({ nodeId: node.id, portId: portIdentity(port), direction, resourceId: buildResourceId(port.category, port.id), port }))
    }
    if (node.type !== 'sourceNode' && node.type !== 'targetNode') return []
    return identifyPorts<EndpointPort>(node.data.ports ?? [], 'endpoint').map((port) => ({ nodeId: node.id, portId: portIdentity(port), direction: node.type === 'sourceNode' ? 'output' : 'input', resourceId: buildResourceId(port.category, port.id), port }))
  })
  const units = new UnitSystem(environment)
  const dimensions = new Map<string, string>()
  for (const p of ports) {
    const rateUnit = units.rateQuantity(1, p.port.unit ?? defaultResourceUnit(p.port.category, p.port.id), 'rate_per_sec', 1).unit
    const rateDimensions = units.registry.normalize(rateUnit.expression).dimensions
    const signature = JSON.stringify(Object.entries(rateDimensions).filter(([, e]) => e).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
    if (dimensions.has(p.resourceId) && dimensions.get(p.resourceId) !== signature) throw new Error(`Incompatible units at ${p.nodeId}/${p.portId} for ${p.resourceId}`)
    dimensions.set(p.resourceId, signature)
  }
  return ports
}

/**
 * Resolve handles by identity, then compare resource identity and routing.
 * @returns A located issue message, or null for a valid connection.
 * @param connection - Proposed or existing edge endpoints.
 * @param ports - Independent ports to inspect.
 */
export function connectionIssue(connection: Connection | Edge, ports: GraphPort[]): string | null {
  const source = ports.find((p) => p.nodeId === connection.source && p.portId === connection.sourceHandle && p.direction === 'output')
  const target = ports.find((p) => p.nodeId === connection.target && p.portId === connection.targetHandle && p.direction === 'input')
  if (!source) return `Missing output port: ${connection.source}/${connection.sourceHandle}`
  if (!target) return `Missing input port: ${connection.target}/${connection.targetHandle}`
  if (source.resourceId !== target.resourceId) return `Incompatible resources: ${source.resourceId} / ${target.resourceId}`
  if (source.port.routing_mode === 'global' || target.port.routing_mode === 'global') return 'Global ports cannot have physical edges'
  return null
}

/**
 * Upgrade only uniquely resolved legacy handles; preserve ambiguous edges for repair.
 * @returns Migrated edges retaining unresolved handles and repair metadata.
 * @param edges - Canvas edges with persistent port handles.
 * @param ports - Independent ports to inspect.
 */
export function migrateEdgePorts(edges: Edge[], ports: GraphPort[]): Edge[] {
  return edges.map((edge) => {
    const issues: string[] = []
    const resolve = (nodeId: string, handle: string | null | undefined, direction: 'input' | 'output') => {
      const candidates = ports.filter((p) => p.nodeId === nodeId && p.direction === direction)
      if (candidates.some((p) => p.portId === handle)) return handle
      const matches = candidates.filter((p) => p.resourceId === handle)
      if (matches.length === 1) return matches[0].portId
      issues.push(`${nodeId}/${handle}: ${matches.length ? 'ambiguous' : 'missing'} port`)
      return handle
    }
    const sourceHandle = resolve(edge.source, edge.sourceHandle, 'output')
    const targetHandle = resolve(edge.target, edge.targetHandle, 'input')
    return { ...edge, sourceHandle, targetHandle, data: { ...edge.data, portIssue: issues.join('; ') || undefined, legacyHandles: issues.length ? { source: edge.sourceHandle, target: edge.targetHandle } : undefined } }
  })
}
