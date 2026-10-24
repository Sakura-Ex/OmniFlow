import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ReactFlowInstance, Viewport } from 'reactflow'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { captureDocument } from '@/features/file-io/captureDocument'
import { calculationDocumentKey } from '@/features/calculation/calculationSession'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useWorkspace, workspaceSelection } from './useWorkspace'
import { useWorkspacePreferences } from './workspacePreferences'

const lifecycle = vi.hoisted(() => ({ cleanups: [] as (() => void)[], layouts: [] as (() => void | (() => void))[] }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useCallback: (callback: unknown) => callback,
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => [typeof initial === 'function' ? initial() : initial, vi.fn()],
  useLayoutEffect: (effect: () => void | (() => void)) => { lifecycle.layouts.push(effect); const cleanup = effect(); if (cleanup) lifecycle.cleanups.push(cleanup) },
  useEffect: (effect: () => void | (() => void)) => { const cleanup = effect(); if (cleanup) lifecycle.cleanups.push(cleanup) },
}))
vi.mock('./workspacePreferences', async original => {
  const module = await original<typeof import('./workspacePreferences')>()
  return { ...module, useWorkspacePreferences: Object.assign(() => module.useWorkspacePreferences.getState(), module.useWorkspacePreferences) }
})

const initial = useCanvasStore.getState()
let narrow = false
beforeEach(() => {
  lifecycle.layouts.length = 0
  narrow = false
  useCanvasStore.getState().resetCanvas()
  useCanvasStore.getState().setNodes([
    { id: 'a', type: 'sourceNode', position: { x: 15, y: 35 }, data: { ports: [] } },
    { id: 'b', type: 'targetNode', position: { x: 600, y: 200 }, data: { ports: [] } },
  ])
  useCanvasStore.setState({ calculationStatus: 'success', isDirty: false })
  useWorkspacePreferences.setState({ objects: true, properties: false })
  vi.stubGlobal('window', { matchMedia: () => ({ matches: narrow, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
})
afterEach(() => {
  lifecycle.cleanups.splice(0).forEach(cleanup => cleanup())
  useCanvasStore.setState(initial, true)
  vi.unstubAllGlobals()
})

const modelKey = () => {
  const canvas = useCanvasStore.getState()
  return calculationDocumentKey(canvas.nodes, canvas.edges, useRecipeStore.getState().recipes, canvas.networkConfiguration, useSettingsStore.getState().units)
}

it('locates several objects and returns to the original actual view without changing the graph or selection', () => {
  const original: Viewport = { x: 46, y: -17, zoom: .65 }
  const getViewport = vi.fn(() => original)
  const fitView = vi.fn()
  const setViewport = vi.fn()
  const flow = { current: { getViewport, fitView, setViewport } as unknown as ReactFlowInstance }
  const canvas = useCanvasStore.getState()
  const before = captureDocument()
  const beforeKey = modelKey()
  const workspace = useWorkspace({ nodes: canvas.nodes, edges: canvas.edges, flow, request: action => action(), activate: vi.fn() })
  workspace.locate('a')
  workspace.locate('b')
  workspace.locate('missing')
  workspace.returnView()
  expect(getViewport).toHaveBeenCalledOnce()
  expect(fitView).toHaveBeenCalledTimes(2)
  expect(setViewport).toHaveBeenCalledWith(original)
  expect(captureDocument()).toEqual(before)
  expect(modelKey()).toBe(beforeKey)
  expect(useCanvasStore.getState().calculationStatus).toBe('success')
  expect(useCanvasStore.getState().isDirty).toBe(false)
})

it('selects independently of navigation and does not count selection order as a different target', () => {
  const canvas = useCanvasStore.getState()
  const before = captureDocument()
  const beforeKey = modelKey()
  const activate = vi.fn()
  const workspace = useWorkspace({ nodes: canvas.nodes, edges: canvas.edges, flow: { current: null }, request: action => action(), activate })
  workspace.select('b')
  expect(useCanvasStore.getState().nodes.filter(node => node.selected).map(node => node.id)).toEqual(['b'])
  expect(activate).not.toHaveBeenCalled()
  expect(captureDocument()).toEqual(before)
  expect(modelKey()).toBe(beforeKey)
  const selected = canvas.nodes.map(node => ({ ...node, selected: true }))
  expect(workspaceSelection(selected, [])).toBe(workspaceSelection([...selected].reverse(), []))
})

it('shows one narrow-screen panel without dropping the property editor and guards switching to objects', () => {
  narrow = true
  useWorkspacePreferences.setState({ objects: true, properties: true })
  const canvas = useCanvasStore.getState()
  const requests: (() => void)[] = []
  const activate = vi.fn()
  useWorkspace({ nodes: canvas.nodes, edges: canvas.edges, flow: { current: null }, request: action => requests.push(action), activate })
  expect(useWorkspacePreferences.getState()).toMatchObject({ objects: false, properties: true })
  // A later render observes the responsive panel choice; opening objects must await its guard.
  const workspace = useWorkspace({ nodes: canvas.nodes, edges: canvas.edges, flow: { current: null }, request: action => requests.push(action), activate })
  requests.length = 0
  workspace.toggleObjects()
  expect(useWorkspacePreferences.getState()).toMatchObject({ objects: false, properties: true })
  requests[0]()
  expect(useWorkspacePreferences.getState()).toMatchObject({ objects: true, properties: false })
  expect(activate).toHaveBeenCalledWith(null, 'boundaries')
})

it('focuses only an explicitly accepted editor and restores its original external trigger', () => {
  /** Minimal DOM focus target for the guarded navigation contract. */
  class Element {
    isConnected = true
    focus = vi.fn(() => { documentStub.activeElement = this })
    insidePanel: boolean
    focusable: boolean
    /** Record whether this trigger belongs to the property editor.
     * @param insidePanel - Whether the element is inside the editor.
     * @param focusable - Whether this is an interactive trigger rather than the body.
     */
    constructor(insidePanel = false, focusable = true) { this.insidePanel = insidePanel; this.focusable = focusable }
    /** Resolve the only ancestor queried by the navigation hook.
     * @returns Editor ancestry, or no matching parent.
     */
    closest() { return this.insidePanel ? this : null }
    /** Identify a meaningful focus origin.
     * @returns Whether the element matches an interactive selector.
     */
    matches() { return this.focusable }
  }
  const trigger = new Element()
  const field = new Element(true)
  const tab = new Element(true)
  const fallback = new Element()
  const panel = { querySelector: vi.fn((selector: string) => selector ? field : null), focus: vi.fn() }
  const documentStub = { activeElement: trigger, querySelector: vi.fn((selector: string) => selector === '[data-workspace-properties-toggle]' ? fallback : panel) }
  const frames: (() => void)[] = []
  vi.stubGlobal('HTMLElement', Element)
  vi.stubGlobal('document', documentStub)
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { frames.push(callback); return frames.length })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const requests: (() => void)[] = []
  const canvas = useCanvasStore.getState()
  const workspace = useWorkspace({ nodes: canvas.nodes, edges: canvas.edges, flow: { current: null }, request: action => requests.push(action), activate: vi.fn() })
  const renderAcceptedNavigation = () => {
    lifecycle.layouts.forEach(effect => { const cleanup = effect(); if (cleanup) lifecycle.cleanups.push(cleanup) })
    frames.splice(0).forEach(frame => frame())
  }
  workspace.openProperties('a', 'resources')
  renderAcceptedNavigation()
  expect(field.focus).not.toHaveBeenCalled()
  requests.shift()!()
  renderAcceptedNavigation()
  expect(field.focus).toHaveBeenCalledOnce()
  expect(field.focus).toHaveBeenCalledWith({ preventScroll: true })
  expect(panel.querySelector.mock.calls[0][0]).toContain(':not([role="combobox"])')

  // Explicit in-panel tab switches focus the new form but do not replace the origin.
  documentStub.activeElement = tab
  workspace.openProperties('a', 'boundaries')
  requests.shift()!()
  renderAcceptedNavigation()
  expect(field.focus).toHaveBeenCalledTimes(2)
  workspace.select('b')
  requests.shift()!()
  renderAcceptedNavigation()
  expect(field.focus).toHaveBeenCalledTimes(2)
  workspace.closeProperties()
  expect(trigger.focus).not.toHaveBeenCalled()
  requests.shift()!()
  renderAcceptedNavigation()
  expect(trigger.focus).toHaveBeenCalledWith({ preventScroll: true })
  expect(tab.focus).not.toHaveBeenCalled()

  // A pointer click may leave the body active; closing must reach a real control.
  documentStub.activeElement = new Element(false, false)
  workspace.openProperties('a')
  requests.shift()!()
  renderAcceptedNavigation()
  workspace.closeProperties()
  requests.shift()!()
  renderAcceptedNavigation()
  expect(fallback.focus).toHaveBeenCalledWith({ preventScroll: true })
  expect(documentStub.activeElement).toBe(fallback)

  // The originally captured node button may be removed while browsing another node.
  documentStub.activeElement = trigger
  workspace.openProperties('b')
  requests.shift()!()
  renderAcceptedNavigation()
  trigger.isConnected = false
  workspace.closeProperties()
  requests.shift()!()
  renderAcceptedNavigation()
  expect(documentStub.activeElement).toBe(fallback)
})
