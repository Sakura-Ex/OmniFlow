import type { TimeBase } from '@/common/types/resource'
import type { ResourceCategoryDef } from '@/common/types/registry'
import { formatOpExRate, sanitizeFloat } from '@/common/utils/format'
import { useSettingsStore } from '@/features/settings/settings.store'

/**
 * Format a per-second rate into a human-readable port amount string.
 *
 * The output is scaled by the optional `durationSeconds` to produce a
 * per-cycle total when the time base is `'per_cycle'`.
 *
 * @param ratePerSec - The rate in units per second.
 * @param catDef - The resource category definition providing the base unit.
 * @param mMode - Optional time base mode. When `'per_cycle'`, the output is
 *                prefixed with `x` and shows the total per cycle.
 * @param durationSeconds - The cycle duration in seconds. Defaults to `1`.
 * @returns A formatted string such as `"64 mb"` or `"x2 iron_ingot"`.
 *
 * @example
 * formatPortAmount(64, { base_unit: 'mb' })           // => "64 mb"
 * formatPortAmount(2, { base_unit: 'ingot' }, 'per_cycle', 3) // => "x6 ingot"
 */
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

/**
 * Format a numeric rate value with a `/s` or `/t` suffix depending on the time base.
 *
 * When `mMode` is `'rate_per_tick'`, the value is divided by the configured TPS
 * before formatting and displayed with a `/t` suffix. Otherwise the value is shown
 * as-is with a `/s` suffix.
 *
 * @param value - The rate value to format. Returns an empty string if non-numeric.
 * @param mMode - Optional time base. `'rate_per_tick'` displays per-tick with `/t`.
 * @returns A formatted string such as `"32.00/s"` or `"1.60/t"`.
 *
 * @example
 * formatRateValue(32)        // => "32.00/s"
 * formatRateValue(32, 'rate_per_tick') // => "1.60/t"
 * formatRateValue(undefined) // => ""
 */
export function formatRateValue(value: number | undefined, mMode?: TimeBase): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  const displayValue = mMode === 'rate_per_tick' ? value / useSettingsStore.getState().tps : value
  const suffix = mMode === 'rate_per_tick' ? '/t' : '/s'
  return `${formatOpExRate(displayValue)}${suffix}`
}

/**
 * Format a simple numeric rate value using exponential notation formatting.
 *
 * @param value - The number to format. Returns `"0.00"` if non-finite.
 * @returns A formatted number string.
 *
 * @example
 * formatSimpleRate(1234.5) // => "1.23K"
 * formatSimpleRate(NaN)    // => "0.00"
 */
export function formatSimpleRate(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0.00'
  return formatOpExRate(value)
}
