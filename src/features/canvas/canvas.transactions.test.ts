import { expect, it } from 'vitest'
import { createHistory } from '@/common/utils/history'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { captureSnapshot, restoreSnapshot } from './hooks/useUndoRedo'
import { useCanvasStore } from './canvas.store'

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
