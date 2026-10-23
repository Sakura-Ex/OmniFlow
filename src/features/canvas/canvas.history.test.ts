import { createHistory } from '@/common/utils/history'
import { beforeEach, expect, it } from 'vitest'
import type { Node } from 'reactflow'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { captureSnapshot, restoreSnapshot, captureNodes, restoreRecipes } from './hooks/useUndoRedo'
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

it('undoes and redoes TPS, registry units and installed quantities through the real document history', () => {
  const canvas = useCanvasStore.getState()
  const original = captureSnapshot(canvas.nodes, canvas.edges)
  const restore = (snapshot: ReturnType<typeof captureSnapshot>) => {
    restoreSnapshot(snapshot)
    useCanvasStore.getState().setNodes(snapshot.nodes)
    useCanvasStore.getState().setEdges(snapshot.edges)
  }
  try {
    canvas.resetCanvas()
    useRecipeStore.setState({ recipes: {} })
    canvas.addRecipeNode('machine', {
      recipe_id: 'machine', machine_name: 'Machine', system: 'custom', duration_seconds: 1,
      inputs: [], outputs: [], metadata: {},
    }, { id: 'machine', type: 'recipeNode', position: { x: 0, y: 0 }, data: {} })
    const initial = captureSnapshot(useCanvasStore.getState().nodes, [])
    const history = createHistory({ capture: () => captureSnapshot(useCanvasStore.getState().nodes, useCanvasStore.getState().edges), restore })
    const newTps = initial.environment.ticksPerSecond === 40 ? 60 : 40
    history.commit(() => useSettingsStore.getState().setTps(newTps))
    history.commit(() => useGlobalResourceTable.getState().addCategory({
      id: 'history-custom', displayName: 'History custom', base_unit: 'history-widget', themeColor: 'blue', preferred_time_base: 'rate_per_tick',
    }))
    history.commit(() => useCanvasStore.getState().setNetworkConfiguration({
      ...useCanvasStore.getState().networkConfiguration, machines: { machine: { installed: 3, operatingUpper: 1.2 } },
    }))
    history.undo()
    expect(useCanvasStore.getState().networkConfiguration.machines).toEqual(initial.networkConfiguration.machines)
    expect(useSettingsStore.getState().tps).toBe(newTps)
    expect(useGlobalResourceTable.getState().categories['history-custom']).toBeDefined()
    history.undo()
    expect(useGlobalResourceTable.getState().categories).toEqual(initial.registry.categories)
    expect(useSettingsStore.getState().units.definitions.some(definition => definition.symbol === 'history-widget')).toBe(false)
    expect(useSettingsStore.getState().tps).toBe(newTps)
    history.undo()
    expect(useSettingsStore.getState().units).toEqual(initial.environment)
    expect(history.canUndo()).toBe(false)
    history.redo()
    history.redo()
    history.redo()
    expect(useSettingsStore.getState().tps).toBe(newTps)
    expect(useSettingsStore.getState().units.definitions.some(definition => definition.symbol === 'history-widget')).toBe(true)
    expect(useGlobalResourceTable.getState().categories['history-custom'].base_unit).toBe('history-widget')
    expect(useCanvasStore.getState().networkConfiguration.machines.machine).toEqual({ installed: 3, operatingUpper: 1.2 })
    expect(useRecipeStore.getState().recipes.machine.machine_name).toBe('Machine')
    expect(useCanvasStore.getState().calculationStatus).toBe('stale')
    expect(history.canRedo()).toBe(false)
  } finally { restore(original) }
})
