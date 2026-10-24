import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Edge, Node, ReactFlowInstance, Viewport } from 'reactflow'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { useWorkspacePreferences } from './workspacePreferences'

/** Existing object editors presented within the property panel. */
export type PropertySection = 'recipe' | 'boundaries' | 'resources'
/** One inspected selection; no duplicate graph or draft state is stored here. */
export type PropertyTarget = { id: string | null; section: PropertySection; selection: string }

/** Selection identity is insensitive to graph ordering and derived data.
 * @param nodes - Current canvas nodes.
 * @param edges - Current canvas edges.
 * @returns Canonical selected object identities.
 */
export function workspaceSelection(nodes: Node[], edges: Edge[]): string {
  return JSON.stringify([nodes.filter(node => node.selected).map(node => node.id).sort(), edges.filter(edge => edge.selected).map(edge => edge.id).sort()])
}

/** Keep the chosen editor where supported, without replacing its preference on fallback.
 * @param preferred - Last explicitly chosen editor section.
 * @param nodeType - New selection's node type, absent for empty or mixed selections.
 * @returns A section supported by the selected object.
 */
export function compatiblePropertySection(preferred: PropertySection, nodeType?: string): PropertySection {
  if (preferred === 'recipe' && nodeType === 'recipeNode') return preferred
  if (preferred === 'resources' && (nodeType === 'sourceNode' || nodeType === 'targetNode')) return preferred
  return 'boundaries'
}

/** Coordinate selection and view state while keeping the canvas instance mounted.
 * @param options - Current graph, guarded navigation and node editor activation.
 * @param options.nodes - Current authoritative nodes.
 * @param options.edges - Current authoritative edges.
 * @param options.flow - Mounted canvas instance for view navigation.
 * @param options.request - Resolve the current draft before navigation.
 * @param options.activate - Activate the domain editor for a selected object.
 * @returns Panel, property target and explicit viewport navigation actions.
 */
