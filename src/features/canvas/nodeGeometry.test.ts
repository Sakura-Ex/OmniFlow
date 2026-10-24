import { describe, expect, it } from 'vitest'
import { resourceGeometrySignature, splitterGeometrySignature } from './nodeGeometry'

describe('resource geometry invalidation', () => {
  const input = { portId: 'ore', category: 'item', routing_mode: 'wired', amount: 2 }
  const output = { portId: 'ingot', category: 'item', routing_mode: 'wired', amount: 1 }

  it('ignores presentation mode, amounts and display names when geometry is unchanged', () => {
    const original = resourceGeometrySignature([[input], [output]])
    for (const mode of ['compact', 'standard', 'detailed']) {
      const changedPresentation = { ...input, amount: 200, displayName: 'Long renamed resource', mode }
      expect(resourceGeometrySignature([[changedPresentation], [output]])).toBe(original)
    }
  })

  it('invalidates category headers, resource order and wired/global handle changes', () => {
    const original = resourceGeometrySignature([[input, output]])
    expect(resourceGeometrySignature([[input, { ...output, category: 'fluid' }]])).not.toBe(original)
    expect(resourceGeometrySignature([[output, input]])).not.toBe(original)
    expect(resourceGeometrySignature([[{ ...input, routing_mode: 'global' }, output]])).not.toBe(original)
  })

  it('includes utility regions and category grouping rather than only port identities', () => {
    const utility = { portId: 'power', category: 'energy', utility_type: 'power' }
    const original = resourceGeometrySignature([[input], [output], [utility], []])
    expect(resourceGeometrySignature([[input], [output, utility], [], []])).not.toBe(original)
    expect(resourceGeometrySignature([[input], [output], [{ ...utility, utility_type: 'heat' }], []])).not.toBe(original)
    expect(resourceGeometrySignature([[input], [output], [], []])).not.toBe(original)
  })
})

describe('splitter geometry invalidation', () => {
  it('remeasures a new draft branch when its persisted handle becomes available', () => {
    const draft = splitterGeometrySignature('in', ['a', 'b'], ['a'])
    expect(splitterGeometrySignature('in', ['a', 'b'], ['a', 'b'])).not.toBe(draft)
    expect(splitterGeometrySignature('new-input', ['a', 'b'], ['a'])).not.toBe(draft)
    expect(splitterGeometrySignature('in', ['b', 'a'], ['a'])).not.toBe(draft)
  })

  it('ignores unrelated committed branches and keeps canceled draft geometry stable', () => {
    const original = splitterGeometrySignature('in', ['a'], ['a'])
    expect(splitterGeometrySignature('in', ['a'], ['a', 'removed'])).toBe(original)
    expect(splitterGeometrySignature('in', ['a', 'b'], ['a'])).not.toBe(original)
    expect(splitterGeometrySignature('in', ['a'], ['a'])).toBe(original)
  })
})
