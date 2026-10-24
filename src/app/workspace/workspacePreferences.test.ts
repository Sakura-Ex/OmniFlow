import { describe, expect, it } from 'vitest'
import { parseWorkspacePreferences, useWorkspacePreferences } from './workspacePreferences'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { captureDocument } from '@/features/file-io/captureDocument'

describe('workspace preferences', () => {
  it('recovers malformed and older local preferences', () => {
    expect(parseWorkspacePreferences(null)).toEqual({ objects: true, properties: false })
    expect(parseWorkspacePreferences({ objects: 'false', properties: 1 })).toEqual({ objects: true, properties: false })
    expect(parseWorkspacePreferences({ objects: false, properties: true })).toEqual({ objects: false, properties: true })
  })
  it('keeps panel choices outside the document and result lifecycle', () => {
    const before = captureDocument()
    const state = useCanvasStore.getState()
    useWorkspacePreferences.getState().setPanels({ objects: false, properties: true })
    expect(captureDocument()).toEqual(before)
    expect(useCanvasStore.getState()).toBe(state)
  })
})
