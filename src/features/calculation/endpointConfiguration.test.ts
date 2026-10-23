import { describe, expect, it } from 'vitest'
import type { Node } from 'reactflow'
import { DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'
import { emptyNetworkConfiguration } from './networkConfig'
import { configureEndpointPorts } from './endpointConfiguration'
import { compileNetwork } from './networkCompiler'
import { portKey } from './topology'

/**
 * Create one persisted endpoint with a fractional canonical flow reference.
 * @param type - Supply or consumption node role.
 * @param mode - Legacy editing intent, omitted to exercise creation defaults.
 * @param amount - Resource reference quantity in L per second.
 * @returns A complete node with stable port identity.
 */
function endpoint(type: 'sourceNode' | 'targetNode', mode?: string, amount = 2.5): Node {
  return { id: 'endpoint', type, position: { x: 0, y: 0 }, data: { mode, ports: [{ portId: 'port', category: 'fluid', id: 'water', amount, unit: [{ baseUnitId: 'L', exponent: 1 }] }] } }
}

describe('explicit endpoint creation defaults', () => {
  it.each([
    ['sourceNode', 'limit', { kind: 'source', capacity: 2.5 }],
    ['sourceNode', 'infinite', { kind: 'source', capacity: null }],
    ['sourceNode', undefined, { kind: 'source', capacity: null }],
    ['targetNode', 'demand', { kind: 'delivery', mode: 'at_least', amount: 2.5, capacity: null }],
    ['targetNode', 'maximize', { kind: 'delivery', mode: 'maximize', amount: 0, capacity: null, objective: { priority: 0, weight: 1, scale: 2.5 } }],
    ['targetNode', undefined, { kind: 'delivery', mode: 'maximize', amount: 0, capacity: null, objective: { priority: 0, weight: 1, scale: 2.5 } }],
    ['targetNode', 'overflow', { kind: 'spill', capacity: null }],
  ] as const)('maps %s/%s to the same explicit intent as migration', (type, mode, boundary) => {
    const result = configureEndpointPorts(emptyNetworkConfiguration(), endpoint(type, mode), DEFAULT_UNIT_SNAPSHOT)
    expect(result.ports[portKey('endpoint', 'port')].boundary).toEqual(boundary)
  })
  it('does not turn an auto-filled zero overflow reference into a zero-delivery constraint', () => {
    const target = endpoint('targetNode', 'overflow', 0)
    const source = { ...endpoint('sourceNode', 'limit', 10), id: 'source' }
    let configuration = emptyNetworkConfiguration()
    for (const node of [source, target]) configuration = configureEndpointPorts(configuration, node, DEFAULT_UNIT_SNAPSHOT)
    const model = compileNetwork({ nodes: [source, target], edges: [{ id: 'e', source: 'source', target: 'endpoint', sourceHandle: 'port', targetHandle: 'port' }], recipes: {}, configuration, requestId: 'overflow', documentRevision: 1 })
    const spill = model.request.variables.findIndex(variable => variable.id.startsWith('spill:'))
    expect(spill).toBeGreaterThanOrEqual(0)
    expect(model.request.variables[spill]).toMatchObject({ lower: 0, upper: null })
    expect(model.provenance.variables[spill].kind).toBe('spill')
    expect(model.request.variables.some(variable => variable.id.startsWith('delivery:'))).toBe(false)
  })
  it('converts source limits and keeps explicit existing user policies', () => {
    const node = endpoint('sourceNode', 'limit', 1000)
    node.data.ports[0].unit = [{ baseUnitId: 'L', prefixId: 'milli', exponent: 1 }]
    let configuration = configureEndpointPorts(emptyNetworkConfiguration(), node, DEFAULT_UNIT_SNAPSHOT)
    expect(configuration.ports[portKey('endpoint', 'port')].boundary).toEqual({ kind: 'source', capacity: 1 })
    configuration.ports[portKey('endpoint', 'port')].boundary = { kind: 'source', capacity: 0.25 }
    node.data.mode = 'infinite'
    configuration = configureEndpointPorts(configuration, node, DEFAULT_UNIT_SNAPSHOT)
    expect(configuration.ports[portKey('endpoint', 'port')].boundary).toEqual({ kind: 'source', capacity: 0.25 })
  })
  it('uses a finite positive normalization scale for a zero maximize reference', () => {
    const result = configureEndpointPorts(emptyNetworkConfiguration(), endpoint('targetNode', 'maximize', 0), DEFAULT_UNIT_SNAPSHOT)
    expect(result.ports[portKey('endpoint', 'port')].boundary).toMatchObject({ kind: 'delivery', mode: 'maximize', objective: { scale: 1 } })
  })
})
