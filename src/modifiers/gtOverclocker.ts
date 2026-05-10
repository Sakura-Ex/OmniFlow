import type { Resource } from '../types/types'
import type { IMachineModifier, PipelineContext } from './types'
import { OverclockerCardBody } from './gtOverclockerCard'

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
]

export const TIER_MAP: Record<string, { index: number; voltage: number }> = {
  ULV:  { index: 0, voltage: 8 },
  LV:   { index: 1, voltage: 32 },
  MV:   { index: 2, voltage: 128 },
  HV:   { index: 3, voltage: 512 },
  EV:   { index: 4, voltage: 2048 },
  IV:   { index: 5, voltage: 8192 },
  LuV:  { index: 6, voltage: 32768 },
  ZPM:  { index: 7, voltage: 131072 },
  UV:   { index: 8, voltage: 524288 },
  UHV:  { index: 9, voltage: 2097152 },
}

function recipeTierFromEu(euPerTick: number): string {
  if (euPerTick <= 0) return GT_VOLTAGE_TIERS[0]?.id ?? 'ULV'
  const sorted = GT_VOLTAGE_TIERS.slice().sort((a, b) => a.euPerAmp - b.euPerAmp)
  for (let i = 0; i < sorted.length; i++) {
    if (euPerTick <= sorted[i].euPerAmp) {
      return sorted[i].id
    }
  }
  return sorted[sorted.length - 1].id
}

export type GtEnergyHatch = {
  tier: string
  amps: number
}

type GtOverclockerSummary = {
  totalEuPerTick: number
  highestTier: string
  parallelLimit: number
  perfectOverclock: boolean
  canStart: boolean
  actualParallel: number
  actualOverclockCount: number
  finalEuPerTick: number
  finalDurationScale: number
}

export type ResolvedPowerProfile = {
  hasPowerSetting: boolean
  baseEuPerTick: number
  actualEuPerTick: number
  highestTier: string
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function toGtHatches(value: unknown): GtEnergyHatch[] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => {
      const tier = typeof row?.tier === 'string' ? row.tier : 'HV'
      const amps = Math.max(0, toFiniteNumber(row?.amps, 1))
      return { tier, amps }
    })
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

export function evaluateGtParallel(
  uiState: Record<string, unknown>,
  baseEuPerTick: number
): { canStart: boolean; actualParallel: number; totalEuPerTick: number; highestTier: string } {
  const hatches = toGtHatches(uiState.energyHatches)
  const { totalEuPerTick, highestTier } = computePowerPool(hatches)

  if (baseEuPerTick <= 0 || totalEuPerTick <= 0) {
    return { canStart: false, actualParallel: 0, totalEuPerTick, highestTier }
  }

  const parallelLimit = Math.max(1, Math.min(1048576, Math.floor(toFiniteNumber(uiState.parallelLimit, 4))))
  const theoreticalParallel = Math.floor(totalEuPerTick / baseEuPerTick)
  const actualParallel = Math.min(theoreticalParallel, parallelLimit)

  if (actualParallel <= 0) {
    return { canStart: false, actualParallel: 0, totalEuPerTick, highestTier }
  }

  return { canStart: true, actualParallel, totalEuPerTick, highestTier }
}

export function evaluateGtOverclock(
  uiState: Record<string, unknown>,
  currentEuPerTick: number
): { canStart: boolean; actualOverclockCount: number; finalEuPerTick: number; finalDurationScale: number; totalEuPerTick: number; highestTier: string } {
  const hatches = toGtHatches(uiState.energyHatches)
  const { totalEuPerTick, highestTier } = computePowerPool(hatches)

  if (currentEuPerTick <= 0 || totalEuPerTick <= 0) {
    return { canStart: false, actualOverclockCount: 0, finalEuPerTick: currentEuPerTick, finalDurationScale: 1, totalEuPerTick, highestTier }
  }

  const recipeTier = recipeTierFromEu(currentEuPerTick)
  const recipeTierIndex = TIER_MAP[recipeTier]?.index ?? 0
  const maxTierIndex = TIER_MAP[highestTier]?.index ?? 0

  if (recipeTierIndex > maxTierIndex || currentEuPerTick > totalEuPerTick) {
    return { canStart: false, actualOverclockCount: 0, finalEuPerTick: currentEuPerTick, finalDurationScale: 1, totalEuPerTick, highestTier }
  }

  const perfectOverclock = Boolean(uiState.perfectOverclock)
  let currentEu = currentEuPerTick
  let ocCount = 0
  let durationScale = 1

  while (currentEu * 4 <= totalEuPerTick) {
    currentEu *= 4
    durationScale /= perfectOverclock ? 4 : 2
    ocCount++
  }
  durationScale = Math.max(0.05, durationScale)

  return { canStart: true, actualOverclockCount: ocCount, finalEuPerTick: currentEu, finalDurationScale: durationScale, totalEuPerTick, highestTier }
}

