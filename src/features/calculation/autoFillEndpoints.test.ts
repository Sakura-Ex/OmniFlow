import { describe, expect, it } from 'vitest'
import { emptyNetworkConfiguration, type Boundary, type NetworkPortConfiguration } from './networkConfig'
import { portKey } from './topology'
import { computeAutoFillEndpoints } from './autoFillEndpoints'
import type { RecipeNodeData } from '@/common/types/recipe'

it('creates independently identified endpoints for repeated resources with preserved input units', () => {
  const recipe: RecipeNodeData = {
    recipe_id: 'r', machine_name: 'Mass', system: 'custom', duration_seconds: 1,
    inputs: ['process', 'cooling'].map((portId) => ({ portId, category: 'item', id: 'powder', amount: 1, unit: [{ baseUnitId: 'g', prefixId: 'k', exponent: 1 }] })),
    outputs: [], metadata: {},
  }
  let nextId = 0
  const result = computeAutoFillEndpoints({ nodeId: 'r', recipeNodeData: recipe, allNodes: [], allEdges: [], lastSystemInputs: { 'item:powder': 500 }, lastSystemOutputs: {}, makeId: () => `node-${nextId++}` })
  expect(result.nodesToAdd).toHaveLength(2)
  expect(result.edgesToAdd.map((edge) => edge.targetHandle)).toEqual(['process', 'cooling'])
  expect(new Set(result.edgesToAdd.map((edge) => edge.sourceHandle)).size).toBe(2)
  expect(result.nodesToAdd[0].data.ports[0].unit).toEqual([{ baseUnitId: 'g', prefixId: 'k', exponent: 1 }])
  expect(result.nodesToAdd[0].data.ports[0].amount).toBe(0.5)
  expect(result.edgesToAdd[0].sourceHandle).toBe(result.nodesToAdd[0].data.ports[0].portId)
})

const recipe: RecipeNodeData = {
  recipe_id: 'r', machine_name: 'Machine', system: 'custom', duration_seconds: 1,
  inputs: [{ portId: 'input', category: 'item', id: 'ore', amount: 2 }],
  outputs: [{ portId: 'output', category: 'item', id: 'product', amount: 1 }], metadata: {},
}
const params = () => ({ nodeId: 'r', recipeNodeData: structuredClone(recipe), allNodes: [], allEdges: [], lastSystemInputs: {}, lastSystemOutputs: {}, makeId: () => crypto.randomUUID(), configuration: emptyNetworkConfiguration() })
const policy = (boundary?: Boundary): NetworkPortConfiguration => ({ scopeId: 'scope', busId: 'bus', semantics: { kind: 'flow' }, boundary })

describe('auto-fill respects explicit mathematical policies', () => {
  it.each([null, 3, 0])('does not bypass direct source capacity %s by adding another source', capacity => {
    const input = params()
    input.configuration.ports[portKey('r', 'input')] = policy({ kind: 'source', capacity })
    const before = structuredClone(input.configuration)
    const result = computeAutoFillEndpoints(input)
    expect(result.nodesToAdd.map(node => node.type)).toEqual(['targetNode'])
    expect(result.edgesToAdd.some(edge => edge.targetHandle === 'input')).toBe(false)
    expect(input.configuration).toEqual(before)
  })
  it.each<Boundary>([{ kind: 'delivery', mode: 'exact', amount: 1, capacity: null }, { kind: 'spill', capacity: 2 }, { kind: 'forbid_spill' }])('preserves explicit output $kind without creating an outlet', boundary => {
    const input = params()
    input.configuration.ports[portKey('r', 'output')] = policy(boundary)
    const result = computeAutoFillEndpoints(input)
    expect(result.nodesToAdd.map(node => node.type)).toEqual(['sourceNode'])
    expect(result.edgesToAdd.some(edge => edge.sourceHandle === 'output')).toBe(false)
  })
  it.each<NetworkPortConfiguration['semantics']>([{ kind: 'capacity', available: 4 }, { kind: 'state', actual: 300 }])('does not create flow endpoints for $kind ports', semantics => {
    const input = params()
    input.configuration.ports[portKey('r', 'input')] = { ...policy(), semantics }
    input.configuration.ports[portKey('r', 'output')] = { ...policy(), semantics }
    expect(computeAutoFillEndpoints(input)).toEqual({ nodesToAdd: [], edgesToAdd: [] })
  })
  it.each([{ amount: 0 }, { consumable: false }, { probability: 0 }, { routing_mode: 'global' as const }])('does not fabricate positive flow for zero, inventory, or global inputs: %j', patch => {
    const input = params()
    Object.assign(input.recipeNodeData.inputs[0], patch)
    input.recipeNodeData.outputs = []
    expect(computeAutoFillEndpoints(input)).toEqual({ nodesToAdd: [], edgesToAdd: [] })
  })
  it('retains ordinary missing-input and missing-output behavior with optional configuration', () => {
    const input = params()
    input.configuration.ports[portKey('r', 'input')] = policy()
    const result = computeAutoFillEndpoints(input)
    expect(result.nodesToAdd.map(node => node.type)).toEqual(['sourceNode', 'targetNode'])
    expect(result.edgesToAdd[0].targetHandle).toBe('input')
    expect(result.edgesToAdd[1].sourceHandle).toBe('output')
    expect(computeAutoFillEndpoints({ ...input, configuration: undefined }).nodesToAdd).toHaveLength(2)
  })
})
