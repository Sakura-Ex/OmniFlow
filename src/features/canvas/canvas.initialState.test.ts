import { describe, expect, it } from 'vitest'
import { initialNodes, initialEdges, initialConfiguration, initialEnvironment } from './canvas.initialState'
import { normalizeGraph } from './graphDocument'
import { configureEndpointPorts } from '@/features/calculation/endpointConfiguration'
import { compileNetwork } from '@/features/calculation/networkCompiler'
import { portKey } from '@/features/calculation/topology'

describe('starter steel line', () => {
  it('compiles a complete, unconstrained-machine line with a ten-per-minute demand', () => {
    const graph = normalizeGraph(initialNodes, initialEdges, {}, true)
    const configuration = graph.nodes.reduce((config, node) => configureEndpointPorts(config, node, initialEnvironment), initialConfiguration)
    expect(graph.nodes).toHaveLength(8)
    expect(configuration.ports[portKey('target-1', 'endpoint:0')].boundary).toMatchObject({ kind: 'delivery', mode: 'at_least', amount: 10 / 60 })
    const model = compileNetwork({ ...graph, configuration, environment: initialEnvironment, requestId: 'starter', documentRevision: 1 })
    expect(model.request.variables.filter(variable => variable.id.startsWith('operation:')).every(variable => variable.upper === null)).toBe(true)
    // A real feasible witness: 10 furnaces, 5/3 macerators and 5/6 electrolyzers.
    const operations: Record<string, number> = { 'node-1': 5 / 6, 'node-2': 5 / 3, 'node-3': 10 }
    const x = model.provenance.variables.map(origin => origin.kind === 'operation' ? operations[origin.nodeId!] : 0)
    for (const net of model.nets) {
      const ports = model.ports.filter(port => port.netId === net.id)
      const balance = ports.reduce((sum, port) => sum + (port.direction === 'output' ? 1 : -1) * (port.variable === null ? port.constant : port.coefficient * x[port.variable] + port.constant), 0)
      const boundary = model.provenance.variables.findIndex(origin => origin.netId === net.id && ['source', 'spill', 'delivery'].includes(origin.kind))
      if (boundary >= 0) x[boundary] = Math.abs(balance)
    }
    for (const rows of [model.request.equalities, model.request.inequalities]) {
      rows.rhs.forEach((rhs, row) => {
        const actual = rows.entries.filter(entry => entry.row === row).reduce((sum, entry) => sum + entry.value * x[entry.col], 0)
        if (rows === model.request.equalities) expect(actual).toBeCloseTo(rhs, 8)
        else expect(actual).toBeLessThanOrEqual(rhs + 1e-8)
      })
    }
    const delivery = model.provenance.variables.findIndex(origin => origin.kind === 'delivery')
    expect(x[delivery]).toBeCloseTo(10 / 60)
    model.request.variables.forEach((variable, i) => {
      expect(x[i]).toBeGreaterThanOrEqual(variable.lower ?? -Infinity)
      expect(x[i]).toBeLessThanOrEqual(variable.upper ?? Infinity)
    })
  })
})
