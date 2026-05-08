import type { TimeBase } from '../types/types'
import type { ResourceCategoryDef } from '../registry/types'

export function formatPortAmount(
  ratePerSec: number,
  catDef: ResourceCategoryDef,
  mMode?: TimeBase,
  durationSeconds?: number
) {
  const dur = typeof durationSeconds === 'number' && durationSeconds > 0 ? durationSeconds : 1
  const total = ratePerSec * dur
  const rounded = parseFloat(total.toPrecision(6))
  if (mMode === 'per_cycle') {
    return `x${rounded} ${catDef.base_unit}`
  }
  return `${rounded} ${catDef.base_unit}`
}

export function formatRateValue(value: number | undefined, mMode?: TimeBase): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  const displayValue = mMode === 'rate_per_tick' ? value / 20 : value
  const suffix = mMode === 'rate_per_tick' ? '/t' : '/s'
  const fixed = displayValue.toFixed(2)
  const trimmed = fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
  return `${trimmed}${suffix}`
}

export function formatSimpleRate(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0.00'
  const fixed = value.toFixed(2)
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
}
