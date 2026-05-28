import type { Edge, Node } from 'reactflow'
import type { Resource } from '@/common/types/resource'
import { normalizeEndpointPorts } from '@/features/recipe/recipe.endpointNorm'
import { buildResourceId, buildNetName, buildGlobalName, buildVoidName, DEFAULT_RESOURCE_CATEGORY } from '@/common/utils/resourceId'

/** Concatenated key `"nodeId|qualifiedPortId"` used as a lookup key for net assignment. */
type PortKey = string

/**
 * A lookup table that maps a port key (`"nodeId|qualifiedPortId"`) to its
 * resolved net name after union-find-based net assignment.
 *
 * Ports that share a connected edge path receive the same net name; isolated
 * ports receive a unique void net name.
 */
export type NetLookupTable = Map<PortKey, string>

/**
 * Build a port key string from a node ID and a qualified port ID.
 * @param nodeId - The node's identifier.
 * @param portId - The qualified port identifier.
 * @returns A concatenated key in the form `"nodeId|portId"`.
 */
function portKey(nodeId: string, portId: string): PortKey {
  return `${nodeId}|${portId}`
}

/**
 * Union-Find (disjoint-set) data structure used to group connected port keys
 * into equivalence classes (nets).
 */
class UnionFind {
  private parent: Map<string, string> = new Map()

  /**
   *
   * @param id
   */
  private ensure(id: string) {
    if (!this.parent.has(id)) this.parent.set(id, id)
  }

  /**
   * Find the root representative of the set containing `id`.
   * @param id - The element to look up.
   * @returns The root representative string.
   */
  find(id: string): string {
    this.ensure(id)
    let root = id
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!
    }
    let cur = id
    while (cur !== root) {
      const next = this.parent.get(cur)!
      this.parent.set(cur, root)
      cur = next
    }
    return root
  }

  /**
   * Merge the sets containing `a` and `b` into a single equivalence class.
   * @param a - First element.
   * @param b - Second element.
   */
  union(a: string, b: string) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }

  /**
   * Return the set of all unique root representatives across the data structure.
   * @returns A set of all root strings.
   */
  allRoots(): Set<string> {
    const roots = new Set<string>()
    for (const key of this.parent.keys()) {
      roots.add(this.find(key))
    }
    return roots
  }
}

/**
 * The result of topological net-building.
 *
 * @property lookup - Port-key-to-net-name mapping (see {@link NetLookupTable}).
 * @property nets   - Reverse mapping: net name → set of port keys belonging to that net.
 */
export interface TopologicalNets {
  lookup: NetLookupTable
  nets: Map<string, Set<PortKey>>
}

/**
 * Process a single port and assign it to the appropriate net (global, connected, or void).
 *
 * @param port               - The port descriptor.
 * @param port.id
 * @param port.category
 * @param port.routing_mode
 * @param nodeId             - The node this port belongs to.
 * @param uf                 - Union-Find instance with edge-connectivity information.
 * @param edges              - All physical edges.
 * @param addToNet           - Callback to add the port key to a net.
 * @param hasEdgeForKey      - Predicate checking whether a port key participates in any edge.
 * @param getNetName         - Resolver that creates or retrieves a net name for a union-find root.
 * @param buildGlobalName    - Builder for a global net name.
 * @param buildVoidName      - Builder for a void net name.
 * @param buildResourceId    - Builder for a qualified resource ID.
 * @param portKey            - Builder for a port key.
 */
function processPort(
  port: { id?: string; category: string; routing_mode?: string },
  nodeId: string,
  uf: UnionFind,
  edges: Edge[],
  addToNet: (netName: string, key: string) => void,
  hasEdgeForKey: (key: string, edges: Edge[], nodeId: string) => boolean,
  getNetName: (root: string) => string,
  buildGlobalName: (qualifier: string) => string,
  buildVoidName: (nodeId: string, fullId: string) => string,
  buildResourceId: (category: string, id: string) => string,
  portKey: (nodeId: string, portId: string) => string,
): void {
  if (!port.id) return
  const qualifiedId = buildResourceId(port.category, port.id)
  const key = portKey(nodeId, qualifiedId)
  if (port.routing_mode === 'global') {
    addToNet(buildGlobalName(port.category), key)
  } else if (uf.find(key) !== key || hasEdgeForKey(key, edges, nodeId)) {
    addToNet(getNetName(uf.find(key)), key)
  } else {
    addToNet(buildVoidName(nodeId, qualifiedId), key)
  }
}

/**
 * Build topological nets from canvas nodes and physical edges.
 *
 * Uses a union-find (disjoint-set) structure to group connected port keys.
 * Each connected component (net) is assigned a unique net name. Globally-routed
 * ports are grouped under a shared global net name. Isolated ports receive a
 * void net name unique to that port.
 *
 * @param nodes         - All canvas nodes.
 * @param edges         - Physical edges (global-port edges already filtered out).
 * @param shapedRecipes - Map of node ID → shaped recipe data with normalised port arrays.
 * @returns A {@link TopologicalNets} containing both the port-key lookup and the reverse net map.
 *
 * @example
 * ```ts
 * const { lookup, nets } = buildTopologicalNets(nodes, physicalEdges, shapedRecipes)
 * // lookup.get("nodeA|category:port1") => "net_abc123"
 * // nets.get("net_abc123") => Set { "nodeA|category:port1", "nodeB|category:port1" }
 * ```
 */
