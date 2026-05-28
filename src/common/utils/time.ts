import { useSettingsStore } from '@/features/settings/settings.store'

/**
 * Convert a value from game ticks to seconds using the configured ticks-per-second (TPS).
 *
 * @param value - The tick value to convert. Returns `0` if `undefined` or non-finite.
 * @returns The equivalent duration in seconds.
 *
 * @example
 * ticksToSeconds(20)    // => 1.0  (assuming 20 TPS)
 * ticksToSeconds(undefined) // => 0
 */
export function ticksToSeconds(value: number | undefined): number {
  const ticks = Number(value)
  return Number.isFinite(ticks) ? ticks / useSettingsStore.getState().tps : 0
}

/**
 * Convert a value from seconds to game ticks using the configured ticks-per-second (TPS).
 *
 * @param value - The seconds value to convert. Returns `0` if `undefined` or non-finite.
 * @returns The equivalent duration in game ticks.
 *
 * @example
 * secondsToTicks(1)     // => 20  (assuming 20 TPS)
 * secondsToTicks(undefined) // => 0
 */
export function secondsToTicks(value: number | undefined): number {
  const seconds = Number(value)
  return Number.isFinite(seconds) ? seconds * useSettingsStore.getState().tps : 0
}
