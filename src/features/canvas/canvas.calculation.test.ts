import { beforeEach, expect, it } from 'vitest'
import { useCanvasStore } from './canvas.store'
import { useRecipeStore } from '@/features/recipe/recipe.store'

beforeEach(() => {
  useCanvasStore.getState().resetCanvas()
  useRecipeStore.setState({ recipes: {
    recipe: {
      recipe_id: 'recipe', machine_name: 'Machine', system: 'custom',
      duration_seconds: 1, inputs: [], outputs: [], metadata: {},
      base_inputs: [{ category: 'item', id: 'catalyst', amount: 1, consumable: false }],
    },
  } })
  useCanvasStore.getState().setNodes([
    { id: 'recipe', type: 'recipeNode', position: { x: 0, y: 0 }, data: { label: 'Preserved' } },
    { id: 'source', type: 'sourceNode', position: { x: 0, y: 0 }, data: {
      ports: [{ category: 'item', id: 'ore', amount: 0.25 }],
    } },
  ])
})

const success = {
  status: 'success' as const,
  node_results: {
    recipe: { machines_exact: 1.2, machines_actual: 2, utilization: 0.6 },
    'source__port:endpoint%3A0': { actual_amounts: { 'item:ore': 0.25 } },
  },
  system_inputs: {}, system_outputs: {},
}

it('applies fractional throughput and clears old results on failure and old errors on success', () => {
  const store = useCanvasStore.getState()
  store.setCalculationResult(success)
  expect(useCanvasStore.getState().capexList).toEqual({ 'item:catalyst': 2 })
  expect(useCanvasStore.getState().nodes[1].data.actual_amounts).toEqual({ 'endpoint:0': 0.25 })
  store.setCalculationResult({ status: 'limit_reached', message: 'Iteration limit' })
  const failed = useCanvasStore.getState()
  expect(failed.capexList).toEqual({})
  expect(failed.nodes[0].data.machines_actual).toBeUndefined()
  expect(failed.nodes[1].data.actual_amounts).toBeUndefined()
  expect(failed.nodes[0].data.label).toBe('Preserved')
  expect(failed.error).toContain('Iteration limit')
  store.setCalculationResult(success)
  expect(useCanvasStore.getState().error).toBeNull()
  expect(useCanvasStore.getState().capexList).toEqual({ 'item:catalyst': 2 })
})

it('clears node results when a new calculation resets the current result', () => {
  useCanvasStore.getState().setCalculationResult(success)
  useCanvasStore.getState().resetCalculationState()
  expect(useCanvasStore.getState().capexList).toEqual({})
  expect(useCanvasStore.getState().nodes[0].data.machines_exact).toBeUndefined()
})
