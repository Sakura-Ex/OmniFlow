import type { ActiveModifier } from '@/common/types/recipe'
import type { Resource } from '@/common/types/resource'
import { computePowerPool, normalizeGtHatches } from './gtOverclocker'

/** Describes the resolved energy/power characteristics of a GregTech recipe. */
export type ResolvedPowerProfile = {
  /** Whether the recipe has an explicit power setting (either from metadata or utility energy). */
  hasPowerSetting: boolean
  /** The base EU-per-tick from the recipe definition (metadata or baseline utility input). */
  baseEuPerTick: number
  /** The actual EU-per-tick after modifier transformations. */
  actualEuPerTick: number
  /** The highest voltage tier available from the machine's overclocker configuration. */
  highestTier: string
}

/**
 * Resolve a recipe's power profile by inspecting its metadata, utility inputs, and overclocker modifier state.
 *
 * @param data - The recipe node data containing metadata, modifiers, inputs, and duration.
 * @param data.metadata - Recipe metadata (may contain `eu_per_tick`).
 * @param data.active_modifiers - Active modifier instances (used to detect overclocker).
 * @param data.base_inputs - Recipe base material inputs.
 * @param data.base_utility_inputs - Recipe base utility inputs (may contain energy).
 * @param data.base_duration_seconds - Base recipe duration in seconds.
 * @param transformedInputs - Optional post-modifier utility inputs for computing the actual EU/t.
 * @returns A {@link ResolvedPowerProfile} with base and actual EU/t plus the highest overclocker tier.
 */
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
