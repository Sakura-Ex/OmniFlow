import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Node } from 'reactflow'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { captureSnapshot, restoreSnapshot } from '@/features/canvas/hooks/useUndoRedo'
import { createHistory } from '@/common/utils/history'
import { commitEndpointEditor, commitRecipeEditor, nodeEditorBaseline } from './editorCommit'
import type { RecipeNodeData } from '@/common/types/recipe'
import { useSettingsStore } from '@/features/settings/settings.store'

/** Create a minimal editable machine with stable port identities.
 * @returns A valid recipe fixture.
 */
function recipe(): RecipeNodeData {
  const port = (portId: string) => ({ portId, category: 'item', id: 'resource', amount: 1, routing_mode: 'wired' as const })
  return { recipe_id: 'r', machine_name: 'r', system: 'vanilla', duration_seconds: 1, inputs: [], outputs: [], base_inputs: [port('in')], base_outputs: [port('out')], metadata: {} }
}
const edges = [{ id: 'in', source: 'source', sourceHandle: 's', target: 'r', targetHandle: 'in' }]
describe('node editor document transactions', () => {
  let original: ReturnType<typeof captureSnapshot>
  const setNodes = (nodes: Node[]) => useCanvasStore.getState().setNodes(nodes)
  const history = () => createHistory({
    capture: () => captureSnapshot(useCanvasStore.getState().nodes, useCanvasStore.getState().edges),
    restore: (snapshot: ReturnType<typeof captureSnapshot>) => {
      restoreSnapshot(snapshot)
      useCanvasStore.getState().setNodes(snapshot.nodes)
      useCanvasStore.getState().setEdges(snapshot.edges)
    },
  })
  beforeEach(() => {
    original = captureSnapshot(useCanvasStore.getState().nodes, useCanvasStore.getState().edges)
    useCanvasStore.getState().setNodes([{ id: 'r', type: 'recipeNode', position: { x: 0, y: 0 }, data: { label: 'r' } }])
    useRecipeStore.getState().setRecipe('r', { ...recipe(), mode: 'auto' })
    useCanvasStore.getState().setEdges(edges)
  })
  afterEach(() => {
    restoreSnapshot(original)
    useCanvasStore.getState().setNodes(original.nodes)
    useCanvasStore.getState().setEdges(original.edges)
  })

  it('rejects deleted nodes without recreating recipes or adding history', () => {
    const baseline = nodeEditorBaseline('r')
    useCanvasStore.getState().setNodes([])
    useRecipeStore.getState().removeRecipe('r')
    const commit = vi.fn()
    expect(commitRecipeEditor('r', recipe(), baseline, commit, setNodes)).toEqual({ ok: false, reason: 'missing' })
    expect(commit).not.toHaveBeenCalled()
    expect(useRecipeStore.getState().recipes.r).toBeUndefined()
  })

  it('rejects stale drafts after an inline edit but ignores recomputation and selection', () => {
    const baseline = nodeEditorBaseline('r')
    useRecipeStore.getState().setRecipe('r', useRecipeStore.getState().recipes.r)
    useCanvasStore.getState().setNodes(useCanvasStore.getState().nodes.map(node => ({ ...node, selected: true, position: { x: 10, y: 20 } })))
    expect(nodeEditorBaseline('r')).toBe(baseline)
    useRecipeStore.getState().updateRecipe('r', { machine_name: 'newer edit' })
    const commit = vi.fn()
    expect(commitRecipeEditor('r', recipe(), baseline, commit, setNodes)).toEqual({ ok: false, reason: 'conflict' })
    expect(commit).not.toHaveBeenCalled()
    expect(useRecipeStore.getState().recipes.r.machine_name).toBe('newer edit')
  })

  it('undoes recipe and disconnected wires together', () => {
    const baseline = nodeEditorBaseline('r')
    const draft = structuredClone(useRecipeStore.getState().recipes.r)
    draft.base_inputs![0].routing_mode = 'global'
    draft.machine_name = 'edited'
    const edits = history()
    expect(commitRecipeEditor('r', draft, baseline, edits.commit, setNodes)).toEqual({ ok: true })
    expect(useCanvasStore.getState().edges.some(edge => edge.id === 'in')).toBe(false)
    edits.undo()
    expect(useRecipeStore.getState().recipes.r.machine_name).toBe('r')
    expect(useCanvasStore.getState().edges.some(edge => edge.id === 'in')).toBe(true)
    expect(edits.canUndo()).toBe(false)
    edits.redo()
    expect(useRecipeStore.getState().recipes.r.machine_name).toBe('edited')
  })

  it('rolls back recipe and routing writes if a later mutation fails', () => {
    const baseline = nodeEditorBaseline('r')
    const draft = structuredClone(useRecipeStore.getState().recipes.r)
    draft.base_inputs![0].routing_mode = 'global'
    draft.machine_name = 'not committed'
    const edits = history()
    expect(commitRecipeEditor('r', draft, baseline, edits.commit, () => { throw new Error('write failed') })).toEqual({ ok: false, reason: 'invalid' })
    expect(nodeEditorBaseline('r')).toBe(baseline)
    expect(useCanvasStore.getState().edges.some(edge => edge.id === 'in')).toBe(true)
    expect(edits.canUndo()).toBe(false)
  })

  it('preserves independent boundary changes when saving endpoint resource edits', () => {
    useCanvasStore.getState().setNodes([{ id: 's', type: 'sourceNode', position: { x: 0, y: 0 }, data: { ports: [{ portId: 'p', category: 'item', id: 'ore', amount: 1 }] } }])
    const baseline = nodeEditorBaseline('s')
    const configuration = structuredClone(useCanvasStore.getState().networkConfiguration)
    configuration.machines.s = { installed: 7, operatingUpper: null }
    useCanvasStore.getState().setNetworkConfiguration(configuration)
    const edits = history()
    expect(commitEndpointEditor('s', { ports: [{ portId: 'p', category: 'item', id: 'ore', amount: 2 }] }, baseline, edits.commit, setNodes)).toEqual({ ok: true })
    expect(useCanvasStore.getState().networkConfiguration.machines.s.installed).toBe(7)
    edits.undo()
    expect(useCanvasStore.getState().nodes[0].data.ports[0].amount).toBe(1)
    expect(useCanvasStore.getState().networkConfiguration.machines.s.installed).toBe(7)
  })

  it('accepts consecutive saves with refreshed baselines and records each complete change', () => {
    const edits = history()
    const firstBaseline = nodeEditorBaseline('r')
    const first = { ...useRecipeStore.getState().recipes.r, machine_name: 'first' }
    expect(commitRecipeEditor('r', first, firstBaseline, edits.commit, setNodes).ok).toBe(true)
    const nextBaseline = nodeEditorBaseline('r')
    const second = { ...useRecipeStore.getState().recipes.r, machine_name: 'second' }
    expect(commitRecipeEditor('r', second, firstBaseline, edits.commit, setNodes)).toEqual({ ok: false, reason: 'conflict' })
    expect(commitRecipeEditor('r', second, nextBaseline, edits.commit, setNodes).ok).toBe(true)
    edits.undo()
    expect(useRecipeStore.getState().recipes.r.machine_name).toBe('first')
    edits.undo()
    expect(useRecipeStore.getState().recipes.r.machine_name).toBe('r')
  })

  it('requires reloading a draft after its unit environment changes', () => {
    const baseline = nodeEditorBaseline('r')
    const environment = useSettingsStore.getState().units
    useSettingsStore.getState().setEnvironment({ ...environment, ticksPerSecond: environment.ticksPerSecond + 1 })
    const edits = history()
    expect(commitRecipeEditor('r', useRecipeStore.getState().recipes.r, baseline, edits.commit, setNodes)).toEqual({ ok: false, reason: 'conflict' })
    expect(edits.canUndo()).toBe(false)
    expect(commitRecipeEditor('r', { ...useRecipeStore.getState().recipes.r, machine_name: 'reloaded' }, nodeEditorBaseline('r'), edits.commit, setNodes).ok).toBe(true)
  })

  it('preserves endpoint identity and explicit units across repeated resource saves', () => {
    const port = { portId: 'stable-port', _uid: 'stable-row', category: 'fluid', id: 'water', amount: 2, unit: [{ baseUnitId: 'L', exponent: 1 }] }
    useCanvasStore.getState().setNodes([{ id: 's', type: 'sourceNode', position: { x: 0, y: 0 }, data: { ports: [port] } }])
    const edits = history()
    expect(commitEndpointEditor('s', { ports: [{ ...port, amount: 4 }] }, nodeEditorBaseline('s'), edits.commit, setNodes).ok).toBe(true)
    expect(commitEndpointEditor('s', { ports: [{ ...port, amount: 6 }] }, nodeEditorBaseline('s'), edits.commit, setNodes).ok).toBe(true)
    expect(useCanvasStore.getState().nodes[0].data.ports[0]).toEqual({ ...port, amount: 6 })
    expect(Object.keys(useCanvasStore.getState().networkConfiguration.ports)).toContain(JSON.stringify(['s', 'stable-port']))
  })
})
