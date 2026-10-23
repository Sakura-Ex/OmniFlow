import { gtEuPerTick } from './gtUnits'
import type { IMachineModifier, PipelineContext } from '../../modifier.types'
import { GT_VOLTAGE_TIERS, computePowerPool, toGtHatches } from './gtPower'
import { UnitSystem } from '@/common/units/UnitSystem'
import { DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'

/**
 * Return the index of a voltage tier.
 * @param tierId - Voltage tier identifier.
 * @returns The tier index, or -1 when unknown.
 */
function tierIndex(tierId: string): number {
  return GT_VOLTAGE_TIERS.findIndex((tier) => tier.id === tierId)
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
 * @param units - Explicit unit system for the captured environment.
 */
export function evaluateGtOverclock(
  uiState: Record<string, unknown>,
  baseEuPerTick: number,
  workingEuPerTick: number,
  baseDurationSeconds: number,
  units: UnitSystem = new UnitSystem(DEFAULT_UNIT_SNAPSHOT)
): GtOverclockResult {
  const hatches = toGtHatches(uiState.energyHatches)
  const { totalEuPerTick, highestTier } = computePowerPool(hatches)

  const baseTicks = Math.max(1, Math.floor(units.secondsToTicks(baseDurationSeconds)))

  const noop = (eu: number): GtOverclockResult => ({
    canStart: false, actualOverclockCount: 0,
    finalEuPerTick: eu, finalDurationScale: 1,
    finalTicks: baseTicks, finalDurationSeconds: units.ticksToSeconds(baseTicks),
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
    finalTicks: ticks, finalDurationSeconds: units.ticksToSeconds(ticks),
    totalEuPerTick, highestTier,
  }
}

/**
 * GT Overclocker modifier plugin.
 *
 * Evaluates the overclocking pipeline: if the machine's energy pool is sufficient,
 * it quadruples EU/t and reduces duration accordingly. When the machine cannot start,
 * `machineStopped` is set while final port evidence remains available.
 */
export const gtOverclockerModifier: IMachineModifier = {
  apiVersion: 2,
  version: 2,
  id: 'gt_overclocker',
  after: ['gt_parallel'],
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
  evaluate: (ctx: PipelineContext, uiState: Record<string, unknown>) => {
    const baseEu = gtEuPerTick(ctx.baseline.utilityInputs, ctx.baseline.durationSeconds, ctx.units)
    const workingEu = gtEuPerTick(ctx.utilityInputs, ctx.durationSeconds, ctx.units)
    if (baseEu <= 0) return {}

    const result = evaluateGtOverclock(
      { ...uiState, energyHatches: ctx.hardwareSpecs.energyHatches },
      baseEu,
      workingEu,
      ctx.durationSeconds,
      ctx.units
    )

    if (!result.canStart) {
      return { machineStopped: true, reason: '供电不足，请提高能源仓电压或数量。' }
    }

    return {
      durationSeconds: result.finalDurationSeconds,
      utilityInputs: ctx.utilityInputs.map((r) =>
        r.utility_type === 'energy:gt_eu'
          ? { ...r, amount: ctx.units.fromRate(
            ctx.units.toRate(r.amount, r.unit ?? [{ baseUnitId: 'EU', exponent: 1 }], r.time_base ?? 'rate_per_tick', ctx.durationSeconds) * Math.pow(4, result.actualOverclockCount),
            r.unit ?? [{ baseUnitId: 'EU', exponent: 1 }], r.time_base ?? 'rate_per_tick', result.finalDurationSeconds
          ) }
          : { ...r }
      ),
    }
  },
}
