import { describe, expect, it } from 'vitest'
import type { RecipeNodeData } from '@/common/types/recipe'
import { computeCapexList as compiledCapex } from './capEx'
import { runModifierPipeline } from '@/features/modifier/modifier.pipeline'
import type { CalculationNodeResult } from '@/common/types/api'

const computeCapexList = (recipes: Record<string, RecipeNodeData>, results: Record<string, CalculationNodeResult>) => compiledCapex(Object.fromEntries(Object.entries(recipes).map(([id, recipe]) => [id, runModifierPipeline(recipe)])), results)

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
      node: { operating_equivalent: 1.2, planned_installed: 2, utilization: 0.6 },
    })).toEqual({ 'item:catalyst': 2 })
  })

  it('excludes idle recipes and aggregates installed resources across nodes', () => {
    expect(computeCapexList({ a: recipe, b: recipe, idle: recipe }, {
      a: { planned_installed: 2 }, b: { planned_installed: 3 }, idle: { planned_installed: 0 },
    })).toEqual({ 'item:catalyst': 5 })
  })

  it('retains zero-loss resource occupancy by graph node identity', () => {
    const zeroLoss = { ...recipe, base_inputs: [
      { category: 'item', id: 'catalyst', amount: 1, probability: 0 },
    ] }
    expect(computeCapexList({ node: zeroLoss }, { node: { planned_installed: 2 } }))
      .toEqual({ 'item:catalyst': 2 })
  })

  it.each([undefined, 1.2, -1, NaN, Infinity])('rejects incomplete installation count %s', (machines) => {
    expect(() => computeCapexList({ node: recipe }, {
      node: { operating_equivalent: 1.2, planned_installed: machines },
    })).toThrow('planned_installed')
  })
})


it('does not borrow installed counts from another node matching a recipe template ID', () => {
  expect(() => computeCapexList({ instance: recipe }, { recipe: { planned_installed: 2 } })).toThrow('planned_installed')
})


it('converts mixed prefixes before adding occupancy and rejects incompatible dimensions', () => {
  const water = (amount: number, prefixId?: string) => ({ ...recipe, base_inputs: [{ category: 'fluid', id: 'water', amount, consumable: false, unit: [{ baseUnitId: 'L', prefixId, exponent: 1 }] }] })
  const results = { a: { planned_installed: 1 }, b: { planned_installed: 1 } }
  expect(computeCapexList({ a: water(1), b: water(1000, 'milli') }, results)).toEqual({ 'fluid:water': 2 })
  const incompatible = water(1)
  incompatible.base_inputs[0].unit[0].baseUnitId = 'g'
  expect(() => computeCapexList({ a: water(1), b: incompatible }, results)).toThrow('Incompatible occupancy units')
})
