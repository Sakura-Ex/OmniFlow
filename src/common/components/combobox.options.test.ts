import { describe, expect, it } from 'vitest'
import { filterComboboxOptions, nextComboboxOption } from './combobox.options'

const options = [{ value: 'gt_eu', label: '格雷电力' }, { value: 'rf', label: 'RF Energy', disabled: true }, { value: 'steam', label: 'Steam' }]

describe('combobox candidate selection', () => {
  it('searches both visible labels and identifiers without changing enum values', () => {
    expect(filterComboboxOptions(options, ' 格雷 ')).toEqual([options[0]])
    expect(filterComboboxOptions(options, 'GT_EU')).toEqual([options[0]])
    expect(filterComboboxOptions(options, 'energy')).toEqual([options[1]])
    expect(filterComboboxOptions(options, 'unknown')).toEqual([])
    expect(options[0].value).toBe('gt_eu')
  })
  it('wraps arrow navigation and skips disabled candidates', () => {
    expect(nextComboboxOption(options, -1, 1)).toBe(0)
    expect(nextComboboxOption(options, 0, 1)).toBe(2)
    expect(nextComboboxOption(options, 2, 1)).toBe(0)
    expect(nextComboboxOption(options, -1, -1)).toBe(2)
    expect(nextComboboxOption(options, 2, -1)).toBe(0)
  })
  it('cannot select a disabled or nonexistent candidate', () => {
    expect(nextComboboxOption([], -1, 1)).toBe(-1)
    expect(nextComboboxOption([{ value: 'x', label: 'X', disabled: true }], -1, 1)).toBe(-1)
  })
})
