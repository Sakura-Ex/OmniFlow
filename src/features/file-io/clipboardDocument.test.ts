import { expect, it } from 'vitest'
import { DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'
import { readCanvasDocument } from './canvasDocument'
import { readClipboardDocument } from './clipboardDocument'

const document = readCanvasDocument({ version: 2, ui: { nodes: [{ id: 's', type: 'sourceNode', position: { x: 0, y: 0 }, data: { ports: [{ category: 'item', id: 'ore', amount: 1 }] } }], edges: [] }, domain: { recipes: {} } }).document

it('preserves persistent port identities through validated clipboard round trips', () => {
  const result = readClipboardDocument(JSON.parse(JSON.stringify(document)), DEFAULT_UNIT_SNAPSHOT)
  expect(result.ui.nodes[0].data.ports[0].portId).toBe(document.ui.nodes[0].data.ports[0].portId)
})
it('rejects malformed clipboard data and incompatible TPS without changing the receiver', () => {
  expect(() => readClipboardDocument({ nodes: [{}], edges: [] }, DEFAULT_UNIT_SNAPSHOT)).toThrow()
  const target = { ...DEFAULT_UNIT_SNAPSHOT, ticksPerSecond: 40 }
  expect(() => readClipboardDocument(document, target)).toThrow('TPS')
  expect(target.ticksPerSecond).toBe(40)
})
