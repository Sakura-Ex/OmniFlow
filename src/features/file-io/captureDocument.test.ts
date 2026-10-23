import { afterEach, beforeEach, expect, it } from 'vitest'
import { createSaveBaseline } from '@/common/utils/saveBaseline'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { captureDocument } from './captureDocument'

const canvasInitial = useCanvasStore.getState()
const recipeInitial = useRecipeStore.getState()
const settingsInitial = useSettingsStore.getState()
const registryInitial = useGlobalResourceTable.getState()

beforeEach(() => {
  useCanvasStore.getState().resetCanvas()
  useRecipeStore.setState({ recipes: {} })
})
afterEach(() => {
  useCanvasStore.setState(canvasInitial, true)
  useRecipeStore.setState(recipeInitial, true)
  useSettingsStore.setState(settingsInitial, true)
  useGlobalResourceTable.setState(registryInitial, true)
})

it('saves authoritative recipe data and isolates the snapshot from subsequent store edits', () => {
  useCanvasStore.getState().addRecipeNode('r', {
    recipe_id: 'r', machine_name: 'Authoritative', system: 'custom', duration_seconds: 1,
    inputs: [], outputs: [], metadata: {},
  }, { id: 'r', type: 'recipeNode', position: { x: 10, y: 20 }, data: { machine_name: 'Obsolete node copy', utilization: 0.5 } })
  const snapshot = captureDocument()
  expect(snapshot.domain.recipes.r.machine_name).toBe('Authoritative')
  expect(snapshot.domain.recipes.r._computed).toBeUndefined()
  expect(snapshot.ui.nodes[0].data).toEqual({ label: 'Authoritative' })
  useRecipeStore.getState().updateRecipe('r', { machine_name: 'Edited later' })
  useSettingsStore.getState().setTps(40)
  useCanvasStore.getState().setNodes([{ ...useCanvasStore.getState().nodes[0], position: { x: 90, y: 80 } }])
  expect(snapshot.domain.recipes.r.machine_name).toBe('Authoritative')
  expect(snapshot.ui.nodes[0].position).toEqual({ x: 10, y: 20 })
  expect(snapshot.environment.ticksPerSecond).toBe(settingsInitial.tps)
})

it('keeps selection, measured geometry and solver results out of saved identity', () => {
  const node = { id: 's', type: 'sourceNode', position: { x: 0, y: 0 }, data: { ports: [{ portId: 'p', category: 'item', id: 'ore', amount: 2 }] } }
  useCanvasStore.getState().setNodes([node])
  useCanvasStore.getState().setEdges([{ id: 'e', source: 's', target: 's', sourceHandle: 'p', targetHandle: 'p' }])
  const baseline = createSaveBaseline(captureDocument())
  useCanvasStore.setState({
    nodes: [{ ...node, selected: true, dragging: true, width: 300, height: 200, positionAbsolute: { x: 0, y: 0 }, data: { ...node.data, utilization: 0.8, machines_actual: 3, port_throughputs: { p: 10 }, actual_amounts: { p: 10 } } }],
    edges: [{ ...useCanvasStore.getState().edges[0], selected: true }],
    calculationStatus: 'success', documentRevision: 99, systemInputs: { ore: 10 }, isDirty: true,
  })
  expect(baseline.isDirty(captureDocument())).toBe(false)
  expect(captureDocument().ui.nodes[0].data.ports[0].amount).toBe(2)
})

it('tracks document changes in environment, resource dictionary, planning policy and graph position', () => {
  useCanvasStore.getState().setNodes([{ id: 's', type: 'sourceNode', position: { x: 0, y: 0 }, data: { ports: [] } }])
  const baseline = createSaveBaseline(captureDocument())
  useSettingsStore.getState().setTps(settingsInitial.tps + 1)
  expect(baseline.isDirty(captureDocument())).toBe(true)
  baseline.markSaved(captureDocument())
  useGlobalResourceTable.getState().addCategory({ id: 'capture-custom', displayName: 'Custom', base_unit: 'capture-unit', themeColor: 'blue', preferred_time_base: 'rate_per_sec' })
  expect(baseline.isDirty(captureDocument())).toBe(true)
  baseline.markSaved(captureDocument())
  useCanvasStore.getState().setNetworkConfiguration({ ...useCanvasStore.getState().networkConfiguration, machines: { s: { installed: 2, operatingUpper: null } } })
  expect(baseline.isDirty(captureDocument())).toBe(true)
  baseline.markSaved(captureDocument())
  useCanvasStore.getState().setNodes([{ ...useCanvasStore.getState().nodes[0], position: { x: 1, y: 0 } }])
  expect(baseline.isDirty(captureDocument())).toBe(true)
})
