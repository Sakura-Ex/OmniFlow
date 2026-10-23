import { inputSupplyCases } from './inputSupplyCases'
import { installationCases } from './installationCases'
import { splitterCases } from './splitterCases'
import { compileNetwork } from '@/features/calculation/networkCompiler'
import type { Node, Edge } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import type { NetworkCompileInput } from '@/features/calculation/networkCompiler'
import { emptyNetworkConfiguration } from '@/features/calculation/networkConfig'
import { portKey } from '@/features/calculation/topology'
import { modifierRegistry } from '@/features/modifier/modifier.registry'

/** Small complete graph reused as real cross-language solver input. */
export function compilerFixture(): NetworkCompileInput {
  const recipe: RecipeNodeData = { recipe_id: 'r', machine_name: 'test', system: 'vanilla', duration_seconds: 1, inputs: [{ portId: 'in', category: 'item', id: 'ore', amount: 1 }], outputs: [{ portId: 'out', category: 'item', id: 'plate', amount: 1 }], metadata: {} }
  const nodes: Node[] = [
    { id: 'r', type: 'recipeNode', position: { x: 0, y: 0 }, data: {} },
    { id: 's', type: 'sourceNode', position: { x: 0, y: 0 }, data: { ports: [{ portId: 's', category: 'item', id: 'ore', amount: 10 }] } },
    { id: 't', type: 'targetNode', position: { x: 0, y: 0 }, data: { ports: [{ portId: 't', category: 'item', id: 'plate', amount: 10 }] } },
  ]
  const edges: Edge[] = [{ id: 'a', source: 's', target: 'r', sourceHandle: 's', targetHandle: 'in' }, { id: 'b', source: 'r', target: 't', sourceHandle: 'out', targetHandle: 't' }]
  const configuration = emptyNetworkConfiguration()
  configuration.ports[portKey('s', 's')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: { kind: 'source', capacity: 10 } }
  configuration.ports[portKey('t', 't')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: { kind: 'delivery', mode: 'maximize', amount: 0, capacity: null, objective: { priority: 0, weight: 1, scale: 1 } } }
  configuration.minimizeMachines = { priority: 10, weight: 1, scale: 1 }
  return { nodes, edges, recipes: { r: recipe }, configuration, requestId: 'compiler-test', documentRevision: 1 }
}



