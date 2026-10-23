import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { captureDocument } from '@/features/file-io/captureDocument'
import { useDocumentSession as createDocumentSession } from './useDocumentSession'
import { useNodeDisplayStore } from '@/features/settings/nodeDisplay.store'
import { captureSnapshot, restoreSnapshot } from '@/features/canvas/hooks/useUndoRedo'

const lifecycle = vi.hoisted(() => ({ cleanups: [] as (() => void)[] }))
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useCallback: (callback: unknown) => callback,
  useState: (initialize: () => unknown) => [initialize(), vi.fn()],
  useEffect: (effect: () => (() => void)) => { lifecycle.cleanups.push(effect()) },
}))

const initialCanvas = useCanvasStore.getState()
const initialRecipes = useRecipeStore.getState()
const initialSettings = useSettingsStore.getState()
const initialRegistry = useGlobalResourceTable.getState()
const events = new Map<string, (event: unknown) => void>()
const confirm = vi.fn(() => false)

beforeEach(() => {
  useCanvasStore.getState().resetCanvas()
  useRecipeStore.setState({ recipes: {} })
  useNodeDisplayStore.setState({ mode: 'compact' })
  events.clear()
  confirm.mockReset().mockReturnValue(false)
  vi.stubGlobal('window', {
    confirm,
    addEventListener: (name: string, listener: (event: unknown) => void) => events.set(name, listener),
    removeEventListener: (name: string) => events.delete(name),
  })
})
afterEach(() => {
  lifecycle.cleanups.splice(0).forEach(cleanup => cleanup())
  vi.unstubAllGlobals()
  useCanvasStore.setState(initialCanvas, true)
  useRecipeStore.setState(initialRecipes, true)
  useSettingsStore.setState(initialSettings, true)
  useGlobalResourceTable.setState(initialRegistry, true)
})

it('protects departure only while persisted document content differs from the saved baseline', () => {
  const session = createDocumentSession()
  const leave = { preventDefault: vi.fn(), returnValue: undefined as string | undefined }
  expect(session.confirmReplace()).toBe(true)
  expect(confirm).not.toHaveBeenCalled()
  events.get('beforeunload')!(leave)
  expect(leave.preventDefault).not.toHaveBeenCalled()
  useSettingsStore.getState().setTps(initialSettings.tps + 1)
  expect(useCanvasStore.getState().isDirty).toBe(true)
  const dirtyDocument = captureDocument()
  expect(session.confirmReplace()).toBe(false)
  expect(confirm).toHaveBeenCalledOnce()
  expect(captureDocument()).toEqual(dirtyDocument)
  events.get('beforeunload')!(leave)
  expect(leave.preventDefault).toHaveBeenCalledOnce()
  expect(leave.returnValue).toBe('')
  session.markSaved(dirtyDocument)
  expect(useCanvasStore.getState().isDirty).toBe(false)
  expect(session.confirmReplace()).toBe(true)
  expect(confirm).toHaveBeenCalledOnce()
})

it('subscribes to every document owner while ignoring derived-only canvas changes', () => {
  const session = createDocumentSession()
  useCanvasStore.setState({ calculationStatus: 'success', systemInputs: { ore: 10 } })
  expect(useCanvasStore.getState().isDirty).toBe(false)
  useRecipeStore.getState().setRecipe('r', {
    recipe_id: 'r', machine_name: 'Unsaved recipe', system: 'custom', duration_seconds: 1, inputs: [], outputs: [], metadata: {},
  })
  expect(useCanvasStore.getState().isDirty).toBe(true)
  session.markSaved(captureDocument())
  useGlobalResourceTable.getState().addCategory({ id: 'session-custom', displayName: 'Custom', base_unit: 'session-widget', themeColor: 'blue', preferred_time_base: 'rate_per_sec' })
  expect(useCanvasStore.getState().isDirty).toBe(true)
  session.markSaved(captureDocument())
  useCanvasStore.getState().setNetworkConfiguration({ ...useCanvasStore.getState().networkConfiguration, machines: { r: { installed: 2, operatingUpper: null } } })
  expect(useCanvasStore.getState().isDirty).toBe(true)
})

it('does not clear newer edits when an earlier captured save finishes', () => {
  const session = createDocumentSession()
  useSettingsStore.getState().setTps(initialSettings.tps + 1)
  const savedSnapshot = captureDocument()
  useSettingsStore.getState().setTps(initialSettings.tps + 2)
  session.markSaved(savedSnapshot)
  expect(useCanvasStore.getState().isDirty).toBe(true)
  expect(session.confirmReplace()).toBe(false)
})

it('tracks display preferences as unsaved without changing model history or retained results', () => {
  const session = createDocumentSession()
  useCanvasStore.setState({ calculationStatus: 'success', systemInputs: { ore: 10 } })
  const modelBefore = captureSnapshot([], [])
  const canvasBefore = useCanvasStore.getState()
  useNodeDisplayStore.getState().selectMode('detailed')
  expect(useCanvasStore.getState()).toEqual({ ...canvasBefore, isDirty: true })
  expect(captureSnapshot([], [])).toEqual(modelBefore)
  session.markSaved(captureDocument())
  expect(useCanvasStore.getState().isDirty).toBe(false)
  useNodeDisplayStore.getState().selectMode('standard')
  restoreSnapshot(modelBefore)
  expect(useNodeDisplayStore.getState().mode).toBe('standard')
  expect(useCanvasStore.getState().isDirty).toBe(true)
  useNodeDisplayStore.getState().selectMode('detailed')
  expect(useCanvasStore.getState().isDirty).toBe(false)
})

it('removes leave listeners and document subscriptions when the session ends', () => {
  createDocumentSession()
  expect(events.has('beforeunload')).toBe(true)
  lifecycle.cleanups.splice(0).forEach(cleanup => cleanup())
  expect(events.has('beforeunload')).toBe(false)
  useSettingsStore.getState().setTps(initialSettings.tps + 1)
  expect(useCanvasStore.getState().isDirty).toBe(false)
})
