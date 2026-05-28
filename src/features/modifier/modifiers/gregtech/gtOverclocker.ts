import type { IMachineModifier, PipelineContext } from '../../modifier.types'
import { OverclockerCardBody } from './gtOverclockerCard'
import { secondsToTicks, ticksToSeconds } from '@/common/utils/time'

/** Represents a single GregTech voltage tier with its EU-per-amp rating. */
export type GtVoltageTier = {
  /** Tier identifier (e.g. `"LV"`, `"HV"`, `"EV"`). */
  id: string
  /** Energy units (EU) per ampere for this tier. */
  euPerAmp: number
}

/**
 * Ordered array of all GregTech voltage tiers from lowest (ULV) to highest (MAX).
 *
 * Each entry maps a tier ID to its base EU-per-amp value.
 */
export const GT_VOLTAGE_TIERS: GtVoltageTier[] = [
  { id: 'ULV', euPerAmp: 8 },
  { id: 'LV', euPerAmp: 32 },
  { id: 'MV', euPerAmp: 128 },
  { id: 'HV', euPerAmp: 512 },
  { id: 'EV', euPerAmp: 2048 },
  { id: 'IV', euPerAmp: 8192 },
  { id: 'LuV', euPerAmp: 32768 },
  { id: 'ZPM', euPerAmp: 131072 },
  { id: 'UV', euPerAmp: 524288 },
  { id: 'UHV', euPerAmp: 2097152 },
  { id: 'UEV', euPerAmp: 8388608 },
  { id: 'UIV', euPerAmp: 33554432 },
  { id: 'UXV', euPerAmp: 134217728 },
  { id: 'OpV', euPerAmp: 536870912 },
  { id: 'MAX', euPerAmp: 2147483648 },
]

/**
 * Return the array index of a given voltage tier ID.
 * @param tierId - The voltage tier identifier (e.g. `"HV"`).
 * @returns The index in the GT_VOLTAGE_TIERS array, or `-1` if not found.
 */
function tierIndex(tierId: string): number {
  return GT_VOLTAGE_TIERS.findIndex((t) => t.id === tierId)
}

/** Describes a single energy hatch on a GregTech machine: its voltage tier and amp capacity. */
export type GtEnergyHatch = {
  /** Voltage tier identifier (e.g. `"HV"`, `"EV"`). */
  tier: string
  /** Number of amps this hatch can source or sink. */
  amps: number
}

/**
 * Safely coerce a value to a finite number, falling back to a default if the result is non-finite.
 *
 * @param value - The value to convert.
 * @param fallback - The fallback number returned when `value` is not finite. Defaults to `0`.
 * @returns A finite number.
 */
export function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Parse an unknown value into an array of {@link GtEnergyHatch} objects.
 *
 * Filters out entries with zero amps. Returns an empty array for non-array input.
 *
 * @param value - The raw value (expected to be an array of hatch-like objects).
 * @returns An array of validated {@link GtEnergyHatch} instances.
 */
export function toGtHatches(value: unknown): GtEnergyHatch[] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => ({
      tier: typeof row?.tier === 'string' ? row.tier : 'HV',
      amps: Math.max(0, toFiniteNumber(row?.amps, 1)),
    }))
    .filter((row) => row.amps > 0)
}

/**
 * Extract and normalise energy hatch data from a modifier's UI state.
 *
 * Returns a fallback single `LV` / 1‑amp hatch if the state contains no hatches or all entries are invalid.
 *
 * @param state - The modifier UI state object containing an `energyHatches` array.
 * @returns An array of normalised {@link GtEnergyHatch} instances (always at least one entry).
 */
export function normalizeGtHatches(state: Record<string, unknown>): GtEnergyHatch[] {
  if (!Array.isArray(state.energyHatches)) return [{ tier: 'LV', amps: 1 }]
  const rows = (state.energyHatches as Array<Record<string, unknown>>)
    .map((row: Record<string, unknown>) => ({
      tier: typeof row?.tier === 'string' ? row.tier : 'LV',
      amps: toFiniteNumber(row?.amps, 0),
    }))
    .filter((row) => row.amps > 0)
  return rows.length > 0 ? rows : [{ tier: 'LV', amps: 1 }]
}

/**
 * Compute total energy capacity and the highest available voltage tier from a set of energy hatches.
 *
 * @param hatches - The energy hatches installed on the machine.
 * @returns An object with `totalEuPerTick` (sum of all hatches' EU/t) and `highestTier` (the tier ID with the greatest EU/amp).
 */
export function computePowerPool(hatches: GtEnergyHatch[]): { totalEuPerTick: number; highestTier: string } {
  let totalEuPerTick = 0
  let highestTier = 'N/A'
  let highestTierEu = -1

  for (const hatch of hatches) {
    const tier = GT_VOLTAGE_TIERS.find((item) => item.id === hatch.tier)
    if (!tier) continue
    totalEuPerTick += tier.euPerAmp * hatch.amps
    if (tier.euPerAmp > highestTierEu) {
      highestTierEu = tier.euPerAmp
      highestTier = tier.id
    }
  }

  return { totalEuPerTick, highestTier }
}

/** Result of evaluating the GregTech overclocking algorithm. */
type GtOverclockResult = {
  /** Whether the machine has sufficient power to start. */
  canStart: boolean
  /** Number of overclock tiers actually applied. */
  actualOverclockCount: number
  /** Final EU-per-tick after overclocking. */
  finalEuPerTick: number
  /** Scale factor applied to duration (1 / 2^oc or 1 / 4^oc). */
  finalDurationScale: number
  /** Final recipe duration in ticks. */
  finalTicks: number
  /** Final recipe duration in seconds. */
  finalDurationSeconds: number
  /** Total available EU-per-tick from the machine's energy pool. */
  totalEuPerTick: number
  /** Highest voltage tier available. */
  highestTier: string
}

