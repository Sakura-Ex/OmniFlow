import { UnitSystem } from '@/common/units/UnitSystem'

/**
 * Convert ticks using an explicit environment.
 * @returns Duration in seconds.
 * @param value - Numeric value to validate or convert.
 * @param units - Explicit unit system for the captured environment.
 */
export function ticksToSeconds(value: number, units: UnitSystem): number {
  return units.ticksToSeconds(value)
}

/**
 * Convert seconds using an explicit environment.
 * @returns Duration in ticks.
 * @param value - Numeric value to validate or convert.
 * @param units - Explicit unit system for the captured environment.
 */
export function secondsToTicks(value: number, units: UnitSystem): number {
  return units.secondsToTicks(value)
}
