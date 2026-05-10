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
  { id: 'UEV', euPerAmp: 8388608 },
  { id: 'UIV', euPerAmp: 33554432 },
  { id: 'UXV', euPerAmp: 134217728 },
  { id: 'OpV', euPerAmp: 536870912 },
  { id: 'MAX', euPerAmp: 2147483648 },
]

function tierIndex(tierId: string): number {
  return GT_VOLTAGE_TIERS.findIndex((t) => t.id === tierId)
}

function secondsToTicks(seconds: number): number {
  return Math.max(1, Math.floor(seconds * 20))
}

export type GtEnergyHatch = {
  tier: string
  amps: number
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

  const baseTicks = secondsToTicks(baseDurationSeconds)

  const noop = (eu: number): GtOverclockResult => ({
    canStart: false, actualOverclockCount: 0,
    finalEuPerTick: eu, finalDurationScale: 1,
    finalTicks: baseTicks, finalDurationSeconds: baseTicks / 20,
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
    finalTicks: ticks, finalDurationSeconds: ticks / 20,
    totalEuPerTick, highestTier,
  }
}

export function resolveRecipePowerProfile(
  data: {
    metadata?: Record<string, unknown>
    active_modifiers?: string[]
    modifier_states?: Record<string, Record<string, unknown>>
    base_inputs?: Resource[]
    base_utility_inputs?: Resource[]
    base_duration_seconds?: number
  },
  transformedInputs?: Resource[]
): ResolvedPowerProfile {
  const metadataEu = Number(data.metadata?.eu_per_tick ?? 0)
  const utilityEu = Number(
    data.base_utility_inputs?.find((r) => r.utility_type === 'energy:gt_eu')?.amount ?? 0
  )
  const baseEuPerTick = utilityEu > 0 ? utilityEu : metadataEu

  const actualEuPerTick = transformedInputs
    ? Math.max(0, Number(
        transformedInputs.find((r) => r.utility_type === 'energy:gt_eu' && r.is_utility)?.amount ?? baseEuPerTick
      ))
    : Math.max(0, baseEuPerTick)

  const hasOverclocker = Boolean(data.active_modifiers?.includes('gt_overclocker'))
  let highestTier = 'N/A'
  if (hasOverclocker) {
    const hatches = normalizeGtHatches(data.modifier_states?.gt_overclocker ?? {})
    highestTier = computePowerPool(hatches).highestTier
  }

  return { hasPowerSetting: baseEuPerTick > 0 || hasOverclocker, baseEuPerTick, actualEuPerTick, highestTier }
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

    const result = evaluateGtOverclock(
      { ...uiState, energyHatches: ctx.hardwareSpecs.energyHatches },
      currentEuPerTick,
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