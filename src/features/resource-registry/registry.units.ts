import type { TimeBase } from '@/common/types/resource'

/**
 * Build a human-readable unit suffix by appending a time-base indicator
 * (e.g. `/t` for per-tick, `/s` for per-second) to the base unit.
 * @param base_unit - The base unit string (e.g. `EU`, `mB`).
 * @param time_base - Optional time base; if omitted the bare unit is returned.
 * @returns A unit string such as `EU/t` or `mB`.
 */
export function buildUnitSuffix(base_unit: string, time_base?: TimeBase): string {
  switch (time_base) {
    case 'rate_per_tick': return `${base_unit}/t`
    case 'rate_per_sec':  return `${base_unit}/s`
    default:             return base_unit
  }
}
