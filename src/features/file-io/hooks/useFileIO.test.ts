import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ChangeEvent } from 'react'
import type { Edge, Node } from 'reactflow'
import { createHistory } from '@/common/utils/history'
import { createSaveBaseline } from '@/common/utils/saveBaseline'
import { captureSnapshot, restoreSnapshot } from '@/features/canvas/hooks/useUndoRedo'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { captureDocument } from '../captureDocument'
import { useFileIO as createFileIO } from './useFileIO'
import { useNodeDisplayStore } from '@/features/settings/nodeDisplay.store'
import { useSettingsStore } from '@/features/settings/settings.store'

vi.mock('react', async (original) => ({ ...await original<typeof import('react')>(), useCallback: (callback: unknown) => callback }))

beforeEach(() => {
  useCanvasStore.getState().resetCanvas()
  useRecipeStore.setState({ recipes: {} })
  useNodeDisplayStore.setState({ mode: 'compact' })
  vi.stubGlobal('alert', vi.fn())
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

const setup = () => {
  const node: Node = { id: 'original', type: 'sourceNode', position: { x: 0, y: 0 }, data: { ports: [{ portId: 'p', category: 'item', id: 'ore', amount: 1 }] } }
  useCanvasStore.getState().setNodes([node])
  const nodesRef = { current: [node] }, edgesRef = { current: [] as Edge[] }
  const baseline = createSaveBaseline(captureDocument())
  const history = createHistory({ capture: () => captureSnapshot(useCanvasStore.getState().nodes, useCanvasStore.getState().edges), restore: snapshot => {
    restoreSnapshot(snapshot)
    nodesRef.current = snapshot.nodes
    edgesRef.current = snapshot.edges
    useCanvasStore.getState().setNodes(snapshot.nodes)
    useCanvasStore.getState().setEdges(snapshot.edges)
  } })
  const storage = { setItem: vi.fn(), getItem: vi.fn() }
  vi.stubGlobal('localStorage', storage)
  const confirmReplace = vi.fn(() => true)
  const onSaved = vi.fn(snapshot => baseline.markSaved(snapshot))
  const onLoaded = vi.fn(snapshot => { history.clear(); baseline.markSaved(snapshot) })
  const commitEdit = vi.fn(history.commit)
  const normalizeCanvasNode = vi.fn((input: Node) => input)
  const operations = createFileIO({ storageKey: 'test-document', fileInputRef: { current: null }, nodesRef, edgesRef,
    setNodes: nodes => { useCanvasStore.getState().setNodes(nodes) },
    setEdges: edges => { useCanvasStore.getState().setEdges(edges) },
    commitEdit, confirmReplace, onSaved, onLoaded, normalizeCanvasNode, resetSystemStats: () => useCanvasStore.getState().resetCalculationState(),
  })
  const incoming = captureDocument()
  incoming.ui.nodes[0].id = 'loaded'
  storage.getItem.mockReturnValue(JSON.stringify(incoming))
  return { ...operations, storage, baseline, history, nodesRef, edgesRef, confirmReplace, onSaved, onLoaded, commitEdit, normalizeCanvasNode }
}

it('acknowledges only a successfully stored snapshot and keeps failed saves dirty', () => {
  const action = setup()
  useCanvasStore.getState().setNodes([{ ...action.nodesRef.current[0], position: { x: 10, y: 0 } }])
  expect(action.baseline.isDirty(captureDocument())).toBe(true)
  action.storage.setItem.mockImplementationOnce(() => { throw new Error('Storage full') })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  action.handleSaveCanvas()
  expect(action.onSaved).not.toHaveBeenCalled()
  expect(action.baseline.isDirty(captureDocument())).toBe(true)
  action.handleSaveCanvas()
  expect(action.onSaved).toHaveBeenCalledOnce()
  expect(action.onSaved.mock.calls[0][0]).toEqual(JSON.parse(action.storage.setItem.mock.calls[1][1]))
  expect(action.baseline.isDirty(captureDocument())).toBe(false)
})

it('preserves document, save baseline and history when replacement is cancelled', () => {
  const action = setup()
  action.confirmReplace.mockReturnValue(false)
  const before = captureDocument()
  action.handleLoadCanvas()
  expect(action.confirmReplace).toHaveBeenCalledOnce()
  expect(action.commitEdit).not.toHaveBeenCalled()
  expect(action.onLoaded).not.toHaveBeenCalled()
  expect(action.history.canUndo()).toBe(false)
  expect(captureDocument()).toEqual(before)
  expect(action.baseline.isDirty(captureDocument())).toBe(false)
})

it('rejects invalid saved data before confirmation, history or store replacement', () => {
  const action = setup()
  action.storage.getItem.mockReturnValue('{"version":5}')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const before = captureDocument()
  action.handleLoadCanvas()
  expect(alert).toHaveBeenCalled()
  expect(action.confirmReplace).not.toHaveBeenCalled()
  expect(action.commitEdit).not.toHaveBeenCalled()
  expect(action.onLoaded).not.toHaveBeenCalled()
  expect(captureDocument()).toEqual(before)
})

it('loads through one transaction and establishes the loaded baseline with fresh history', () => {
  const action = setup()
  action.handleLoadCanvas()
  expect(action.commitEdit).toHaveBeenCalledOnce()
  expect(action.onLoaded).toHaveBeenCalledOnce()
  expect(action.nodesRef.current[0].id).toBe('loaded')
  expect(action.nodesRef.current).toEqual(useCanvasStore.getState().nodes)
  expect(action.edgesRef.current).toEqual(useCanvasStore.getState().edges)
  expect(action.onLoaded.mock.calls[0][0]).toEqual(captureDocument())
  expect(action.baseline.isDirty(captureDocument())).toBe(false)
  expect(action.history.canUndo()).toBe(false)
  expect(action.history.canRedo()).toBe(false)
})

it('rolls a failed replacement back without acknowledging it as saved', () => {
  const action = setup()
  action.normalizeCanvasNode.mockImplementationOnce(() => { throw new Error('Invalid normalized node') })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const before = captureDocument()
  action.handleLoadCanvas()
  expect(alert).toHaveBeenCalled()
  expect(action.onLoaded).not.toHaveBeenCalled()
  expect(captureDocument()).toEqual(before)
  expect(action.history.canUndo()).toBe(false)
})

it('checks replacement permission when asynchronous file reading completes', () => {
  const action = setup()
  let finish!: () => void
  vi.stubGlobal('FileReader', class {
    result = action.storage.getItem()
    onload: (() => void) | null = null
    /** Defer file completion until the test changes the replacement decision. */
    readAsText() { finish = () => this.onload?.() }
  })
  const event = { target: { files: [{}], value: 'selected-file.json' } } as unknown as ChangeEvent<HTMLInputElement>
  action.handleImportJson(event)
  expect(action.confirmReplace).not.toHaveBeenCalled()
  expect(event.target.value).toBe('')
  action.confirmReplace.mockReturnValue(false)
  const before = captureDocument()
  finish()
  expect(action.confirmReplace).toHaveBeenCalledOnce()
  expect(action.commitEdit).not.toHaveBeenCalled()
  expect(captureDocument()).toEqual(before)
})

it('saves and restores document display mode without overwriting the last explicit local preference', () => {
  const action = setup()
  useNodeDisplayStore.getState().selectMode('detailed')
  action.handleSaveCanvas()
  const saved = JSON.parse(action.storage.setItem.mock.calls.at(-1)![1])
  expect(saved.ui.nodeDisplayMode).toBe('detailed')
  useNodeDisplayStore.getState().selectMode('standard')
  action.storage.getItem.mockReturnValue(JSON.stringify(saved))
  const writes = action.storage.setItem.mock.calls.length
  action.handleLoadCanvas()
  expect(useNodeDisplayStore.getState().mode).toBe('detailed')
  expect(action.storage.setItem).toHaveBeenCalledTimes(writes)
  expect(action.baseline.isDirty(captureDocument())).toBe(false)
})

it.each([['standard', 'standard'], [null, 'compact'], ['unknown', 'compact']] as const)(
  'opens legacy documents using local preference %s with fallback %s', (preference, expected) => {
    const action = setup()
    const legacy = captureDocument()
    delete legacy.ui.nodeDisplayMode
    action.storage.getItem.mockImplementation((key: string) => key === 'test-document' ? JSON.stringify(legacy) : preference)
    action.handleLoadCanvas()
    expect(useNodeDisplayStore.getState().mode).toBe(expected)
    expect(action.baseline.isDirty(captureDocument())).toBe(false)
  },
)

it('rejects invalid display preferences and preserves the current display on failed replacement', () => {
  const action = setup()
  useNodeDisplayStore.getState().selectMode('detailed')
  const invalid = { ...captureDocument(), ui: { ...captureDocument().ui, nodeDisplayMode: 'unknown' } }
  action.storage.getItem.mockReturnValue(JSON.stringify(invalid))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  action.handleLoadCanvas()
  expect(action.confirmReplace).not.toHaveBeenCalled()
  expect(useNodeDisplayStore.getState().mode).toBe('detailed')
  const valid = captureDocument()
  valid.ui.nodeDisplayMode = 'compact'
  action.storage.getItem.mockReturnValue(JSON.stringify(valid))
  action.normalizeCanvasNode.mockImplementationOnce(() => { throw new Error('Invalid normalized node') })
  action.handleLoadCanvas()
  expect(useNodeDisplayStore.getState().mode).toBe('detailed')
  expect(action.onLoaded).not.toHaveBeenCalled()
})

it('unmounts the old graph before replacing a document-specific unit environment', () => {
  const action = setup()
  const incoming = captureDocument()
  const environment = useSettingsStore.getState().units
  useSettingsStore.getState().setEnvironment({ ...environment, definitions: [
    ...environment.definitions, { id: 'minute-test', symbol: 'min', scale: 60, derived: [{ baseUnitId: 's', exponent: 1 }] },
  ] })
  const oldNode = { ...action.nodesRef.current[0], data: { ports: [{
    portId: 'p', category: 'item', id: 'ore', amount: 1,
    unit: [{ baseUnitId: 'item', exponent: 1 }],
    displayUnit: [{ baseUnitId: 'item', exponent: 1 }, { baseUnitId: 'minute-test', exponent: -1 }],
  }] } }
  useCanvasStore.getState().setNodes([oldNode])
  action.nodesRef.current = [oldNode]
  action.storage.getItem.mockReturnValue(JSON.stringify(incoming))
  const observedGraphSizes: number[] = []
  const unsubscribe = useSettingsStore.subscribe(() => observedGraphSizes.push(useCanvasStore.getState().nodes.length))
  try {
    action.handleLoadCanvas()
    expect(observedGraphSizes).toEqual([0])
    expect(useSettingsStore.getState().units).toEqual(environment)
    expect(useCanvasStore.getState().nodes).toMatchObject(incoming.ui.nodes)
    expect(action.history.canUndo()).toBe(false)
    expect(action.baseline.isDirty(captureDocument())).toBe(false)
  } finally { unsubscribe(); useSettingsStore.getState().setEnvironment(environment) }
})
