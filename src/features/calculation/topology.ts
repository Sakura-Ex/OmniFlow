import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import type { UnitSnapshot } from '@/common/types/units'
import { buildNetName, buildGlobalName, buildVoidName } from '@/common/utils/resourceId'
import { DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'
import { graphPorts, connectionIssue, type GraphPort } from './graphPorts'

/**
 * Persistent node/port address; JSON avoids delimiter collisions.
 * @returns Unambiguous serialized node/port address.
 * @param nodeId - Persistent node identity.
 * @param portId - Persistent port identity within the node.
 */
export const portKey = (nodeId: string, portId: string): string => JSON.stringify([nodeId, portId])
/** Net lookup is keyed by port identity, never resource identity. */
export type NetLookupTable = Map<string, string>
/** Final topology retains gross ports as provenance. */
export interface TopologicalNets {
  lookup: NetLookupTable
  nets: Map<string, Set<string>>
  ports: GraphPort[]
}

/**
 * Collision-free suffix compatible with the current API's routed-name parser.
 * @returns Deterministic net lookup and port provenance.
 * @param key - Stable port address.
 */
const suffix = (key: string) => Array.from(key).map((c) => c.codePointAt(0)!.toString(16).padStart(6, '0')).join('')

/**
 * Resolve each independent final port, then form deterministic shared nets.
 * @returns Deterministic net lookup and port provenance.
 * @param nodes - Canvas nodes.
 * @param edges - Canvas edges with persistent port handles.
 * @param recipes - Authoritative recipes keyed by node identity.
 * @param environment - Serializable environment, definitions and prefixes.
 */
export function buildTopologicalNets(nodes: Node[], edges: Edge[], recipes: Map<string, RecipeNodeData>, environment: UnitSnapshot = DEFAULT_UNIT_SNAPSHOT): TopologicalNets {
  const ports = graphPorts(nodes, Object.fromEntries(recipes), environment)
  const parent = new Map<string, string>()
  const connected = new Set<string>()
  const find = (key: string): string => {
    let root = key
    while (parent.has(root)) root = parent.get(root)!
    return root
  }
  for (const edge of edges) {
    const issue = connectionIssue(edge, ports)
    if (issue) throw new Error(`Edge ${edge.id}: ${issue}`)
    const a = portKey(edge.source, edge.sourceHandle!)
    const b = portKey(edge.target, edge.targetHandle!)
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb)
    connected.add(a)
    connected.add(b)
  }
  const lookup: NetLookupTable = new Map()
  const nets = new Map<string, Set<string>>()
  for (const p of ports) {
    const key = portKey(p.nodeId, p.portId)
    const name = p.port.routing_mode === 'global'
      ? buildGlobalName(p.resourceId)
      : connected.has(key) ? buildNetName(p.resourceId, suffix(find(key))) : buildVoidName(suffix(key), p.resourceId)
    lookup.set(key, name)
    if (!nets.has(name)) nets.set(name, new Set())
    nets.get(name)!.add(key)
  }
  return { lookup, nets, ports }
}
