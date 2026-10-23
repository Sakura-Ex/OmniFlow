import { beforeEach, expect, it } from 'vitest'
import type { Node } from 'reactflow'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { captureNodes, restoreRecipes } from './hooks/useUndoRedo'
import { useCanvasStore } from './canvas.store'

beforeEach(() => useRecipeStore.setState({ recipes: {} }))

it('captures pre-edit authoritative ports and restores their identities for undo and redo', () => {
  useRecipeStore.getState().setRecipe('r', {
    recipe_id: 'r', machine_name: 'Machine', system: 'custom', duration_seconds: 1,
    inputs: [
      { category: 'fluid', id: 'water', amount: 2, portId: 'process' },
      { category: 'fluid', id: 'water', amount: 3, portId: 'cooling' },
    ], outputs: [], metadata: {},
  })
  const nodes: Node[] = [{ id: 'r', type: 'recipeNode', position: { x: 0, y: 0 }, data: { label: 'Display only' } }]
  const before = captureNodes(nodes)
  useRecipeStore.getState().updateRecipe('r', { base_inputs: [useRecipeStore.getState().recipes.r.base_inputs![1]] })
  const after = captureNodes(nodes)
  restoreRecipes(before)
  expect(useRecipeStore.getState().recipes.r.base_inputs!.map((p) => p.portId)).toEqual(['process', 'cooling'])
  restoreRecipes(after)
  expect(useRecipeStore.getState().recipes.r.base_inputs!.map((p) => p.portId)).toEqual(['cooling'])
  expect(before[0].data._computed).toBeUndefined()
})

it('migrates database graph handles using authoritative recipes and replaces the previous document', () => {
  const recipe = {
    recipe_id: 'r', machine_name: 'Machine', system: 'custom', duration_seconds: 1,
    inputs: [{ category: 'item', id: 'ore', amount: 1 }], outputs: [], metadata: {},
  }
  useRecipeStore.getState().setRecipe('previous', recipe)
  useCanvasStore.getState().loadFromDB('canvas', 'project', [
    { id: 'r', type: 'recipeNode', position: { x: 0, y: 0 }, data: { label: 'Display only' } },
    { id: 's', type: 'sourceNode', position: { x: 0, y: 0 }, data: { ports: [{ category: 'item', id: 'ore', amount: 2 }] } },
  ], [{ id: 'e', source: 's', target: 'r', sourceHandle: 'item:ore', targetHandle: 'item:ore' }],
  { x: 0, y: 0, zoom: 1 }, { r: recipe })
  const graph = useCanvasStore.getState()
  expect(Object.keys(useRecipeStore.getState().recipes)).toEqual(['r'])
  expect(graph.edges[0].sourceHandle).toBe(graph.nodes[1].data.ports[0].portId)
  expect(graph.edges[0].targetHandle).toBe(useRecipeStore.getState().recipes.r.base_inputs![0].portId)
  expect(graph.isDirty).toBe(false)
})
