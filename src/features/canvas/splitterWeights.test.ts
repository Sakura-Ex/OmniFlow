import { describe, expect, it } from 'vitest'
import { SplitterNodeDataSchema } from '@/common/schemas/splitter.schema'
import { splitterFixture } from '../../../fixtures/compiler/splitterCases'
import { normalizeSplitterWeights, splitterAllocationKey, splitterWeightDrafts } from './splitterWeights'

describe('relative splitter weight editing', () => {
  it('accepts 2:3 and preserves the normalized persisted schema', () => {
    const weights = normalizeSplitterWeights([2, 3])
    expect(weights).toEqual({ ok: true, ratios: [0.4, 0.6] })
    if (!weights.ok) throw new Error('Expected valid weights')
    const data = SplitterNodeDataSchema.parse(splitterFixture().nodes[0].data)
    const saved = SplitterNodeDataSchema.parse({ ...data, outputs: data.outputs.map((output, index) => ({ ...output, ratio: weights.ratios[index] })) })
    expect(saved.outputs.map(output => output.ratio)).toEqual([0.4, 0.6])
    expect(SplitterNodeDataSchema.safeParse({ ...data, outputs: data.outputs.map((output, index) => ({ ...output, ratio: [2, 3][index] })) }).success).toBe(false)
  })

  it('rejects negative, nonfinite and all-zero weights while allowing zero branches', () => {
    for (const weights of [[-1, 3], [NaN, 3], [Infinity, 1], []]) expect(normalizeSplitterWeights(weights)).toEqual({ ok: false, reason: 'invalid' })
    expect(normalizeSplitterWeights([0, 0])).toEqual({ ok: false, reason: 'zero' })
    expect(normalizeSplitterWeights([0, 2, 3])).toEqual({ ok: true, ratios: [0, 0.4, 0.6] })
  })

  it('normalizes extreme finite weights without sum overflow and rejects lost positive branches', () => {
    expect(normalizeSplitterWeights([Number.MAX_VALUE, Number.MAX_VALUE])).toEqual({ ok: true, ratios: [0.5, 0.5] })
    expect(normalizeSplitterWeights([Number.MIN_VALUE, Number.MIN_VALUE])).toEqual({ ok: true, ratios: [0.5, 0.5] })
    expect(normalizeSplitterWeights([Number.MIN_VALUE, Number.MAX_VALUE])).toEqual({ ok: false, reason: 'precision' })
    const decimal = normalizeSplitterWeights([0.1, 0.2, 0.3])
    expect(decimal.ok).toBe(true)
    if (decimal.ok) {
      expect(decimal.ratios.reduce((sum, ratio) => sum + ratio, 0)).toBeCloseTo(1, 14)
      expect(decimal.ratios[0]).toBeCloseTo(1 / 6, 14)
    }
  })

  it('reopens existing allocations as equivalent weights and detects external ratio changes', () => {
    const outputs = [{ portId: 'a', ratio: 0.4 }, { portId: 'b', ratio: 0.6 }]
    expect(splitterWeightDrafts(outputs)).toEqual({ a: '40', b: '60' })
    expect(splitterAllocationKey(outputs)).toBe(splitterAllocationKey(outputs.map(output => ({ ...output }))))
    expect(splitterAllocationKey([{ ...outputs[0], ratio: 0.5 }, { ...outputs[1], ratio: 0.5 }])).not.toBe(splitterAllocationKey(outputs))
  })
})