/** Reproducible compiler outputs consumed by Vitest and the real Python solver. */
export function compilerCases() {
  const cases: Array<{ id: string; request: ReturnType<typeof compileNetwork>["request"]; expected: { status: string; values: number[] | null } }> = []
  const add = (id: string, mutate: (input: NetworkCompileInput) => void, status: string, values: number[] | null) => {
    const input = compilerFixture()
    mutate(input)
    const { request } = compileNetwork(input)
    cases.push({ id, request, expected: { status, values } })
  }
  add('T02-explicit-source', () => {}, 'success', [10, 10, 10])
  add('T04-closed-coproduct', input => {
    input.recipes.r.outputs.push({ portId: 'waste', category: 'item', id: 'waste', amount: 2 })
  }, 'success', [0, 0, 0])
  add('T04-explicit-spill', input => {
    input.recipes.r.outputs.push({ portId: 'waste', category: 'item', id: 'waste', amount: 2 })
    input.configuration!.ports[portKey('r', 'waste')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: { kind: 'spill', capacity: 6 } }
  }, 'success', [3, 3, 3, 6])
  add('T03-exact-demand-infeasible', input => {
    input.configuration!.ports[portKey('t', 't')].boundary = { kind: 'delivery', mode: 'exact', amount: 11, capacity: null }
  }, 'infeasible', null)
  add('T05-capacity-is-upper-bound', input => {
    input.recipes.r.inputs.push({ portId: 'service', category: 'item', id: 'service', amount: 2 })
    input.configuration!.ports[portKey('r', 'service')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'capacity', available: 5 } }
  }, 'success', [2.5, 2.5, 2.5])
  add('T17-fixed-infrastructure-load', input => {
    input.recipes.r.inputs.push({ portId: 'fixed', category: 'item', id: 'ore', amount: 2, scaling: 'per_installed_machine' })
    input.configuration!.machines.r = { installed: 2, operatingUpper: null }
    input.edges.push({ id: 'fixed', source: 's', target: 'r', sourceHandle: 's', targetHandle: 'fixed' })
  }, 'success', [2, 6, 2])
  add('T09-slow-recipe-product-priority', input => {
    input.recipes.r.duration_seconds = 1000
  }, 'success', [10000, 10, 10])
  add('T23-fractional-throughput', input => {
    input.configuration!.ports[portKey('s', 's')].boundary = { kind: 'source', capacity: 0.25 }
  }, 'success', [0.25, 0.25, 0.25])
  add('T02-explicit-infinite-source', input => {
    input.configuration!.ports[portKey('s', 's')].boundary = { kind: 'source', capacity: null }
    input.configuration!.ports[portKey('t', 't')].boundary = { kind: 'delivery', mode: 'exact', amount: 12, capacity: null }
  }, 'success', [12, 12, 12])
  add('T18-fixed-state-qualified', input => {
    input.recipes.r.inputs.push({ portId: 'temperature', category: 'item', id: 'temperature', amount: 500 })
    input.configuration!.ports[portKey('r', 'temperature')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'state', actual: 500, minimum: 400, maximum: 600 } }
  }, 'success', [10, 10, 10])
  add('T22-same-variable-gross-input-output', input => {
    input.recipes.r.outputs.push({ portId: 'return', category: 'item', id: 'ore', amount: 0.5 })
    input.edges.push({ id: 'return', source: 'r', target: 'r', sourceHandle: 'return', targetHandle: 'in' })
  }, 'success', [20, 10, 20])
  add('T05-spill-receives-entire-shared-net', input => {
    input.recipes.r.outputs.push({ portId: 'coproduct', category: 'item', id: 'plate', amount: 1 })
    input.edges.push({ id: 'coproduct', source: 'r', target: 't', sourceHandle: 'coproduct', targetHandle: 't' })
    input.configuration!.ports[portKey('t', 't')].boundary = { kind: 'spill', capacity: 6 }
    input.configuration!.ports[portKey('s', 's')].boundary = { kind: 'source', capacity: 10, cost: { priority: 0, weight: 1, scale: 1 } }
    input.configuration!.machines.r = { installed: 3, operatingUpper: null }
    input.recipes.r.outputs.forEach(port => { port.scaling = 'per_installed_machine' })
  }, 'success', [0, 0, 6])
  add('same-level-normalized-weight', input => {
    input.recipes.r.outputs[0] = { portId: 'out', category: 'item', id: 'ore', amount: 0 }
    input.nodes[2].data.ports[0].id = 'ore'
    input.edges[1] = { id: 'b', source: 's', target: 't', sourceHandle: 's', targetHandle: 't' }
    input.nodes.push({ id: 'u', type: 'targetNode', position: { x: 0, y: 0 }, data: { ports: [{ portId: 'u', category: 'item', id: 'ore', amount: 1 }] } })
    input.edges.push({ id: 'c', source: 's', target: 'u', sourceHandle: 's', targetHandle: 'u' })
    input.configuration!.ports[portKey('u', 'u')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: { kind: 'delivery', mode: 'maximize', amount: 0, capacity: null, objective: { priority: 0, weight: 2, scale: 1 } } }
  }, 'success', [0, 10, 0, 10])
  add('same-level-fixed-ratio', input => {
    input.nodes.push({ id: 'u', type: 'targetNode', position: { x: 0, y: 0 }, data: { ports: [{ portId: 'u', category: 'item', id: 'plate', amount: 1 }] } })
    input.edges.push({ id: 'c', source: 'r', target: 'u', sourceHandle: 'out', targetHandle: 'u' })
    input.configuration!.ports[portKey('t', 't')].boundary = { kind: 'delivery', mode: 'maximize', amount: 0, capacity: null, objective: { priority: 0, weight: 1, scale: 1, ratioGroup: 'products', ratio: 1 } }
    input.configuration!.ports[portKey('u', 'u')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: { kind: 'delivery', mode: 'maximize', amount: 0, capacity: null, objective: { priority: 0, weight: 1, scale: 1, ratioGroup: 'products', ratio: 3 } } }
  }, 'success', [10, 10, 2.5, 7.5])
  add('at-least-delivery-default-minimum-operation', input => {
    delete input.configuration!.minimizeMachines
    input.configuration!.ports[portKey('t', 't')].boundary = { kind: 'delivery', mode: 'at_least', amount: 2, capacity: null }
  }, 'success', [2, 2, 2])
  const modifierId = 'compiler-fixture-dynamic-output'
  const previous = modifierRegistry[modifierId]
  modifierRegistry[modifierId] = { id: modifierId, apiVersion: 2, version: 1, name: 'fixture', ui_schema: [], evaluate: context => ({ recipeOutputs: [...context.recipeOutputs, { portId: 'dynamic:fixture-instance:bonus', category: 'item', id: 'plate', amount: 1 }] }) }
  try {
    add('T11-final-dynamic-ports-compiled-once', input => {
      input.recipes.r.active_modifiers = [{ instance_id: 'fixture-instance', definition_id: modifierId, uiState: {} }]
      input.edges.push({ id: 'bonus', source: 'r', target: 't', sourceHandle: 'dynamic:fixture-instance:bonus', targetHandle: 't' })
    }, 'success', [10, 10, 20])
  } finally {
    if (previous) modifierRegistry[modifierId] = previous
    else delete modifierRegistry[modifierId]
  }
  const dualWater = (input: NetworkCompileInput, coolingAmount: number, firstCapacity: number) => {
    input.recipes.r.inputs[0] = { ...input.recipes.r.inputs[0], category: 'fluid', id: 'water', amount: 2 }
    input.recipes.r.inputs.push({ portId: 'cooling', category: 'fluid', id: 'water', amount: coolingAmount })
    input.nodes.find(node => node.id === 's')!.data.ports[0] = { portId: 's', category: 'fluid', id: 'water', amount: 1 }
    input.nodes.push({ id: 's2', type: 'sourceNode', position: { x: 0, y: 0 }, data: { ports: [{ portId: 's2', category: 'fluid', id: 'water', amount: 1 }] } })
    input.edges.push({ id: 'cooling', source: 's2', target: 'r', sourceHandle: 's2', targetHandle: 'cooling' })
    input.configuration!.ports[portKey('s', 's')].boundary = { kind: 'source', capacity: firstCapacity }
    input.configuration!.ports[portKey('s2', 's2')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: { kind: 'source', capacity: 100 } }
  }
  add('T07-isolated-water-net-cannot-borrow-surplus', input => {
    dualWater(input, 1, 3)
    input.configuration!.ports[portKey('t', 't')].boundary = { kind: 'delivery', mode: 'exact', amount: 2, capacity: null }
  }, 'infeasible', null)
  add('T08-independent-processing-and-cooling-water', input => dualWater(input, 3, 5), 'success', [2.5, 5, 7.5, 2.5])
  for (const display of [false, true]) add(`T10-micro-coproduct-${display ? 'mL-display' : 'L-display'}`, input => {
    input.recipes.r.outputs.push({ portId: 'micro', category: 'fluid', id: 'water', amount: 0.00001, unit: [{ baseUnitId: 'L', exponent: 1 }], displayUnit: [{ baseUnitId: 'L', prefixId: display ? 'milli' : undefined, exponent: 1 }] })
    input.configuration!.ports[portKey('r', 'micro')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: { kind: 'spill', capacity: 0.00005 } }
  }, 'success', [5, 5, 5, 0.00005])
  return [...cases, ...splitterCases(), ...installationCases(compilerFixture), ...inputSupplyCases(compilerFixture)]
}
