import type { IMachineModifier, PipelineContext } from '../types'
import { OverclockerCardBody } from './gtOverclockerCard'
import { secondsToTicks, ticksToSeconds } from '../../utils/time'

export type GtVoltageTier = {
  id: string
  euPerAmp: number
}

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

function tierIndex(tierId: string): number {
  return GT_VOLTAGE_TIERS.findIndex((t) => t.id === tierId)
}

export type GtEnergyHatch = {
  tier: string
  amps: number
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function toGtHatches(value: unknown): GtEnergyHatch[] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => ({
      tier: typeof row?.tier === 'string' ? row.tier : 'HV',
      amps: Math.max(0, toFiniteNumber(row?.amps, 1)),
    }))
    .filter((row) => row.amps > 0)
}

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

type GtOverclockResult = {
  canStart: boolean
  actualOverclockCount: number
  finalEuPerTick: number
  finalDurationScale: number
  finalTicks: number
  finalDurationSeconds: number
  totalEuPerTick: number
  highestTier: string
}

/** 逐级检查功率与 ticks 约束，返回最大可行超频结果 */
export function evaluateGtOverclock(
  uiState: Record<string, unknown>,
  currentEuPerTick: number,
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

  if (currentEuPerTick <= 0 || totalEuPerTick <= 0) return noop(currentEuPerTick)

  if (tierIndex('ULV') < 0 /* tiers not loaded */) return noop(currentEuPerTick)

  const recipeTierIdx = tierIndex(
    GT_VOLTAGE_TIERS.find((t) => t.euPerAmp >= currentEuPerTick)?.id ?? ''
  )
  const maxTierIdx = tierIndex(highestTier)

  if (recipeTierIdx > maxTierIdx || currentEuPerTick > totalEuPerTick) return noop(currentEuPerTick)

  const perfect = Boolean(uiState.perfectOverclock)
  const timeDivisor = perfect ? 4 : 2
  let eu = currentEuPerTick
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
    if (baseEu <= 0) return { ...ctx }

    const result = evaluateGtOverclock(
      { ...uiState, energyHatches: ctx.hardwareSpecs.energyHatches },
      baseEu,
      ctx.durationSeconds
    )

    if (!result.canStart) {
      return { ...ctx, machineStopped: true, recipeOutputs: ctx.recipeOutputs.map((r) => ({ ...r, amount: 0 })) }
    }

    if (result.actualOverclockCount === 0) return { ...ctx }

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
