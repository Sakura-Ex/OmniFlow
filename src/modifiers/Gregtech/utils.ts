import type { ActiveModifier } from '../../types/recipe'
import type { Resource } from '../../types/types'
import { computePowerPool, normalizeGtHatches } from './gtOverclocker'

export type ResolvedPowerProfile = {
  hasPowerSetting: boolean
  baseEuPerTick: number
  actualEuPerTick: number
  highestTier: string
}

export function resolveRecipePowerProfile(
  data: {
    metadata?: Record<string, unknown>
    active_modifiers?: ActiveModifier[]
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

  const ocInstance = data.active_modifiers?.find((m) => m.definition_id === 'gt_overclocker')
  const hasOverclocker = Boolean(ocInstance)
  let highestTier = 'N/A'
  if (ocInstance) {
    const hatches = normalizeGtHatches(ocInstance.uiState)
    highestTier = computePowerPool(hatches).highestTier
  }

  return { hasPowerSetting: baseEuPerTick > 0 || hasOverclocker, baseEuPerTick, actualEuPerTick, highestTier }
}
