import { expect, it } from 'vitest'
import type { GraphPort } from './graphPorts'
import { emptyNetworkConfiguration } from './networkConfig'
import { supplyUnconnectedInputs } from './inputSupply'
import { portKey } from './topology'

const nodes = [{ id: 'r', type: 'recipeNode', position: { x: 0, y: 0 }, data: {} }, { id: 's', type: 'sourceNode', position: { x: 0, y: 0 }, data: {} }]
const port = (id: string, overrides: Partial<GraphPort> = {}): GraphPort => ({ nodeId: 'r', portId: id, direction: 'input', resourceId: 'item:ore', port: { id: 'ore', category: 'item', amount: 2, routing_mode: 'wired' }, ...overrides })

it('adds only explicit unlimited supply to unconnected recipe flow inputs without mutating the original', () => {
  const configuration = emptyNetworkConfiguration()
  configuration.ports[portKey('r', 'eligible')] = { scopeId: 'scope', busId: 'bus', semantics: { kind: 'flow' } }
  const before = structuredClone(configuration)
  const result = supplyUnconnectedInputs([port('eligible')], nodes, [], configuration)
  expect(result.ports[portKey('r', 'eligible')]).toEqual({ scopeId: 'scope', busId: 'bus', semantics: { kind: 'flow' }, boundary: { kind: 'source', capacity: null } })
  expect(configuration).toEqual(before)
  expect(result).not.toBe(configuration)
})

it('skips connected, global, output, endpoint, zero-flow and inventory ports', () => {
  const ports = [port('wired'), port('broken'), port('global', { port: { ...port('x').port, routing_mode: 'global' } }), port('output', { direction: 'output' }), port('source', { nodeId: 's' }), port('zero', { port: { ...port('x').port, amount: 0 } }), port('catalyst', { port: { ...port('x').port, consumable: false } }), port('zero-loss', { port: { ...port('x').port, probability: 0 } })]
  const edges = [{ id: 'e', source: 's', target: 'r', sourceHandle: 'out', targetHandle: 'wired' }, { id: 'broken', source: 'r', target: 'missing', sourceHandle: 'broken', targetHandle: 'deleted' }]
  expect(supplyUnconnectedInputs(ports, nodes, edges, emptyNetworkConfiguration()).ports).toEqual({})
})

it('preserves existing supply limits, delivery and spill policies plus capacity and state', () => {
  const configuration = emptyNetworkConfiguration()
  configuration.ports[portKey('r', 'limited')] = { scopeId: 's', busId: 'b', semantics: { kind: 'flow' }, boundary: { kind: 'source', capacity: 4 } }
  configuration.ports[portKey('r', 'closed')] = { scopeId: 's', busId: 'b', semantics: { kind: 'flow' }, boundary: { kind: 'forbid_spill' } }
  configuration.ports[portKey('r', 'capacity')] = { scopeId: 's', busId: 'b', semantics: { kind: 'capacity', available: 5 } }
  configuration.ports[portKey('r', 'state')] = { scopeId: 's', busId: 'b', semantics: { kind: 'state', actual: 300 } }
  const ports = ['limited', 'closed', 'capacity', 'state'].map(id => port(id))
  expect(supplyUnconnectedInputs(ports, nodes, [], configuration)).toEqual(configuration)
})
