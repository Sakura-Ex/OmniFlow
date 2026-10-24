import { describe, expect, it } from 'vitest'
import type { Node } from 'reactflow'
import type { CalculateResponse } from '@/common/types/api'
import { emptyNetworkConfiguration } from '@/common/schemas/network.schema'
import { deliveryResources, deliverySummary, installationSummary, internalResultResources, resultQuantity, startupCanonicalAmount } from './resultSummary'
import { documentResultEvidence, compiledResultEvidence } from './resultEvidence'
import { DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'
import { compileNetwork } from '@/features/calculation/networkCompiler'
import { configureEndpointPorts } from '@/features/calculation/endpointConfiguration'

describe('core result evidence', () => {
  it('captures compiled delivery units and labels independently of later document edits', () => {
    const unit = [{ baseUnitId: 'g', prefixId: 'k', exponent: 1 }]
    const nodes: Node[] = [
      { id: 's', type: 'sourceNode', position: { x: 0, y: 0 }, data: { mode: 'infinite', ports: [{ portId: 'out', category: 'item', id: 'ore', amount: 1, unit }] } },
      { id: 't', type: 'targetNode', position: { x: 300, y: 0 }, data: { mode: 'demand', ports: [{ portId: 'in', category: 'item', id: 'ore', amount: 1, unit }] } },
    ]
    const environment = structuredClone(DEFAULT_UNIT_SNAPSHOT)
    const configuration = nodes.reduce((current, node) => configureEndpointPorts(current, node, environment), emptyNetworkConfiguration())
    const model = compileNetwork({ nodes, edges: [{ id: 'e', source: 's', sourceHandle: 'out', target: 't', targetHandle: 'in' }], recipes: {}, configuration, environment, requestId: 'display', documentRevision: 0 })
    const entries = { 'item:ore': { fullId: 'item:ore', displayName: 'Old ore' } }
    const evidence = compiledResultEvidence(model, entries)
    entries['item:ore'].displayName = 'New ore'
    environment.prefixes = []
    nodes.length = 0
    expect(evidence.resources['item:ore'].name).toBe('Old ore')
    expect(evidence.targets).toEqual([{ resourceId: 'item:ore', unit }])
    expect(resultQuantity('item:ore', 2000, evidence)).toEqual({ value: '2', unit: 'kg/s', unavailable: false })
  })

  it('keeps native rates, ordinary rates and material occupancy distinct', () => {
    const evidence = documentResultEvidence([], {}, emptyNetworkConfiguration(), DEFAULT_UNIT_SNAPSHOT, {})
    evidence.resources['energy:power'] = { unit: [{ baseUnitId: 'W', exponent: 1 }], global: false }
    evidence.resources['item:material'] = { unit: [{ baseUnitId: 'g', prefixId: 'k', exponent: 1 }], occupancyUnit: [{ baseUnitId: 'g', exponent: 1 }], global: false }
    expect(resultQuantity('energy:power', 15, evidence)).toEqual({ value: '15', unit: 'W', unavailable: false })
    expect(resultQuantity('item:material', 2000, evidence)).toEqual({ value: '2', unit: 'kg/s', unavailable: false })
    expect(resultQuantity('item:material', 2000, evidence, 'occupancy').unit).toBe('g')
    expect(resultQuantity('item:material', undefined, evidence).value).toBe('—')
    evidence.resources['item:material'].unit = [{ baseUnitId: 'missing', exponent: 1 }]
    expect(resultQuantity('item:material', 2000, evidence)).toEqual({ value: '—', unit: '?', unavailable: true })
  })

  it('does not infer zero throughput or internal resources from current recipes or disposal', () => {
    expect(internalResultResources({ status: 'success', system_spills: { 'item:waste': 3 }, net_summaries: [
      { id: 'a', resourceId: 'item:waste', portKeys: [], source: 0, delivery: 0, spill: 3 },
      { id: 'b', resourceId: 'item:intermediate', portKeys: [], source: 0, delivery: 0, spill: 0 },
    ] })).toEqual(['item:intermediate'])
  })

  it('converts repeated startup declarations in their own source units', () => {
    const evidence = documentResultEvidence([], {}, emptyNetworkConfiguration(), DEFAULT_UNIT_SNAPSHOT, {})
    evidence.occupancyUnits.r = [[{ baseUnitId: 'g', prefixId: 'k', exponent: 1 }], [{ baseUnitId: 'g', exponent: 1 }]]
    const result: CalculateResponse = { status: 'success', startup: { status: 'needs_confirmation', cycles: [], preheat: [], catalysts: [
      { nodeId: 'r', resourceId: 'item:material', amount: 2 }, { nodeId: 'r', resourceId: 'item:material', amount: 3 },
    ] } }
    expect(startupCanonicalAmount(result, 0, evidence)).toBe(2000)
    expect(startupCanonicalAmount(result, 1, evidence)).toBe(3)
    expect(startupCanonicalAmount(result, 2, evidence)).toBeUndefined()
  })

  it('finds explicit deliveries, deduplicates resource identity and excludes spill and capacity', () => {
    const configuration = emptyNetworkConfiguration()
    const nodes: Node[] = ['a', 'b', 'spill', 'capacity'].map(id => ({ id, type: 'targetNode', position: { x: 0, y: 0 }, data: { ports: [{ portId: 'p', category: 'item', id: id === 'spill' ? 'waste' : 'iron', amount: 1 }] } }))
    for (const node of nodes) configuration.ports[JSON.stringify([node.id, 'p'])] = {
      scopeId: 'document', busId: 'default', semantics: node.id === 'capacity' ? { kind: 'capacity', available: 4 } : { kind: 'flow' },
      boundary: node.id === 'spill' ? { kind: 'spill', capacity: null } : { kind: 'delivery', mode: 'at_least', amount: 1, capacity: null },
    }
    expect(deliveryResources(nodes, {}, configuration)).toEqual([{ resourceId: 'item:iron', unit: undefined }])
    expect(deliveryResources(nodes, {}, emptyNetworkConfiguration())).toEqual([])
  })

  it('uses gross delivery once and keeps independent resources and dimensions separate', () => {
    const result = { status: 'success' as const, system_outputs: { 'item:iron': 3, 'fluid:water': 25 }, system_spills: { 'item:iron': 7 }, net_summaries: [{ id: 'net', resourceId: 'item:iron', portKeys: ['a', 'b'], source: 10, delivery: 3, spill: 7 }] }
    expect(deliverySummary(result, [])).toEqual([{ resourceId: 'fluid:water', amount: 25 }, { resourceId: 'item:iron', amount: 3 }])
  })

  it('does not fabricate values without a result or guess a delivery from a spill', () => {
    expect(deliverySummary(null, [{ resourceId: 'item:iron' }])).toEqual([{ resourceId: 'item:iron', amount: undefined }])
    expect(deliverySummary({ status: 'success', system_spills: { 'item:waste': 7 } }, [])).toEqual([])
    expect(installationSummary(null, {})).toEqual({ total: null, types: [] })
  })

  it('keeps declared delivery rows unknown when result evidence is absent or invalid', () => {
    const targets = [{ resourceId: 'item:iron' }, { resourceId: 'fluid:water' }]
    expect(deliverySummary({ status: 'success' }, targets)).toEqual([{ resourceId: 'fluid:water', amount: undefined }, { resourceId: 'item:iron', amount: undefined }])
    for (const amount of [NaN, Infinity, -1]) expect(deliverySummary({ status: 'success', system_outputs: { 'item:iron': amount } }, targets)[1].amount).toBeUndefined()
    expect(deliverySummary({ status: 'success', system_outputs: { 'item:iron': 0 } }, targets)[1].amount).toBe(0)
  })

  it('does not call missing installation evidence zero, but allows a verified zero plan', () => {
    const recipes = { a: { machine_name: 'Furnace', system: 'gregtech' } }
    const incompletePlans: CalculateResponse['node_results'][] = [undefined, {}, { a: { operating_equivalent: 0 } }, { a: { planned_installed: NaN } }, { a: { planned_installed: 0.5 } }]
    for (const node_results of incompletePlans) {
      expect(installationSummary({ status: 'success', node_results }, recipes).total).toBeNull()
    }
    expect(installationSummary({ status: 'success', node_results: { a: { operating_equivalent: 0 } } }, {}).total).toBeNull()
    expect(installationSummary({ status: 'success', node_results: { a: { planned_installed: 0 } } }, recipes).total).toBe(0)
    expect(installationSummary({ status: 'success', node_results: {} }, {}).total).toBe(0)
  })

  it('totals installation plans, not operation, existing, additional or BOM quantities', () => {
    const recipes = { a: { machine_name: 'Furnace', system: 'gregtech' }, b: { machine_name: 'Furnace', system: 'gregtech' } }
    const result = { status: 'success' as const, bom: { 'item:frame': 100 }, node_results: {
      a: { planned_installed: 2, operating_equivalent: 1.1, existing_installed: 1, additional_installed: 1 },
      b: { planned_installed: 3, recommended_installed: 2 },
      deleted: { planned_installed: 4 }, endpoint: { actual_amounts: { p: 2 } },
    } }
    expect(installationSummary(result, recipes)).toEqual({ total: 9, types: [{ name: 'Furnace · gregtech', count: 5 }, { name: 'deleted', count: 4 }] })
  })
})
