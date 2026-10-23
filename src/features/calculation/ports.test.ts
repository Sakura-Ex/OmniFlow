import { afterEach, describe, expect, it } from 'vitest'
import type { Node, Edge } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import { normalizeGraph } from '@/features/canvas/graphDocument'
import { cloneSubgraph } from '@/features/canvas/cloneSubgraph'
import { buildTopologicalNets, portKey } from './topology'
import { compileNetwork } from './networkCompiler'
import { emptyNetworkConfiguration } from './networkConfig'
import { configureEndpointPorts } from './endpointConfiguration'
import { connectionIssue, graphPorts } from './graphPorts'
import { modifierRegistry } from '@/features/modifier/modifier.registry'
import { DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'

const recipe: RecipeNodeData = {
  recipe_id: 'r', machine_name: 'Dual water', system: 'custom', duration_seconds: 1,
  inputs: [
    { category: 'fluid', id: 'water', portId: 'process', amount: 2 },
    { category: 'fluid', id: 'water', portId: 'cooling', amount: 3 },
  ],
  outputs: [{ category: 'fluid', id: 'water', portId: 'return', amount: 1 }], metadata: {},
}
const nodes: Node[] = [
  { id: 'r', type: 'recipeNode', position: { x: 0, y: 0 }, data: recipe },
  ...['a', 'b'].map((id) => ({ id, type: 'sourceNode', position: { x: 0, y: 0 }, data: { mode: 'limit', ports: [{ category: 'fluid', id: 'water', portId: `source-${id}`, amount: 10 }] } })),
]
const edges: Edge[] = [
  { id: 'a-r', source: 'a', sourceHandle: 'source-a', target: 'r', targetHandle: 'process' },
  { id: 'b-r', source: 'b', sourceHandle: 'source-b', target: 'r', targetHandle: 'cooling' },
]
const compile = (nodes: Node[], edges: Edge[], recipes: Record<string, RecipeNodeData>, environment = DEFAULT_UNIT_SNAPSHOT) => {
  let configuration = emptyNetworkConfiguration()
  for (const node of nodes) configuration = configureEndpointPorts(configuration, node, environment)
  return compileNetwork({ nodes, edges, recipes, environment, configuration, requestId: 'ports-test', documentRevision: 1 })
}

afterEach(() => { delete modifierRegistry.dynamic })

describe('independent persistent port identities (T07/T08/T22)', () => {
  it('routes processing water and cooling water independently before aggregating', () => {
    const { recipes } = normalizeGraph(nodes, edges)
    const topology = buildTopologicalNets(nodes, edges, new Map(Object.entries(recipes)))
    const process = topology.lookup.get(portKey('r', 'process'))!
    const cooling = topology.lookup.get(portKey('r', 'cooling'))!
    expect(process).not.toBe(cooling)
    expect(topology.lookup.get(portKey('r', 'return'))).not.toBe(process)
    const model = compile(nodes, edges, recipes)
    expect(model.ports.filter(port => port.nodeId === 'r' && port.direction === 'input').map(port => port.coefficient)).toEqual([2, 3])
    expect(new Set(model.ports.filter(port => port.nodeId === 'r').map(port => port.netId)).size).toBe(3)
  })
  it('aggregates same-resource input/output only when explicitly wired to the same net', () => {
    const { recipes } = normalizeGraph(nodes, edges)
    const wiring = [...edges, { id: 'return', source: 'r', sourceHandle: 'return', target: 'r', targetHandle: 'process' }]
    const model = compile(nodes, wiring, recipes)
    const input = model.ports.find(port => port.portId === 'process')!
    const output = model.ports.find(port => port.portId === 'return')!
    expect(input.netId).toBe(output.netId)
    expect(input.coefficient - output.coefficient).toBe(1)
  })
  it('keeps identity and deterministic nets through reorder and JSON round trips', () => {
    const graph = normalizeGraph(nodes, edges)
    const before = buildTopologicalNets(graph.nodes, edges, new Map(Object.entries(graph.recipes)))
    const reordered = structuredClone(graph)
    reordered.recipes.r.base_inputs!.reverse()
    reordered.nodes.reverse()
    const after = buildTopologicalNets(JSON.parse(JSON.stringify(reordered.nodes)), [...edges].reverse(), new Map(Object.entries(reordered.recipes)))
    expect(Object.fromEntries(after.lookup)).toEqual(Object.fromEntries(before.lookup))
  })
  it('checks resource identity after handle resolution, including deleted ports', () => {
    const graph = normalizeGraph(nodes, edges)
    const ports = graphPorts(graph.nodes, graph.recipes)
    expect(connectionIssue(edges[0], ports)).toBeNull()
    expect(connectionIssue({ ...edges[0], targetHandle: 'deleted' }, ports)).toContain('Missing input')
    const incompatible = ports.map((p) => p.portId === 'process' ? { ...p, resourceId: 'fluid:oil' } : p)
    expect(connectionIssue(edges[0], incompatible)).toContain('Incompatible resources')
    expect(() => compile(nodes, [{ ...edges[0], targetHandle: 'deleted' }], graph.recipes)).toThrow('a-r')
  })
  it('migrates unique legacy handles and preserves ambiguous data for repair', () => {
    const legacy = [{ ...edges[0], sourceHandle: 'fluid:water', targetHandle: 'fluid:water' }]
    const graph = normalizeGraph(nodes, legacy, {}, true)
    expect(graph.edges[0].sourceHandle).toBe('source-a')
    expect(graph.edges[0].targetHandle).toBe('fluid:water')
    expect(graph.edges[0].data.portIssue).toContain('ambiguous')
    expect(graph.edges[0].data.legacyHandles).toEqual({ source: 'fluid:water', target: 'fluid:water' })
  })
  it('checks duplicate legacy UIDs instead of assuming they are unique port IDs', () => {
    const raw = { ...recipe, inputs: recipe.inputs.map((p) => ({ ...p, portId: undefined, _uid: 'duplicate' })) }
    const graph = normalizeGraph([{ ...nodes[0], data: raw }], [])
    const ports = graph.recipes.r.base_inputs!
    expect(new Set(ports.map((p) => p.portId)).size).toBe(2)
    expect(() => normalizeGraph([{ ...nodes[0], data: { ...recipe, inputs: recipe.inputs.map((p) => ({ ...p, portId: 'same' })) } }], [])).toThrow('Duplicate portId')
  })
  it('rebuilds copied identities and remaps internal edges without dragging in outside nodes', () => {
    const graph = normalizeGraph(nodes, edges)
    const copied = cloneSubgraph(graph.nodes.slice(0, 2), edges)
    expect(copied.nodes).toHaveLength(2)
    expect(copied.edges).toHaveLength(1)
    const copiedRecipe = Object.values(copied.recipes)[0]
    expect(copiedRecipe.base_inputs![0].portId).not.toBe('process')
    expect(copied.edges[0].targetHandle).toBe(copiedRecipe.base_inputs![0].portId)
    expect(copied.edges[0].sourceHandle).toBe(copied.nodes[1].data.ports[0].portId)
    expect(copied.edges[0].target).toBe(copied.nodes[0].id)
  })
  it('routes dynamic final ports and rejects edges to removed ports (T11)', () => {
    modifierRegistry.dynamic = { id: 'dynamic', name: 'Dynamic', apiVersion: 2, version: 1, ui_schema: [], evaluate: (ctx) => ({ recipeOutputs: [{ category: 'fluid', id: 'water', portId: `dynamic:${ctx.instanceId}:water`, amount: 7 }] }) }
    const dynamic = { ...recipe, active_modifiers: [{ definition_id: 'dynamic', instance_id: 'dyn', uiState: {} }] }
    const graph = normalizeGraph([{ ...nodes[0], data: dynamic }, ...nodes.slice(1)], [])
    const wiring = [{ id: 'dyn', source: 'r', sourceHandle: 'dynamic:dyn:water', target: 'r', targetHandle: 'process' }]
    const model = compile(graph.nodes, [...edges, ...wiring], graph.recipes)
    expect(model.ports.find(port => port.portId === 'dynamic:dyn:water')?.coefficient).toBe(7)
    expect(() => compile(graph.nodes, [{ ...wiring[0], sourceHandle: 'return' }], graph.recipes)).toThrow('Missing output')
  })
  it('rejects incompatible quantities for the same resource even on disconnected nets', () => {
    const graph = normalizeGraph(nodes, edges)
    graph.recipes.r.base_inputs![0].unit = [{ baseUnitId: 'g', exponent: 1 }]
    expect(() => compile(nodes, edges, graph.recipes)).toThrow('Incompatible units')
  })
  it('normalizes explicit endpoint capacities and preserves identities after reorder', () => {
    const source = { ...nodes[1], data: { mode: 'limit', ports: [
      { category: 'item', id: 'powder', portId: 'mass', amount: 1, unit: [{ baseUnitId: 'g', prefixId: 'k', exponent: 1 }] },
      { category: 'item', id: 'ore', portId: 'fraction', amount: 0.25 },
    ] } }
    const result = compile([source], [], {})
    expect(result.request.variables.map(variable => variable.upper)).toEqual([1000, 0.25])
    const reversed = compile([{ ...source, data: { ...source.data, ports: [...source.data.ports].reverse() } }], [], {})
    expect(Object.fromEntries(result.request.variables.map(variable => [variable.id, variable.upper]))).toEqual(Object.fromEntries(reversed.request.variables.map(variable => [variable.id, variable.upper])))
  })
  it('recompiles with explicit TPS and ignores stale preview caches', () => {
    const graph = normalizeGraph([{ ...nodes[0], data: { ...recipe, inputs: [{ category: 'energy', id: 'gt_eu', amount: 32, time_base: 'rate_per_tick' }] } }], [])
    const energy = graph.recipes.r.base_inputs![0]
    const twenty = graphPorts(graph.nodes, graph.recipes).find(port => port.portId === energy.portId)!
    const forty = graphPorts(graph.nodes, graph.recipes, { ...DEFAULT_UNIT_SNAPSHOT, ticksPerSecond: 40 }).find(port => port.portId === energy.portId)!
    expect(twenty.port.amount).toBe(640)
    expect(forty.port.amount).toBe(1280)
  })
})
