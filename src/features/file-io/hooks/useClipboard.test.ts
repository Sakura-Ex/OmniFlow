import { createSplitterData } from '@/features/calculation/splitter'
import { readClipboardDocument } from '../clipboardDocument'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { afterEach, expect, it, vi } from 'vitest'
import type { Node } from 'reactflow'
import { useClipboard } from './useClipboard'

vi.mock('react', async (original) => ({ ...await original<typeof import('react')>(), useCallback: (callback: unknown) => callback, useRef: (current: unknown) => ({ current }) }))
afterEach(() => vi.unstubAllGlobals())

it('cuts the copied selection before an asynchronous clipboard write can change selection', async () => {
  let finish!: () => void
  const write = new Promise<void>((resolve) => { finish = resolve })
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(() => write) } })
  const nodesRef = { current: [{ id: 'original', type: 'sourceNode', position: { x: 0, y: 0 }, data: {}, selected: true }] as Node[] }
  const deleted: string[] = []
  const { handleCut } = useClipboard({ nodesRef, edgesRef: { current: [] }, setNodes: vi.fn(), setEdges: vi.fn(), takeSnapshot: vi.fn(), onDeleteSelected: () => { deleted.push(...nodesRef.current.filter((n) => n.selected).map((n) => n.id)) } })
  const pending = handleCut()
  nodesRef.current = [{ ...nodesRef.current[0], id: 'later-selection' }]
  finish()
  await pending
  expect(deleted).toEqual(['original'])
})

it('rejects malformed external clipboard data before taking history or mutating the canvas', async () => {
  vi.stubGlobal('navigator', { clipboard: { readText: async () => JSON.stringify({ nodes: [{}], edges: [] }) } })
  vi.stubGlobal('alert', vi.fn())
  const setNodes = vi.fn(), takeSnapshot = vi.fn()
  const { handlePaste } = useClipboard({ nodesRef: { current: [] }, edgesRef: { current: [] }, setNodes, setEdges: vi.fn(), takeSnapshot, onDeleteSelected: vi.fn() })
  await handlePaste()
  expect(setNodes).not.toHaveBeenCalled()
  expect(takeSnapshot).not.toHaveBeenCalled()
  expect(alert).toHaveBeenCalled()
})


it('rejects cutting part of a fixed-ratio group before writing clipboard or deleting nodes', async () => {
  const previous = useCanvasStore.getState().networkConfiguration
  const writeText = vi.fn(), onDeleteSelected = vi.fn()
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  vi.stubGlobal('alert', vi.fn())
  const policy = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' as const }, boundary: { kind: 'delivery' as const, mode: 'maximize' as const, amount: 0, capacity: null, objective: { priority: 0, weight: 1, scale: 1, ratioGroup: 'all-three', ratio: 1 } } }
  const nodes = ['a', 'b', 'c'].map((id) => ({ id, type: 'targetNode', position: { x: 0, y: 0 }, selected: id !== 'c', data: { ports: [{ portId: 'p', category: 'item', id: 'plate', amount: 1 }] } }))
  useCanvasStore.getState().setNetworkConfiguration({ version: 1, machines: {}, ports: Object.fromEntries(nodes.map((node) => [JSON.stringify([node.id, 'p']), policy])) })
  try {
    const { handleCut } = useClipboard({ nodesRef: { current: nodes }, edgesRef: { current: [] }, setNodes: vi.fn(), setEdges: vi.fn(), takeSnapshot: vi.fn(), onDeleteSelected })
    await handleCut()
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('all fixed-ratio group members'))
    expect(onDeleteSelected).not.toHaveBeenCalled()
    expect(writeText).not.toHaveBeenCalled()
  } finally { useCanvasStore.getState().setNetworkConfiguration(previous) }
})

it('copies solved splitter configuration without carrying transient throughput into the new document', async () => {
  const writeText = vi.fn()
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  const data = { ...createSplitterData({ category: 'item', id: 'ore' }), port_throughputs: { old: 10 }, actual_amounts: { old: 10 } }
  const node = { id: 'f', type: 'splitterNode', position: { x: 0, y: 0 }, selected: true, data }
  const { handleCopy } = useClipboard({ nodesRef: { current: [node] }, edgesRef: { current: [] }, setNodes: vi.fn(), setEdges: vi.fn(), takeSnapshot: vi.fn(), onDeleteSelected: vi.fn() })
  await handleCopy()
  const copied = JSON.parse(writeText.mock.calls[0][0])
  expect(copied.ui.nodes[0].data.port_throughputs).toBeUndefined()
  expect(copied.ui.nodes[0].data.actual_amounts).toBeUndefined()
  expect(() => readClipboardDocument(copied, copied.environment)).not.toThrow()
  expect(data.port_throughputs.old).toBe(10)
})

