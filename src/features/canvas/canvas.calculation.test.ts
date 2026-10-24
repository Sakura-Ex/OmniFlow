import { beforeEach, expect, it } from 'vitest'
import { useCanvasStore } from './canvas.store'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'

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
    recipe: { operating_equivalent: 1.2, planned_installed: 2, utilization: 0.6 },
    source: { actual_amounts: { 'endpoint:0': 0.25 } },
  },
  bom: { 'item:catalyst': 2 },
  system_inputs: {}, system_outputs: {},
}

it('distinguishes deleting nodes from deleting selected edges', () => {
  const store = useCanvasStore.getState()
  store.setEdges([{ id: 'wire', source: 'source', target: 'recipe', selected: true }])
  store.deleteSelected('nodes')
  expect(useCanvasStore.getState().edges).toHaveLength(1)
  store.deleteSelected()
  expect(useCanvasStore.getState().edges).toHaveLength(0)
  expect(useCanvasStore.getState().nodes).toHaveLength(2)
  store.setEdges([{ id: 'wire', source: 'source', target: 'recipe' }])
  store.setNodes(useCanvasStore.getState().nodes.map(node => ({ ...node, selected: node.id === 'recipe' })))
  store.deleteSelected('nodes')
  expect(useCanvasStore.getState().nodes.map(node => node.id)).toEqual(['source'])
  expect(useCanvasStore.getState().edges).toHaveLength(0)
  expect(useRecipeStore.getState().recipes.recipe).toBeUndefined()
})

it('preserves results through editing and recalculation, then fully replaces the old projection', () => {
  const store = useCanvasStore.getState()
  store.setCalculationResult(success)
  store.invalidateCalculation()
  store.setNodes(useCanvasStore.getState().nodes.map(node => ({ ...node, data: { label: 'Edited' } })))
  expect(useCanvasStore.getState().calculationStatus).toBe('stale')
  expect(useCanvasStore.getState().nodes[0].data.operating_equivalent).toBe(1.2)
  store.beginCalculation()
  expect(useCanvasStore.getState().calculationStatus).toBe('running')
  expect(useCanvasStore.getState().capexList).toEqual({ 'item:catalyst': 2 })
  store.setCalculationResult({ ...success, node_results: { recipe: { operating_equivalent: 3 } }, bom: {} })
  expect(useCanvasStore.getState().nodes[0].data.operating_equivalent).toBe(3)
  expect(useCanvasStore.getState().nodes[0].data.planned_installed).toBeUndefined()
  expect(useCanvasStore.getState().nodes[1].data.actual_amounts).toBeUndefined()
  store.resetCalculationState()
  expect(useCanvasStore.getState().lastCalculationResult).toBeNull()
})

it('retains verified results on failure and clears old errors on success', () => {
  const store = useCanvasStore.getState()
  store.setCalculationResult(success)
  expect(useCanvasStore.getState().capexList).toEqual({ 'item:catalyst': 2 })
  expect(useCanvasStore.getState().nodes[1].data.actual_amounts).toEqual({ 'endpoint:0': 0.25 })
  store.setCalculationResult({ status: 'limit_reached', message: 'Iteration limit' })
  const failed = useCanvasStore.getState()
  expect(failed.capexList).toEqual({ 'item:catalyst': 2 })
  expect(failed.nodes[0].data.planned_installed).toBe(2)
  expect(failed.nodes[1].data.actual_amounts).toEqual({ 'endpoint:0': 0.25 })
  expect(failed.nodes[0].data.label).toBe('Preserved')
  expect(failed.error).toContain('Iteration limit')
  store.setCalculationResult(success)
  expect(useCanvasStore.getState().error).toBeNull()
  expect(useCanvasStore.getState().capexList).toEqual({ 'item:catalyst': 2 })
})

it('clears previous-document results on explicit reset', () => {
  useCanvasStore.getState().setCalculationResult(success)
  useCanvasStore.getState().resetCalculationState()
  expect(useCanvasStore.getState().capexList).toEqual({})
  expect(useCanvasStore.getState().nodes[0].data.operating_equivalent).toBeUndefined()
  expect(useCanvasStore.getState().resultEvidence).toBeNull()
})

it('retains result-owned labels and units across edits, panel lifetimes and failed recalculations', () => {
  const canvas = useCanvasStore.getState()
  const settings = useSettingsStore.getState().units
  const entries = useGlobalResourceTable.getState().entries
  try {
    useGlobalResourceTable.setState({ entries: { 'item:ore': { fullId: 'item:ore', displayName: 'Original ore' } } })
    canvas.setCalculationResult(success)
    const evidence = useCanvasStore.getState().resultEvidence!
    useRecipeStore.getState().updateRecipe('recipe', { machine_name: 'Changed machine' })
    useGlobalResourceTable.setState({ entries: { 'item:ore': { fullId: 'item:ore', displayName: 'Changed ore' } } })
    useSettingsStore.getState().setTps(40)
    canvas.setNodes([])
    canvas.invalidateCalculation()
    canvas.beginCalculation()
    canvas.setCalculationResult({ status: 'solver_error' })
    expect(useCanvasStore.getState().resultEvidence).toBe(evidence)
    expect(evidence.recipes.recipe.machine_name).toBe('Machine')
    expect(evidence.resources['item:ore'].name).toBe('Original ore')
    expect(evidence.environment).toEqual(settings)
    expect(useCanvasStore.getState().lastCalculationResult).toBe(success)
    canvas.resetCanvas()
    expect(useCanvasStore.getState().resultEvidence).toBeNull()
  } finally {
    useSettingsStore.getState().setEnvironment(settings)
    useGlobalResourceTable.setState({ entries })
  }
})
