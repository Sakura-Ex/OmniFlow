/**
 * Topological Net Compiler
 *
 * Implements EDA-style "net" isolation: every set of ports that are physically
 * wired together shares one globally-unique Net ID. This prevents the backend
 * matrix solver from incorrectly pooling resources that happen to share the
 * same item/fluid ID but are in disconnected sub-graphs.
 *
 * Port naming after compilation:
 *   Wired  → Net_<resourceId>_<suffix> (one per connected component)
 *   Global → Global_<qualifier>        (joins the implicit global bus)
 *   Void   → Void_<nodeId>_<fullId>    (isolated, no connection)
 *
 * @see resourceIdentifier.ts for unified builders / parsers
 */

import type { Edge, Node } from 'reactflow'
import type { Resource } from '../../types/types'
import { normalizeEndpointPorts } from '../../utils/endpointNorm'
import { buildResourceId, buildNetName, buildGlobalName, buildVoidName } from '../../utils/resourceIdentifier'

/** Key used to look up a port in the net table: "<nodeId>|<portId>" */
type PortKey = string

/** Maps each port key to its compiled net name */
export type NetLookupTable = Map<PortKey, string>

function portKey(nodeId: string, portId: string): PortKey {
  return `${nodeId}|${portId}`
}

/**
 * Union-Find (Disjoint Set Union) for efficient connected-component detection.
 */
class UnionFind {
  private parent: Map<string, string> = new Map()

  private ensure(id: string) {
    if (!this.parent.has(id)) this.parent.set(id, id)
  }

  find(id: string): string {
    this.ensure(id)
    let root = id
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!
    }
    // Path compression
    let cur = id
    while (cur !== root) {
      const next = this.parent.get(cur)!
      this.parent.set(cur, root)
      cur = next
    }
    return root
  }

  union(a: string, b: string) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }

  /** Returns all roots that have ever been created. */
  allRoots(): Set<string> {
    const roots = new Set<string>()
    for (const key of this.parent.keys()) {
      roots.add(this.find(key))
    }
    return roots
  }
}

export interface TopologicalNets {
  /**
   * Full lookup: portKey(nodeId, portId) → compiled net name.
   * Only contains ports that are either wired (in a net) or were explicitly
   * registered via registerAllPorts.
   */
  lookup: NetLookupTable
  /** Net name → set of port keys that belong to it (for debugging). */
  nets: Map<string, Set<PortKey>>
}

/**
 * Process a single port: determine its compiled net name and add it to the
 * lookup table.  Three outcomes are possible:
 *   1. Global   → port joins the implicit global bus for its category
 *   2. Wired    → port is part of a connected component (has an edge or
 *                  is unioned with another port via a wire)
 *   3. Void     → port is isolated, gets a unique void name
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
 * Task 1: Build topological nets from the React Flow graph.
 *
 * @param nodes  React Flow nodes (only recipeNode, sourceNode, targetNode matter)
 * @param edges  React Flow edges (physical wired connections only)
 * @param shapedRecipes  Pre-shaped recipe data, needed to resolve routing_mode
 */
export function buildTopologicalNets(
  nodes: Node[],
  edges: Edge[],
  shapedRecipes: Map<string, { base_inputs?: Resource[]; base_outputs?: Resource[]; base_utility_inputs?: Resource[]; base_utility_outputs?: Resource[] }>
): TopologicalNets {
  const uf = new UnionFind()

  // Step 1: register every port that appears on a wired edge into the UF
  // and union the two endpoints together (they share a physical wire).
  for (const edge of edges) {
    if (!edge.sourceHandle || !edge.targetHandle) continue
    const srcKey = portKey(edge.source, edge.sourceHandle)
    const tgtKey = portKey(edge.target, edge.targetHandle)
    uf.union(srcKey, tgtKey)
  }

  // Step 2: for every port on every node, determine its net name.
  const lookup: NetLookupTable = new Map()
  const nets = new Map<string, Set<PortKey>>()

  const addToNet = (netName: string, key: PortKey) => {
    lookup.set(key, netName)
    if (!nets.has(netName)) nets.set(netName, new Set())
    nets.get(netName)!.add(key)
  }

  // Stable net IDs: two ports in the same connected component share a root
  // in the UF.  We derive the net name from the root key + a short hash so
  // the human-readable original resource ID is preserved.
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
          { ...port, category: port.category ?? 'item' },
          nid, uf, edges, addToNet, hasEdgeForKey, getNetName, buildGlobalName, buildVoidName, buildResourceId, portKey
        )
      }
    }
  }

  return { lookup, nets }
}

/** Returns true if any wired edge references this portKey (by source or target). */
function hasEdgeForKey(key: PortKey, edges: Edge[], nodeId: string): boolean {
  return edges.some(
    (e) =>
      (e.source === nodeId && portKey(e.source, e.sourceHandle ?? '') === key) ||
      (e.target === nodeId && portKey(e.target, e.targetHandle ?? '') === key)
  )
}

/**
 * Task 2: Rewrite resource IDs in a port list using the net lookup table.
 *
 * @param ports      Array of legacy ports (id, amount, type, …)
 * @param nodeId     The owning node's ID
 * @param lookup     Net lookup table from buildTopologicalNets
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
      // Fallback: treat as void (should not normally happen if all ports are registered)
      return { ...port, id: buildVoidName(nodeId, qualifiedId) }
    }
    return { ...port, id: netName }
  })
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

let _counter = 0
function generateShortId(): string {
  // Combine a monotonic counter with a random fragment for uniqueness within a
  // single compilation run.  Resets across page reloads which is fine.
  _counter = (_counter + 1) & 0xffff
  const rand = Math.random().toString(36).slice(2, 6)
  return `${_counter.toString(16).padStart(4, '0')}${rand}`
}

