/**
 * Topological Net Compiler
 *
 * Implements EDA-style "net" isolation: every set of ports that are physically
 * wired together shares one globally-unique Net ID. This prevents the backend
 * matrix solver from incorrectly pooling resources that happen to share the
 * same item/fluid ID but are in disconnected sub-graphs.
 *
 * Port naming after compilation:
 *   Wired  → Net_<originalId>_<uuid>   (one per connected component)
 *   Global → Global_<originalId>        (joins the implicit global bus)
 *   Void   → Void_<nodeId>_<originalId> (isolated, no connection)
 */

import type { Edge, Node } from 'reactflow'
import type { Resource } from '../types/types'

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

/**
 * Determines the routing mode of a specific port on a recipe node.
 * Returns 'global' | 'wired'. Non-recipe nodes are always 'wired'.
 */
function getPortRoutingMode(
  nodeId: string,
  portId: string,
  role: 'source' | 'target',
  shapedRecipes: Map<string, { base_inputs?: Resource[]; base_outputs?: Resource[] }>
): 'global' | 'wired' {
  const shaped = shapedRecipes.get(nodeId)
  if (!shaped) return 'wired'
  const ports = role === 'source' ? (shaped.base_outputs ?? []) : (shaped.base_inputs ?? [])
  const port = ports.find((p) => p.id === portId)
  return port?.routing_mode === 'global' ? 'global' : 'wired'
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
 * Task 1: Build topological nets from the React Flow graph.
 *
 * @param nodes  React Flow nodes (only recipeNode, sourceNode, targetNode matter)
 * @param edges  React Flow edges (physical wired connections only)
 * @param shapedRecipes  Pre-shaped recipe data, needed to resolve routing_mode
 */
export function buildTopologicalNets(
  nodes: Node[],
  edges: Edge[],
  shapedRecipes: Map<string, { base_inputs?: Resource[]; base_outputs?: Resource[] }>
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
    // Extract a readable resource-ID fragment from the root key
    const parts = root.split('|')
    const resourceId = parts[1] ?? root
    // Use a short deterministic suffix so duplicate resource IDs across
    // different connected components still get distinct net names.
    const suffix = generateShortId()
    const netName = `Net_${sanitize(resourceId)}_${suffix}`
    rootToNetName.set(root, netName)
    return netName
  }

  for (const node of nodes) {
    const nid = node.id
    const shaped = shapedRecipes.get(nid)

    if (node.type === 'recipeNode' && shaped) {
      for (const port of shaped.base_inputs ?? []) {
        if (!port.id) continue
        const key = portKey(nid, port.id)
        if (port.routing_mode === 'global') {
          addToNet(`Global_${port.id}`, key)
        } else if (uf.find(key) !== key || hasEdgeForKey(key, edges, nid)) {
          // Port appears in a wired edge: assign to its connected-component net
          addToNet(getNetName(uf.find(key)), key)
        } else {
          // Void: no connection
          addToNet(`Void_${nid}_${port.id}`, key)
        }
      }
      for (const port of shaped.base_outputs ?? []) {
        if (!port.id) continue
        const key = portKey(nid, port.id)
        if (port.routing_mode === 'global') {
          addToNet(`Global_${port.id}`, key)
        } else if (uf.find(key) !== key || hasEdgeForKey(key, edges, nid)) {
          addToNet(getNetName(uf.find(key)), key)
        } else {
          addToNet(`Void_${nid}_${port.id}`, key)
        }
      }
    } else if (node.type === 'sourceNode' || node.type === 'targetNode') {
      // Source/target nodes have a single implicit port whose ID is node.data.id
      const resourceId: string = node.data?.id ?? nid
      const key = portKey(nid, resourceId)
      // Source/Target nodes never carry global routing; they're always wired.
      if (uf.find(key) !== key || hasEdgeForKey(key, edges, nid)) {
        addToNet(getNetName(uf.find(key)), key)
      } else {
        addToNet(`Void_${nid}_${resourceId}`, key)
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
export function translatePortIds(
  ports: Array<{ id: string; [key: string]: any }>,
  nodeId: string,
  lookup: NetLookupTable
): Array<{ id: string; [key: string]: any }> {
  return ports.map((port) => {
    const key = portKey(nodeId, port.id)
    const netName = lookup.get(key)
    if (!netName) {
      // Fallback: treat as void (should not normally happen if all ports are registered)
      return { ...port, id: `Void_${nodeId}_${port.id}` }
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

function sanitize(id: string): string {
  // Keep letters, digits, colons and underscores; replace everything else.
  return id.replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 32)
}