export function buildTopologicalNets(
  nodes: Node[],
  edges: Edge[],
  shapedRecipes: Map<string, { base_inputs?: Resource[]; base_outputs?: Resource[]; base_utility_inputs?: Resource[]; base_utility_outputs?: Resource[] }>
): TopologicalNets {
  const uf = new UnionFind()

  for (const edge of edges) {
    if (!edge.sourceHandle || !edge.targetHandle) continue
    const srcKey = portKey(edge.source, edge.sourceHandle)
    const tgtKey = portKey(edge.target, edge.targetHandle)
    uf.union(srcKey, tgtKey)
  }

  const lookup: NetLookupTable = new Map()
  const nets = new Map<string, Set<PortKey>>()

  const addToNet = (netName: string, key: PortKey) => {
    lookup.set(key, netName)
    if (!nets.has(netName)) nets.set(netName, new Set())
    nets.get(netName)!.add(key)
  }

  const rootToNetName = new Map<string, string>()

  const getNetName = (root: string): string => {
    if (rootToNetName.has(root)) return rootToNetName.get(root)!
    const parts = root.split('|')
    const resourceId = parts[1] ?? root
    const netName = buildNetName(resourceId, generateShortId())
    rootToNetName.set(root, netName)
    return netName
  }

  for (const node of nodes) {
    const nid = node.id
    const shaped = shapedRecipes.get(nid)

    if (node.type === 'recipeNode' && shaped) {
      for (const port of shaped.base_inputs ?? []) {
        processPort(port, nid, uf, edges, addToNet, hasEdgeForKey, getNetName, buildGlobalName, buildVoidName, buildResourceId, portKey)
      }
      for (const port of shaped.base_outputs ?? []) {
        processPort(port, nid, uf, edges, addToNet, hasEdgeForKey, getNetName, buildGlobalName, buildVoidName, buildResourceId, portKey)
      }
      for (const port of shaped.base_utility_inputs ?? []) {
        processPort(port, nid, uf, edges, addToNet, hasEdgeForKey, getNetName, buildGlobalName, buildVoidName, buildResourceId, portKey)
      }
      for (const port of shaped.base_utility_outputs ?? []) {
        processPort(port, nid, uf, edges, addToNet, hasEdgeForKey, getNetName, buildGlobalName, buildVoidName, buildResourceId, portKey)
      }
    } else if (node.type === 'sourceNode' || node.type === 'targetNode') {
      const ports = normalizeEndpointPorts(node.data)
      for (const port of ports) {
        processPort(
          { ...port, category: port.category ?? DEFAULT_RESOURCE_CATEGORY },
          nid, uf, edges, addToNet, hasEdgeForKey, getNetName, buildGlobalName, buildVoidName, buildResourceId, portKey
        )
      }
    }
  }

  return { lookup, nets }
}

/**
 * Check whether a given port key participates in at least one edge.
 * @param key     - The port key to check.
 * @param edges   - All physical edges.
 * @param nodeId  - The node ID to match against edge source/target.
 * @returns `true` if the key is found in any edge's source or target.
 */
function hasEdgeForKey(key: PortKey, edges: Edge[], nodeId: string): boolean {
  return edges.some(
    (e) =>
      (e.source === nodeId && portKey(e.source, e.sourceHandle ?? '') === key) ||
      (e.target === nodeId && portKey(e.target, e.targetHandle ?? '') === key)
  )
}

/**
 * Translate a list of port descriptors so that each port ID is replaced by its
 * resolved net name from the lookup table.
 *
 * Ports that have no entry in the lookup receive a void net name.
 *
 * @param ports  - Array of port descriptors, each with at least `id` and optionally `category`.
 * @param nodeId - The node these ports belong to (used to construct the lookup key).
 * @param lookup - The {@link NetLookupTable} produced by {@link buildTopologicalNets}.
 * @returns A new array with translated port IDs (the original array is not mutated).
 *
 * @template T - The port descriptor type (must have `id` and optionally `category`).
 */
export function translatePortIds<T extends { id: string; category?: string }>(
  ports: T[],
  nodeId: string,
  lookup: NetLookupTable
): T[] {
  return ports.map((port) => {
    const qualifiedId = port.category ? `${port.category}:${port.id}` : port.id
    const key = portKey(nodeId, qualifiedId)
    const netName = lookup.get(key)
    if (!netName) {
      return { ...port, id: buildVoidName(nodeId, qualifiedId) }
    }
    return { ...port, id: netName }
  })
}

let _counter = 0

/**
 * Generate a short, probabilistically-unique identifier used as a suffix for
 * net names when multiple nets share the same resource ID.
 *
 * Combines a 16-bit monotonic counter (hex-encoded) with 4 random base-36
 * characters for a total of 8 chars.
 *
 * @returns An 8-character hex+alphanumeric string (e.g. `"003f a1b2"`).
 */
function generateShortId(): string {
  _counter = (_counter + 1) & 0xffff
  const rand = Math.random().toString(36).slice(2, 6)
  return `${_counter.toString(16).padStart(4, '0')}${rand}`
}