export function evaluateGtOverclockerState(uiState: Record<string, unknown>, baseEuPerTick = 0): GtOverclockerSummary {
  const parallelResult = evaluateGtParallel(uiState, baseEuPerTick)

  if (!parallelResult.canStart) {
    return {
      totalEuPerTick: parallelResult.totalEuPerTick,
      highestTier: parallelResult.highestTier,
      parallelLimit: Math.max(1, Math.floor(toFiniteNumber(uiState.parallelLimit, 4))),
      perfectOverclock: Boolean(uiState.perfectOverclock),
      canStart: false,
      actualParallel: 0,
      actualOverclockCount: 0,
      finalEuPerTick: baseEuPerTick,
      finalDurationScale: 1,
    }
  }

  const currentEuAfterParallel = baseEuPerTick * parallelResult.actualParallel
  const ocResult = evaluateGtOverclock(uiState, currentEuAfterParallel)

  return {
    totalEuPerTick: parallelResult.totalEuPerTick,
    highestTier: parallelResult.highestTier,
    parallelLimit: Math.max(1, Math.floor(toFiniteNumber(uiState.parallelLimit, 4))),
    perfectOverclock: Boolean(uiState.perfectOverclock),
    canStart: ocResult.canStart,
    actualParallel: parallelResult.actualParallel,
    actualOverclockCount: ocResult.actualOverclockCount,
    finalEuPerTick: ocResult.finalEuPerTick,
    finalDurationScale: ocResult.finalDurationScale,
  }
}

export function resolveRecipePowerProfile(
  data: {
    metadata?: Record<string, unknown>
    active_modifiers?: string[]
    modifier_states?: Record<string, Record<string, unknown>>
    base_inputs?: Resource[]
    base_utility_inputs?: Resource[]
  },
  transformedInputs?: Resource[]
): ResolvedPowerProfile {
  const metadataEu = Number(data.metadata?.eu_per_tick ?? 0)
  const utilityEu = Number(
    data.base_utility_inputs?.find((resource) => resource.utility_type === 'energy:gt_eu')?.amount ?? 0
  )
  const baseEuPerTick = utilityEu > 0 ? utilityEu : metadataEu

  const actualEuPerTick = transformedInputs
    ? Math.max(0, Number(
        transformedInputs.find((resource) => resource.utility_type === 'energy:gt_eu' && resource.is_utility)?.amount ?? baseEuPerTick
      ))
    : Math.max(0, baseEuPerTick)

  const hasOverclocker = Boolean(data.active_modifiers?.includes('gt_overclocker'))
  let highestTier = 'N/A'
  if (hasOverclocker) {
    const summary = evaluateGtOverclockerState(data.modifier_states?.gt_overclocker ?? {})
    highestTier = summary.highestTier
  }

  const hasPowerSetting = baseEuPerTick > 0 || hasOverclocker
  return {
    hasPowerSetting,
    baseEuPerTick,
    actualEuPerTick,
    highestTier,
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
    const euInput = ctx.utilityInputs.find((r) => r.utility_type === 'energy:gt_eu')
    const currentEuPerTick = euInput ? euInput.amount : 0

    if (currentEuPerTick <= 0) return { ...ctx }

    const result = evaluateGtOverclock({ ...uiState, energyHatches: ctx.hardwareSpecs.energyHatches }, currentEuPerTick)

    if (!result.canStart) {
      return { ...ctx, machineStopped: true, recipeOutputs: ctx.recipeOutputs.map((r) => ({ ...r, amount: 0 })) }
    }

    if (result.actualOverclockCount === 0) {
      return { ...ctx }
    }

    const ocPowerMultiplier = Math.pow(4, result.actualOverclockCount)

    return {
      ...ctx,
      durationSeconds: ctx.durationSeconds * result.finalDurationScale,
      utilityInputs: ctx.utilityInputs.map((r) =>
        r.utility_type === 'energy:gt_eu'
          ? { ...r, amount: r.amount * ocPowerMultiplier }
          : { ...r }
      ),
    }
  },
}