export function useWorkspace({ nodes, edges, flow, request, activate }: {
  nodes: Node[]; edges: Edge[]; flow: React.RefObject<ReactFlowInstance | null>
  request: (action: () => void, cancel?: () => void) => void
  activate: (id: string | null, section: PropertySection) => void
}) {
  const panels = useWorkspacePreferences()
  const [target, setTarget] = useState<PropertyTarget>({ id: null, section: 'boundaries', selection: '' })
  const [expanded, setExpanded] = useState(false)
  const [generation, setGeneration] = useState(0)
  const [canReturn, setCanReturn] = useState(false)
  const [focusToken, setFocusToken] = useState(0)
  const preferredSection = useRef<PropertySection>('boundaries')
  const pendingFocus = useRef<'editor' | 'trigger' | null>(null)
  const editorTrigger = useRef<HTMLElement | null>(null)
  const previousView = useRef<Viewport | null>(null)
  const activateRef = useRef(activate)
  useLayoutEffect(() => { activateRef.current = activate }, [activate])
  useLayoutEffect(() => {
    const destination = pendingFocus.current
    if (!destination) return
    pendingFocus.current = null
    // The leave dialog restores its own trigger during cleanup. Focus the accepted
    // destination after that cleanup, once its editor has mounted and registered.
    const frame = requestAnimationFrame(() => {
      if (destination === 'trigger') {
        const fallback = document.querySelector<HTMLElement>('[data-workspace-properties-toggle]')
        const trigger = editorTrigger.current
        if (trigger?.isConnected && !trigger.closest('[hidden], [inert]')) trigger.focus({ preventScroll: true })
        // Pointer activation need not focus the clicked control. A captured body,
        // removed node button or hidden trigger must not strand keyboard focus.
        if (!trigger || document.activeElement !== trigger) fallback?.focus({ preventScroll: true })
        return
      }
      const panel = document.querySelector<HTMLElement>('[data-workspace-properties]:not([hidden])')
      const field = panel?.querySelector<HTMLElement>('[data-workspace-initial-focus], input:not([disabled]):not([type="hidden"]):not([role="combobox"]), textarea:not([disabled]), select:not([disabled])')
      ;(field ?? panel)?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [focusToken])
  const selection = workspaceSelection(nodes, edges)
  const narrow = () => window.matchMedia('(max-width: 1100px)').matches
  const select = (id: string) => {
    const canvas = useCanvasStore.getState()
    canvas.setNodes(canvas.nodes.map(node => ({ ...node, selected: node.id === id })))
    canvas.setEdges(canvas.edges.map(edge => ({ ...edge, selected: false })))
  }
  const restoreSelection = (encoded: string) => {
    const [nodeIds, edgeIds] = JSON.parse(encoded || '[[],[]]') as [string[], string[]]
    const canvas = useCanvasStore.getState()
    canvas.setNodes(canvas.nodes.map(node => ({ ...node, selected: nodeIds.includes(node.id) })))
    canvas.setEdges(canvas.edges.map(edge => ({ ...edge, selected: edgeIds.includes(edge.id) })))
  }
  useEffect(() => {
    if (!panels.properties || selection === target.selection) return
    const [ids, edgeIds] = JSON.parse(selection) as [string[], string[]]
    const id = ids.length === 1 && edgeIds.length === 0 ? ids[0] : null
    request(() => {
      // A later ReactFlow selection event must not replace an already pending navigation.
      restoreSelection(selection)
      const section = compatiblePropertySection(preferredSection.current, useCanvasStore.getState().nodes.find(node => node.id === id)?.type)
      setTarget({ id, section, selection })
      activateRef.current(id, section)
    }, () => restoreSelection(target.selection))
  }, [selection, panels.properties, target.selection, request])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1100px)')
    const adapt = () => {
      const current = useWorkspacePreferences.getState()
      if (media.matches && current.objects && current.properties) current.setPanels({ objects: false })
    }
    adapt()
    media.addEventListener('change', adapt)
    return () => media.removeEventListener('change', adapt)
  }, [])

  const openProperties = (id: string | null, requestedSection?: PropertySection) => {
    // Capture before the draft guard opens a modal, and keep the original external
    // trigger when switching tabs inside an already-open property panel.
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const inPanel = Boolean(active?.closest('[data-workspace-properties]'))
    const trigger = !inPanel && active?.matches('button, a[href], input, textarea, select, [tabindex]') ? active : null
    request(() => {
      if (requestedSection) preferredSection.current = requestedSection
      const section = compatiblePropertySection(preferredSection.current, useCanvasStore.getState().nodes.find(node => node.id === id)?.type)
      const selected = id ? JSON.stringify([[id], []]) : selection
      if (id) select(id)
      setTarget({ id, section, selection: selected })
      activateRef.current(id, section)
      panels.setPanels({ properties: true, ...(narrow() ? { objects: false } : {}) })
      if (!inPanel) editorTrigger.current = trigger
      pendingFocus.current = 'editor'
      setFocusToken(value => value + 1)
    })
  }
  const closeProperties = () => request(() => {
    activateRef.current(null, 'boundaries')
    panels.setPanels({ properties: false })
    pendingFocus.current = 'trigger'
    setFocusToken(value => value + 1)
  })
  const toggleObjects = () => {
    const opening = !panels.objects
    const apply = () => {
      if (opening && narrow()) activateRef.current(null, 'boundaries')
      panels.setPanels({ objects: opening, ...(opening && narrow() ? { properties: false } : {}) })
    }
    if (opening && narrow() && panels.properties) request(apply)
    else apply()
  }
  const locate = (id: string) => {
    const instance = flow.current
    const node = useCanvasStore.getState().nodes.find(item => item.id === id)
    if (!instance || !node) return
    previousView.current ??= instance.getViewport()
    setCanReturn(true)
    void instance.fitView({ nodes: [node], padding: 0.6, maxZoom: 1 })
  }
  const returnView = () => {
    if (previousView.current) void flow.current?.setViewport(previousView.current)
    previousView.current = null
    setCanReturn(false)
  }
  const reset = useCallback(() => {
    preferredSection.current = 'boundaries'
    pendingFocus.current = null
    editorTrigger.current = null
    previousView.current = null
    setCanReturn(false)
    setGeneration(value => value + 1)
    setExpanded(false)
    restoreSelection('[[],[]]')
    setTarget({ id: null, section: 'boundaries', selection: '[[],[]]' })
    activateRef.current(null, 'boundaries')
  }, [])
  return { ...panels, target, expanded, setExpanded, generation, openProperties, closeProperties, toggleObjects,
    select: (id: string) => request(() => select(id)), locate, returnView, canReturn, reset }
}
