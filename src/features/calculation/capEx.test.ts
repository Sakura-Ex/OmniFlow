import { describe, expect, it } from 'vitest'
import type { RecipeNodeData } from '@/common/types/recipe'
import { computeCapexList } from './capEx'

const recipe: RecipeNodeData = {
  recipe_id: 'recipe', machine_name: 'Machine', system: 'custom',
  duration_seconds: 1, inputs: [], outputs: [], metadata: {},
  base_inputs: [
    { category: 'item', id: 'catalyst', amount: 1, consumable: false },
    { category: 'item', id: 'ore', amount: 3, consumable: true },
  ],
}

describe('installation BOM', () => {
  it('uses two installed machines for 1.2 operating equivalents', () => {
    expect(computeCapexList({ node: recipe }, {
      node: { machines_exact: 1.2, machines_actual: 2, utilization: 0.6 },
    })).toEqual({ 'item:catalyst': 2 })
  })

  it('excludes idle recipes and aggregates installed resources across nodes', () => {
    expect(computeCapexList({ a: recipe, b: recipe, idle: recipe }, {
      a: { machines_actual: 2 }, b: { machines_actual: 3 }, idle: { machines_actual: 0 },
    })).toEqual({ 'item:catalyst': 5 })
  })

  it('retains zero-loss resource occupancy and legacy recipe ID lookup', () => {
    const zeroLoss = { ...recipe, base_inputs: [
      { category: 'item', id: 'catalyst', amount: 1, probability: 0 },
    ] }
    expect(computeCapexList({ node: zeroLoss }, { recipe: { machines_actual: 2 } }))
      .toEqual({ 'item:catalyst': 2 })
  })

  it.each([undefined, 1.2, -1, NaN, Infinity])('rejects incomplete installation count %s', (machines) => {
    expect(() => computeCapexList({ node: recipe }, {
      node: { machines_exact: 1.2, machines_actual: machines },
    })).toThrow('machines_actual')
  })
})