it('reads a newer system clipboard document ahead of an existing internal copy', async () => {
  vi.stubGlobal('alert', vi.fn())
  const writeText = vi.fn()
  const readText = vi.fn()
  vi.stubGlobal('navigator', { clipboard: { writeText, readText } })
  const nodesRef = { current: [{ id: 'local', type: 'sourceNode', position: { x: 0, y: 0 }, selected: true, data: { label: 'Internal copy', ports: [{ portId: 'p', category: 'item', id: 'ore', amount: 1 }] } }] as Node[] }
  const takeSnapshot = vi.fn()
  const { handleCopy, handlePaste } = useClipboard({ nodesRef, edgesRef: { current: [] }, setNodes: vi.fn(), setEdges: vi.fn(), takeSnapshot, onDeleteSelected: vi.fn() })
  await handleCopy()
  const external = JSON.parse(writeText.mock.calls[0][0])
  external.ui.nodes[0].data.label = 'System copy'
  readText.mockResolvedValue(JSON.stringify(external))
  await handlePaste()
  expect(vi.mocked(alert).mock.calls).toEqual([])
  expect(readText).toHaveBeenCalledOnce()
  expect(nodesRef.current.at(-1)?.data.label).toBe('System copy')
  expect(takeSnapshot).toHaveBeenCalledOnce()
})

it.each(['denied', 'missing-api'] as const)('falls back to the internal copy when system clipboard reading is %s', async (mode) => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn() } })
  const nodesRef = { current: [{ id: 'local', type: 'sourceNode', position: { x: 0, y: 0 }, selected: true, data: { label: 'Internal copy', ports: [{ portId: 'p', category: 'item', id: 'ore', amount: 1 }] } }] as Node[] }
  const takeSnapshot = vi.fn()
  const { handleCopy, handlePaste } = useClipboard({ nodesRef, edgesRef: { current: [] }, setNodes: vi.fn(), setEdges: vi.fn(), takeSnapshot, onDeleteSelected: vi.fn() })
  await handleCopy()
  vi.stubGlobal('navigator', mode === 'denied' ? { clipboard: { readText: vi.fn().mockRejectedValue(new Error('Permission denied')) } } : {})
  await handlePaste()
  expect(nodesRef.current).toHaveLength(2)
  expect(nodesRef.current[1].data.label).toBe('Internal copy')
  expect(takeSnapshot).toHaveBeenCalledOnce()
})

it.each(['', 'plain text', JSON.stringify({ nodes: [{}], edges: [] })])('does not revive an old internal copy after a successful system read of invalid text %j', async (text) => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(), readText: vi.fn().mockResolvedValue(text) } })
  vi.stubGlobal('alert', vi.fn())
  const nodesRef = { current: [{ id: 'local', type: 'sourceNode', position: { x: 0, y: 0 }, selected: true, data: { label: 'Old copy', ports: [{ portId: 'p', category: 'item', id: 'ore', amount: 1 }] } }] as Node[] }
  const setNodes = vi.fn(), setEdges = vi.fn(), takeSnapshot = vi.fn()
  const { handleCopy, handlePaste } = useClipboard({ nodesRef, edgesRef: { current: [] }, setNodes, setEdges, takeSnapshot, onDeleteSelected: vi.fn() })
  await handleCopy()
  const before = structuredClone(nodesRef.current)
  const configuration = structuredClone(useCanvasStore.getState().networkConfiguration)
  await handlePaste()
  expect(alert).toHaveBeenCalled()
  expect(nodesRef.current).toEqual(before)
  expect(useCanvasStore.getState().networkConfiguration).toEqual(configuration)
  expect(setNodes).not.toHaveBeenCalled()
  expect(setEdges).not.toHaveBeenCalled()
  expect(takeSnapshot).not.toHaveBeenCalled()
})
