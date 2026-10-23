import type { TimeBase } from '@/common/types/resource'
import type { UnitExpression } from '@/common/types/units'
import type { UnitSystem } from '@/common/units/UnitSystem'

/**
 * Build a human-readable unit suffix by appending a time-base indicator
 * (e.g. `/t` for per-tick, `/s` for per-second) to the base unit.
 * @param expression - Structured input or native rate unit expression.
 * @param time_base - Optional time base; if omitted the bare unit is returned.
 * @returns A unit string such as `EU/t` or `mB`.
 * @param units - Explicit unit system for the captured environment.
 */
export function buildUnitSuffix(expression: UnitExpression, time_base: TimeBase | undefined, units: UnitSystem): string {
  const base_unit = units.expression(expression).toString()
  if (units.isNativeRate(expression)) return base_unit
  switch (time_base) {
    case 'rate_per_tick': return `${base_unit}/t`
    case 'rate_per_sec':  return `${base_unit}/s`
    default:             return base_unit
  }
}
