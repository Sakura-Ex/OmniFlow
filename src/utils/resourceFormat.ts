import type { TimeBase } from '../types/types'
import type { ResourceCategoryDef } from '../registry/types'
import { formatOpExRate, sanitizeFloat } from './formatters'
import { useSettingsStore } from '../stores/settingsStore'

export function formatPortAmount(
  ratePerSec: number,
  catDef: ResourceCategoryDef,
  mMode?: TimeBase,
  durationSeconds?: number
) {
  const dur = typeof durationSeconds === 'number' && durationSeconds > 0 ? durationSeconds : 1
  const total = sanitizeFloat(ratePerSec * dur)
  if (mMode === 'per_cycle') {
    return `x${formatOpExRate(total)} ${catDef.base_unit}`
  }
  return `${formatOpExRate(total)} ${catDef.base_unit}`
}

export function formatRateValue(value: number | undefined, mMode?: TimeBase): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  const displayValue = mMode === 'rate_per_tick' ? value / useSettingsStore.getState().tps : value
  const suffix = mMode === 'rate_per_tick' ? '/t' : '/s'
  return `${formatOpExRate(displayValue)}${suffix}`
}

export function formatSimpleRate(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0.00'
  return formatOpExRate(value)
}