/**
 * Evaluate the GregTech overclocking logic and compute the final energy and duration.
 *
 * The algorithm determines how many overclock tiers are possible given the machine's
 * available energy pool. Each overclock tier quadruples EU/t and halves (or quarter-s with
 * perfect overclock) the recipe duration.
 *
 * The overclocking loop stops when the next tier would exceed the available EU pool or
 * would reduce ticks below 1.
 *
 * @example
 * ```ts
 * const result = evaluateGtOverclock(
 *   { energyHatches: [{ tier: 'HV', amps: 2 }], perfectOverclock: false },
 *   128,    // baseEuPerTick (MV)
 *   128,    // workingEuPerTick
 *   10      // baseDurationSeconds
 * )
 * // result.canStart → true
 * // result.actualOverclockCount → 1  (MV → HV)
 * // result.finalEuPerTick → 512     (128 * 4)
 * // result.finalDurationSeconds → 5 (10 / 2)
 * ```
 *
 * @param uiState - The overclocker modifier UI state, expected to contain `energyHatches` and `perfectOverclock`.
 * @param baseEuPerTick - The recipe's baseline EU-per-tick consumption.
 * @param workingEuPerTick - The current EU-per-tick after prior modifiers.
 * @param baseDurationSeconds - The recipe's baseline duration in seconds.
 * @returns A {@link GtOverclockResult} describing whether the machine can start, the overclock count, and the final values.
 */
export function evaluateGtOverclock(
  uiState: Record<string, unknown>,
  baseEuPerTick: number,
  workingEuPerTick: number,
  baseDurationSeconds: number
): GtOverclockResult {
  const hatches = toGtHatches(uiState.energyHatches)
  const { totalEuPerTick, highestTier } = computePowerPool(hatches)

  const baseTicks = Math.max(1, Math.floor(secondsToTicks(baseDurationSeconds)))

  const noop = (eu: number): GtOverclockResult => ({
    canStart: false, actualOverclockCount: 0,
    finalEuPerTick: eu, finalDurationScale: 1,
    finalTicks: baseTicks, finalDurationSeconds: ticksToSeconds(baseTicks),
    totalEuPerTick, highestTier,
  })

  if (workingEuPerTick <= 0 || totalEuPerTick <= 0) return noop(workingEuPerTick)

  if (tierIndex('ULV') < 0) return noop(workingEuPerTick)

  const recipeTierIdx = tierIndex(
    GT_VOLTAGE_TIERS.find((t) => t.euPerAmp >= baseEuPerTick)?.id ?? ''
  )
  const maxTierIdx = tierIndex(highestTier)

  if (recipeTierIdx > maxTierIdx || workingEuPerTick > totalEuPerTick) return noop(workingEuPerTick)

  const perfect = Boolean(uiState.perfectOverclock)
  const timeDivisor = perfect ? 4 : 2
  let eu = workingEuPerTick
  let ticks = baseTicks
  let oc = 0

  while (eu * 4 <= totalEuPerTick) {
    const nextTicks = Math.floor(baseTicks / Math.pow(timeDivisor, oc + 1))
    if (nextTicks < 1) break
    eu *= 4
    ticks = nextTicks
    oc++
  }

  return {
    canStart: true, actualOverclockCount: oc,
    finalEuPerTick: eu, finalDurationScale: oc === 0 ? 1 : 1 / Math.pow(timeDivisor, oc),
    finalTicks: ticks, finalDurationSeconds: ticksToSeconds(ticks),
    totalEuPerTick, highestTier,
  }
}

/**
 * GT Overclocker modifier plugin.
 *
 * Evaluates the overclocking pipeline: if the machine's energy pool is sufficient,
 * it quadruples EU/t and reduces duration accordingly. When the machine cannot start,
 * all recipe outputs are zeroed and `machineStopped` is set to `true`.
 */
export const gtOverclockerModifier: IMachineModifier = {
  id: 'gt_overclocker',
  name: 'GT Overclocker',
  compatible_archetypes: ['gt_electric'],
  ui_schema: [
    {
      key: 'perfectOverclock',
      label: 'Perfect Overclock',
      type: 'toggle',
      defaultValue: false,
    },
  ],
  renderBody: OverclockerCardBody,
  evaluate: (ctx: PipelineContext, uiState: Record<string, unknown>) => {
    const baseEu = ctx.baseline.utilityInputs.find((r) => r.utility_type === 'energy:gt_eu')?.amount ?? 0
    const workingEu = ctx.utilityInputs.find((r) => r.utility_type === 'energy:gt_eu')?.amount ?? 0
    if (baseEu <= 0) return { ...ctx }

    const result = evaluateGtOverclock(
      { ...uiState, energyHatches: ctx.hardwareSpecs.energyHatches },
      baseEu,
      workingEu,
      ctx.durationSeconds
    )

    if (!result.canStart) {
      return { ...ctx, machineStopped: true, recipeOutputs: ctx.recipeOutputs.map((r) => ({ ...r, amount: 0 })) }
    }

    if (result.actualOverclockCount === 0) return {
      ...ctx,
      durationSeconds: result.finalDurationSeconds,
    }

    return {
      ...ctx,
      durationSeconds: result.finalDurationSeconds,
      utilityInputs: ctx.utilityInputs.map((r) =>
        r.utility_type === 'energy:gt_eu'
          ? { ...r, amount: r.amount * Math.pow(4, result.actualOverclockCount) }
          : { ...r }
      ),
    }
  },
}
