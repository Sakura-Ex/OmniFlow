import { expect, it, vi } from 'vitest'
import { createEditorGuard } from './editorGuard'

it('keeps the first pending selection and restores its original selection on cancellation', () => {
  const guard = createEditorGuard()
  const navigate = vi.fn()
  const restore = vi.fn()
  const laterNavigate = vi.fn()
  const laterRestore = vi.fn()
  guard.register({ dirty: true, save: () => true, discard: vi.fn() })
  guard.request(navigate, restore)
  guard.request(laterNavigate, laterRestore)
  guard.cancel()
  expect(restore).toHaveBeenCalledOnce()
  expect(navigate).not.toHaveBeenCalled()
  expect(laterNavigate).not.toHaveBeenCalled()
  expect(laterRestore).not.toHaveBeenCalled()
  expect(guard.getSnapshot()).toMatchObject({ asking: false, returnFocus: true })
})

it('retains invalid drafts and cancels navigation when save fails or throws', async () => {
  for (const save of [() => false, () => { throw new Error('Validation failed') }]) {
    const guard = createEditorGuard()
    const navigate = vi.fn()
    const restore = vi.fn()
    const discard = vi.fn()
    guard.register({ dirty: true, save, discard })
    guard.request(navigate, restore)
    await guard.save()
    expect(navigate).not.toHaveBeenCalled()
    expect(discard).not.toHaveBeenCalled()
    expect(restore).toHaveBeenCalledOnce()
    expect(guard.hasDraft()).toBe(true)
    expect(guard.getSnapshot()).toMatchObject({ asking: false, saving: false, failed: true, returnFocus: true })
  }
})

it('executes a pending action only once across repeated asynchronous save clicks', async () => {
  const guard = createEditorGuard()
  let complete!: (saved: boolean) => void
  const save = vi.fn(() => new Promise<boolean>(resolve => { complete = resolve }))
  const navigate = vi.fn()
  guard.register({ dirty: true, save, discard: vi.fn() })
  guard.request(navigate)
  const first = guard.save()
  const second = guard.save()
  guard.cancel()
  guard.discard()
  expect(guard.getSnapshot().saving).toBe(true)
  complete(true)
  await Promise.all([first, second])
  expect(save).toHaveBeenCalledOnce()
  expect(navigate).toHaveBeenCalledOnce()
  expect(guard.getSnapshot()).toMatchObject({ asking: false, saving: false })
})

it('invalidates a pending async save on document replacement', async () => {
  const guard = createEditorGuard()
  let complete!: (saved: boolean) => void
  const navigateOldDocument = vi.fn()
  guard.register({ dirty: true, save: () => new Promise(resolve => { complete = resolve }), discard: vi.fn() })
  guard.request(navigateOldDocument)
  const saving = guard.save()
  guard.reset()
  complete(true)
  await saving
  expect(navigateOldDocument).not.toHaveBeenCalled()
  expect(guard.hasDraft()).toBe(false)
  expect(guard.getSnapshot().asking).toBe(false)
})

it('discards through the editor before navigation and does not prompt for clean view actions', () => {
  const guard = createEditorGuard()
  const calls: string[] = []
  guard.register({ dirty: true, save: () => true, discard: () => calls.push('discard') })
  guard.request(() => calls.push('navigate'))
  guard.discard()
  expect(calls).toEqual(['discard', 'navigate'])
  guard.register({ dirty: false, save: () => true, discard: vi.fn() })
  guard.request(() => calls.push('clean'))
  expect(calls).toEqual(['discard', 'navigate', 'clean'])
  expect(guard.getSnapshot().asking).toBe(false)
})
