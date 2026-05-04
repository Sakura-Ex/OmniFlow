import type { Resource } from '../types/types'
import type { IMachineModifier } from './types'

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

type GtEnergyHatch = {
  tier: string
  amps: number
}

type GtMultiblockSummary = {
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

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function toGtHatches(value: unknown): GtEnergyHatch[] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => {
      const tier = typeof row?.tier === 'string' ? row.tier : 'HV'
      const amps = Math.max(0, toFiniteNumber(row?.amps, 1))
      return { tier, amps }
    })
    .filter((row) => row.amps > 0)
}

export function evaluateGtMultiblockState(uiState: Record<string, unknown>, baseEuPerTick = 0): GtMultiblockSummary {
  const hatches = toGtHatches(uiState.energyHatches)
  const parallelLimit = Math.max(1, Math.min(1048576, Math.floor(toFiniteNumber(uiState.parallelLimit, 4))))
  const perfectOverclock = Boolean(uiState.perfectOverclock)

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

  if (baseEuPerTick <= 0 || totalEuPerTick <= 0 || baseEuPerTick > totalEuPerTick) {
    return {
      totalEuPerTick,
      highestTier,
      parallelLimit,
      perfectOverclock,
      canStart: baseEuPerTick <= 0 || baseEuPerTick <= totalEuPerTick,
      actualParallel: baseEuPerTick <= 0 ? 1 : 0,
      actualOverclockCount: 0,
      finalEuPerTick: baseEuPerTick,
      finalDurationScale: 1,
    }
  }

  const recipeTier = recipeTierFromEu(baseEuPerTick)
  const recipeTierIndex = TIER_MAP[recipeTier]?.index ?? 0
  const maxTierIndex = TIER_MAP[highestTier]?.index ?? 0

  if (recipeTierIndex > maxTierIndex) {
    return {
      totalEuPerTick,
      highestTier,
      parallelLimit,
      perfectOverclock,
      canStart: false,
      actualParallel: 0,
      actualOverclockCount: 0,
      finalEuPerTick: baseEuPerTick,
      finalDurationScale: 1,
    }
  }

  const theoreticalParallel = Math.floor(totalEuPerTick / baseEuPerTick)
  const actualParallel = Math.min(theoreticalParallel, parallelLimit)
  let currentEu = baseEuPerTick * actualParallel

  let ocCount = 0
  let durationScale = 1
  while (currentEu * 4 <= totalEuPerTick) {
    currentEu *= 4
    durationScale /= perfectOverclock ? 4 : 2
    ocCount++
  }
  durationScale = Math.max(0.05 / 1, durationScale)

  return {
    totalEuPerTick,
    highestTier,
    parallelLimit,
    perfectOverclock,
    canStart: true,
    actualParallel,
    actualOverclockCount: ocCount,
    finalEuPerTick: currentEu,
    finalDurationScale: durationScale,
  }
}

export function resolveRecipePowerProfile(
  data: {
    metadata?: Record<string, unknown>
    active_modifiers?: string[]
    modifier_states?: Record<string, Record<string, unknown>>
    base_inputs?: Resource[]
  },
  transformedInputs?: Resource[]
): ResolvedPowerProfile {
  const metadataEu = Number(data.metadata?.eu_per_tick ?? 0)
  const utilityEu = Number(
    data.base_inputs?.find((resource) => resource.id === 'gt:eu' && resource.is_utility)?.amount ?? 0
  )
  const baseEuPerTick = utilityEu > 0 ? utilityEu : metadataEu

  const actualEuPerTick = transformedInputs
    ? Math.max(0, Number(
        transformedInputs.find((resource) => resource.id === 'gt:eu' && resource.is_utility)?.amount ?? baseEuPerTick
      ))
    : Math.max(0, baseEuPerTick)

  const hasGtMultiblock = Boolean(data.active_modifiers?.includes('gt_multiblock'))
  let highestTier = 'N/A'
  if (hasGtMultiblock) {
    const summary = evaluateGtMultiblockState(data.modifier_states?.gt_multiblock ?? {})
    highestTier = summary.highestTier
  }

  const hasPowerSetting = baseEuPerTick > 0 || hasGtMultiblock
  return {
    hasPowerSetting,
    baseEuPerTick,
    actualEuPerTick,
    highestTier,
  }
}

export const gtMultiblockModifier: IMachineModifier = {
  id: 'gt_multiblock',
  name: 'GT Multiblock Power Core',
  compatible_archetypes: ['gt_electric'],
  ui_schema: [
    {
      key: 'energyHatches',
      label: 'Energy Hatches',
      type: 'number',
      defaultValue: [{ tier: 'LV', amps: 1 }],
    },
    {
      key: 'parallelLimit',
      label: 'Parallel Limit',
      type: 'select',
      options: ['4', '16', '64', '256'],
      defaultValue: '4',
    },
    {
      key: 'perfectOverclock',
      label: 'Perfect Overclock',
      type: 'toggle',
      defaultValue: false,
    },
  ],
  evaluate: (baseInputs, _baseOutputs, _baseDuration, uiState) => {
    const baseEuInput = baseInputs.find((r) => r.id === 'gt:eu' && r.is_utility)
    const baseEuPerTick = baseEuInput ? baseEuInput.amount : 0

    const summary = evaluateGtMultiblockState(uiState, baseEuPerTick)

    if (!summary.canStart || summary.actualParallel === 0) {
      return { machineStopped: true }
    }

    return {
      parallelMultiplier: summary.actualParallel,
      durationMultiplier: summary.finalDurationScale,
      energyAmount: summary.finalEuPerTick,
    }
  },
}
