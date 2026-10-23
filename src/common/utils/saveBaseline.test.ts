import { expect, it } from 'vitest'
import { createSaveBaseline, documentKey } from './saveBaseline'

it('compares nested object content independently of insertion order while preserving array order', () => {
  const document = { nodes: [{ id: 'a', data: { amount: 1, name: 'A' } }, { id: 'b' }], environment: { tps: 20 } }
  const reordered = { environment: { tps: 20 }, nodes: [{ data: { name: 'A', amount: 1 }, id: 'a' }, { id: 'b' }] }
  const baseline = createSaveBaseline(document)
  expect(baseline.isDirty(reordered)).toBe(false)
  expect(documentKey(reordered)).toBe(documentKey(document))
  expect(baseline.isDirty({ ...reordered, nodes: [...reordered.nodes].reverse() })).toBe(true)
})

it('returns to clean after undo restores the saved document and remains clean after redo to a later save', () => {
  const first = { value: 'A' }, second = { value: 'B' }
  const baseline = createSaveBaseline(first)
  expect(baseline.isDirty(second)).toBe(true)
  expect(baseline.isDirty(first)).toBe(false)
  baseline.markSaved(second)
  expect(baseline.isDirty(second)).toBe(false)
  expect(baseline.isDirty(first)).toBe(true)
  expect(baseline.isDirty(second)).toBe(false)
})

it('acknowledges the captured save snapshot while retaining edits made before save completion', async () => {
  const current = { nodes: [{ id: 'a', amount: 1 }] }
  const baseline = createSaveBaseline({ nodes: [] })
  const pendingSnapshot = structuredClone(current)
  let complete!: () => void
  const persistence = new Promise<void>(resolve => { complete = resolve })
  const saving = persistence.then(() => baseline.markSaved(pendingSnapshot))
  current.nodes[0].amount = 2
  complete()
  await saving
  expect(baseline.isDirty(current)).toBe(true)
  expect(baseline.isDirty(pendingSnapshot)).toBe(false)
  pendingSnapshot.nodes[0].amount = 3
  expect(baseline.isDirty(pendingSnapshot)).toBe(true)
  expect(baseline.isDirty({ nodes: [{ id: 'a', amount: 1 }] })).toBe(false)
})
