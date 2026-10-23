import { expect, it, vi } from 'vitest'
import { createHistory } from './history'

const setup = (limit?: number) => {
  let document = { value: 'A', items: [] as string[] }
  const history = createHistory({ capture: () => structuredClone(document), restore: snapshot => { document = structuredClone(snapshot) }, limit })
  return { history, read: () => document, edit: (value: string) => history.commit(() => { document.value = value }) }
}

it('discards the abandoned redo branch when editing after undo', () => {
  const { history, read, edit } = setup()
  edit('B')
  edit('C')
  history.undo()
  expect(read().value).toBe('B')
  edit('D')
  expect(history.canRedo()).toBe(false)
  history.redo()
  expect(read().value).toBe('D')
  history.undo()
  expect(read().value).toBe('B')
  history.undo()
  expect(read().value).toBe('A')
})

it('preserves redo and emits no change when a commit makes no semantic edit', () => {
  const { history, edit, read } = setup()
  edit('B')
  history.undo()
  const listener = vi.fn()
  const unsubscribe = history.subscribe(listener)
  const revision = history.getRevision()
  edit('A')
  expect(history.getRevision()).toBe(revision)
  expect(listener).not.toHaveBeenCalled()
  expect(history.canRedo()).toBe(true)
  history.redo()
  expect(read().value).toBe('B')
  expect(listener).toHaveBeenCalledOnce()
  unsubscribe()
})

it('rolls a failed edit back without recording it or removing existing redo', () => {
  const { history, edit, read } = setup()
  edit('B')
  history.undo()
  const revision = history.getRevision()
  expect(() => history.commit(() => {
    read().value = 'Partial'
    read().items.push('Partial child')
    throw new Error('Preparation failed')
  })).toThrow('Preparation failed')
  expect(read()).toEqual({ value: 'A', items: [] })
  expect(history.getRevision()).toBe(revision)
  expect(history.canUndo()).toBe(false)
  expect(history.canRedo()).toBe(true)
  history.redo()
  expect(read()).toEqual({ value: 'B', items: [] })
})

it('undoes and redoes a multi-item edit as one action', () => {
  const { history, read } = setup()
  history.commit(() => {
    read().items.push('source', 'target', 'connection')
    read().value = 'Configured'
  })
  history.undo()
  expect(read()).toEqual({ value: 'A', items: [] })
  expect(history.canUndo()).toBe(false)
  history.redo()
  expect(read()).toEqual({ value: 'Configured', items: ['source', 'target', 'connection'] })
})

it('bounds retained undo history while preserving every available redo step', () => {
  const { history, edit, read } = setup(2)
  for (const value of ['B', 'C', 'D']) edit(value)
  history.undo()
  expect(read().value).toBe('C')
  history.undo()
  expect(read().value).toBe('B')
  expect(history.canUndo()).toBe(false)
  history.undo()
  expect(read().value).toBe('B')
  history.redo()
  history.redo()
  expect(read().value).toBe('D')
  expect(history.canRedo()).toBe(false)
  history.clear()
  expect(history.canUndo()).toBe(false)
  expect(history.canRedo()).toBe(false)
  expect(read().value).toBe('D')
})
