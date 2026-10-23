import { compilerFixture, compilerCases } from '../../../fixtures/compiler/cases'
import fixtures from '../../../fixtures/compiler/models.json'
import { describe, expect, it, vi } from 'vitest'
import * as pipeline from '@/features/modifier/modifier.pipeline'
import { compileNetwork } from './networkCompiler'
import { remapNetworkConfiguration, NetworkConfigurationSchema } from './networkConfig'
import { portKey } from './topology'
import { recipeInputSupply } from '../../../fixtures/compiler/inputSupplyCases'
import { splitterFixture } from '../../../fixtures/compiler/splitterCases'

describe('strict final-port network compiler', () => {
  it('keeps recipe consumption and explicit input supply as separate conserved variables without a wire', () => {
    const input = recipeInputSupply(compilerFixture, 2.5)
    const model = compileNetwork(input)
    expect(input.nodes.some(node => node.type === 'sourceNode')).toBe(false)
    expect(input.edges.some(edge => edge.targetHandle === 'in')).toBe(false)
    const port = model.ports.find(item => item.key === portKey('r', 'in'))!
    const source = model.provenance.variables.findIndex(origin => origin.kind === 'source')
    expect(port.variable).toBe(0)
    expect(port.coefficient).toBe(1)
    expect(source).toBe(1)
    expect(model.request.variables[source].upper).toBe(2.5)
    expect(model.provenance.variables[source]).toMatchObject({ nodeId: 'r', netId: port.netId, portKeys: [port.key] })
    const rowId = Object.entries(model.provenance.rows).find(([, origin]) => origin.netId === port.netId)![0]
    const row = model.request.equalities.row_ids.indexOf(rowId)
    expect(model.request.equalities.entries.filter(entry => entry.row === row)).toEqual([{ row, col: 0, value: -1 }, { row, col: source, value: 1 }])
    delete input.configuration!.ports[portKey('r', 'in')]
    expect(() => compileNetwork(input)).toThrow('Missing positive flow source')
  })
  it('does not extend input supply assumptions to other same-resource ports or illegal node roles', () => {
    const input = recipeInputSupply(compilerFixture, null)
    input.recipes.r.inputs.push({ portId: 'other', category: 'item', id: 'ore', amount: 1 })
    expect(() => compileNetwork(input)).toThrow('Missing positive flow source')
    const target = compilerFixture()
    target.configuration!.ports[portKey('t', 't')].boundary = { kind: 'source', capacity: null }
    expect(() => compileNetwork(target)).toThrow('Source requires an output port or a recipe flow input')
    const splitter = splitterFixture()
    splitter.configuration!.ports[portKey('f', 'in')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: { kind: 'source', capacity: null } }
    expect(() => compileNetwork(splitter)).toThrow('Splitter allocation ports')
    for (const semantics of [{ kind: 'capacity' as const, available: 2 }, { kind: 'state' as const, actual: 1 }]) {
      const nonflow = recipeInputSupply(compilerFixture, null)
      nonflow.configuration!.ports[portKey('r', 'in')].semantics = semantics
      expect(() => compileNetwork(nonflow)).toThrow(semantics.kind === 'capacity' ? 'Capacity pools use fixed available capacity' : 'State ports cannot have flow boundaries')
    }
  })
  it('evaluates each recipe pipeline exactly once for ports, topology and coefficients', () => {
    const spy = vi.spyOn(pipeline, 'runModifierPipeline')
    try {
      compileNetwork(compilerFixture())
      expect(spy).toHaveBeenCalledTimes(1)
    } finally { spy.mockRestore() }
  })
  it('validates persistent addresses and isolates copied ratio groups', () => {
    const input = compilerFixture(), configuration = input.configuration!
    expect(NetworkConfigurationSchema.safeParse({ ...configuration, ports: { bad: {} } }).success).toBe(false)
    const first = configuration.ports[portKey('t', 't')]
    first.boundary = { kind: 'delivery', mode: 'maximize', amount: 0, capacity: null, objective: { priority: 0, weight: 1, scale: 1, ratioGroup: 'shared', ratio: 1 } }
    configuration.ports[portKey('u', 'u')] = structuredClone(first)
    expect(() => remapNetworkConfiguration(configuration, {}, { [portKey('t', 't')]: portKey('copy-t', 't') })).toThrow('Copy all fixed-ratio')
    const copied = remapNetworkConfiguration(configuration, {}, { [portKey('t', 't')]: portKey('copy-t', 't'), [portKey('u', 'u')]: portKey('copy-u', 'u') })
    const boundary = copied.ports[portKey('copy-t', 't')].boundary!
    expect(boundary.kind === 'delivery' && boundary.objective!.ratioGroup).not.toBe('shared')
    expect(Object.keys(copied.ports)).toHaveLength(2)
  })
  it('keeps real solver fixtures identical to current TypeScript compilation', () => {
    expect(compilerCases()).toEqual(fixtures)
  })
  it('creates sparse conservation rows and gross provenance with explicit boundaries', () => {
    const result = compileNetwork(compilerFixture())
    expect(result.request.variables.map(variable => variable.id.split(':')[0])).toEqual(['operation', 'source', 'delivery'])
    expect(result.request.equalities.rhs).toEqual([0, 0])
    expect(result.ports).toHaveLength(4)
    expect(result.provenance.variables).toHaveLength(3)
    expect(result.request.objectives.map(layer => layer.priority)).toEqual([0, 10])
  })
  it('rejects missing input supply and leaves closed coproduct rows intact', () => {
    const input = compilerFixture()
    input.nodes = input.nodes.filter(node => node.id !== 's')
    input.edges = input.edges.filter(edge => edge.source !== 's')
    delete input.configuration!.ports[portKey('s', 's')]
    expect(() => compileNetwork(input)).toThrow('Missing positive flow source')
    const closed = compilerFixture()
    closed.recipes.r.outputs.push({ portId: 'waste', category: 'item', id: 'waste', amount: 2 })
    expect(compileNetwork(closed).request.equalities.row_ids).toHaveLength(3)
  })
  it('has deterministic nets and fingerprints independent of graph ordering and request IDs', () => {
    const input = compilerFixture(), first = compileNetwork(input)
    input.nodes.reverse(); input.edges.reverse(); input.requestId = 'other'
    expect(compileNetwork(input).fingerprint).toBe(first.fingerprint)
  })
  it('requires explicit endpoint assumptions and rejects stale configuration', () => {
    const input = compilerFixture()
    delete input.configuration!.ports[portKey('s', 's')]
    expect(() => compileNetwork(input)).toThrow('Endpoint requires explicit')
    input.configuration!.ports[portKey('missing', 'stale')] = { scopeId: 'a', busId: 'b', semantics: { kind: 'flow' } }
    expect(() => compileNetwork(input)).toThrow('missing port')
  })
  it('isolates same-resource ports until explicitly connected and globals by scope/bus', () => {
    const input = compilerFixture()
    input.recipes.r.inputs.push({ portId: 'coolant', category: 'item', id: 'ore', amount: 1 })
    expect(() => compileNetwork(input)).toThrow('Missing positive flow source')
    input.recipes.r.inputs[1].routing_mode = 'global'
    input.recipes.r.inputs[0].routing_mode = 'global'
    input.nodes[1].data.ports[0].routing_mode = 'global'
    input.edges.shift()
    expect(compileNetwork(input).nets.filter(net => net.resourceId === 'item:ore')).toHaveLength(1)
    input.configuration!.ports[portKey('r', 'coolant')] = { scopeId: 'other', busId: 'default', semantics: { kind: 'flow' } }
    expect(() => compileNetwork(input)).toThrow('Missing positive flow source')
  })
  it('compiles fixed installation load as a constant and rejects automatic installation', () => {
    const input = compilerFixture()
    input.recipes.r.inputs[0].scaling = 'per_installed_machine'
    expect(() => compileNetwork(input)).toThrow('Fixed installation required')
    input.configuration!.machines.r = { installed: 3, operatingUpper: null }
    expect(compileNetwork(input).request.equalities.rhs).toContain(3)
  })
  it('compiles capacity inequality, validates fixed state and maps copied config', () => {
    const input = compilerFixture()
    input.recipes.r.inputs.push({ portId: 'capacity', category: 'item', id: 'service', amount: 2 })
    input.configuration!.ports[portKey('r', 'capacity')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'capacity', available: 5 } }
    expect(compileNetwork(input).request.inequalities.rhs).toEqual([5])
    input.configuration!.ports[portKey('r', 'capacity')].semantics = { kind: 'state', actual: 1, minimum: 2 }
    expect(() => compileNetwork(input)).toThrow('Fixed state requirement failed')
    const copied = remapNetworkConfiguration(input.configuration!, {}, { [portKey('r', 'capacity')]: portKey('copy', 'new') })
    expect(copied.ports[portKey('copy', 'new')]).toBeDefined()
  })
})
