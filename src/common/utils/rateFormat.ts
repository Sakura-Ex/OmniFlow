import type { UnitExpression } from '@/common/types/units'
import { legacyUnit } from '@/common/units/defaults'
import type { TimeBase } from '@/common/types/resource'
import type { ResourceCategoryDef } from '@/common/types/registry'
import { formatOpExRate } from '@/common/utils/format'
import { UnitSystem } from '@/common/units/UnitSystem'

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
 * @param units - Explicit unit system for the captured environment.
 * @param expression - Structured unit factors.
 */
export function formatPortAmount(
  ratePerSec: number,
  catDef: ResourceCategoryDef,
  mMode: TimeBase | undefined,
  durationSeconds: number,
  units: UnitSystem,
  expression?: UnitExpression
) {
  const unit = expression ?? legacyUnit(catDef.base_unit)
  const total = units.fromRate(ratePerSec, unit, mMode ?? 'rate_per_sec', durationSeconds)
  const label = units.expression(unit).toString()
  if (mMode === 'per_cycle' && !units.isNativeRate(unit)) {
    return `x${formatOpExRate(total)} ${label}`
  }
  return `${formatOpExRate(total)} ${label}`
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
 * @param units - Explicit unit system for the captured environment.
 * @param expression - Structured unit factors.
 */
export function formatRateValue(value: number | undefined, mMode: TimeBase | undefined, units: UnitSystem, expression?: UnitExpression): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  const displayValue = expression ? units.fromRate(value, expression, mMode === 'rate_per_tick' ? mMode : 'rate_per_sec') : mMode === 'rate_per_tick' ? value * units.ticksToSeconds(1) : value
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
