import type { Edge, Node } from 'reactflow'
import type { Resource } from '@/common/types/resource'
import { normalizeEndpointPorts } from '@/features/recipe/recipe.endpointNorm'
import { buildResourceId, buildNetName, buildGlobalName, buildVoidName, DEFAULT_RESOURCE_CATEGORY } from '@/common/utils/resourceId'

type PortKey = string

export type NetLookupTable = Map<PortKey, string>

function portKey(nodeId: string, portId: string): PortKey {
  return `${nodeId}|${portId}`
}

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

  allRoots(): Set<string> {
    const roots = new Set<string>()
    for (const key of this.parent.keys()) {
      roots.add(this.find(key))
    }
    return roots
  }
}

export interface TopologicalNets {
  lookup: NetLookupTable
  nets: Map<string, Set<PortKey>>
}

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

function hasEdgeForKey(key: PortKey, edges: Edge[], nodeId: string): boolean {
  return edges.some(
    (e) =>
      (e.source === nodeId && portKey(e.source, e.sourceHandle ?? '') === key) ||
      (e.target === nodeId && portKey(e.target, e.targetHandle ?? '') === key)
  )
}

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
function generateShortId(): string {
  _counter = (_counter + 1) & 0xffff
  const rand = Math.random().toString(36).slice(2, 6)
  return `${_counter.toString(16).padStart(4, '0')}${rand}`
}
