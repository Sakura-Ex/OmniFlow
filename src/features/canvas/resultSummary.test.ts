import { describe, expect, it } from 'vitest'
import type { Node } from 'reactflow'
import type { CalculateResponse } from '@/common/types/api'
import { emptyNetworkConfiguration } from '@/common/schemas/network.schema'
import { deliveryResources, deliverySummary, installationSummary } from './resultSummary'

describe('core result evidence', () => {
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
