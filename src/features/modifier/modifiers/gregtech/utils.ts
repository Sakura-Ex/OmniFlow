import { gtEuPerTick } from './gtUnits'
import type { UnitSystem } from '@/common/units/UnitSystem'
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
 * @param data.hardware_specs - Installed hardware configuration used by the capacity preview.
 * @param transformedInputs - Optional post-modifier utility inputs for computing the actual EU/t.
 * @returns A {@link ResolvedPowerProfile} with base and actual EU/t plus the highest overclocker tier.
 * @param units - Explicit unit system for the captured environment.
 */
export function resolveRecipePowerProfile(
  data: {
    hardware_specs?: Record<string, unknown>
    metadata?: Record<string, unknown>
    active_modifiers?: ActiveModifier[]
    base_inputs?: Resource[]
    base_utility_inputs?: Resource[]
    base_duration_seconds?: number
  },
  transformedInputs: Resource[] | undefined,
  units: UnitSystem
): ResolvedPowerProfile {
  const metadataEu = Number(data.metadata?.eu_per_tick ?? 0)
  const utilityEu = gtEuPerTick(data.base_utility_inputs ?? [], data.base_duration_seconds ?? 1, units)
  const baseEuPerTick = utilityEu > 0 ? utilityEu : metadataEu

  const actualEuPerTick = transformedInputs
    ? units.fromRate(transformedInputs.find((r) => r.utility_type === 'energy:gt_eu' && r.is_utility)?.amount ?? baseEuPerTick * units.snapshot.ticksPerSecond, units.unit('EU').expression, 'rate_per_tick')
    : Math.max(0, baseEuPerTick)

  const ocInstance = data.active_modifiers?.find((m) => m.definition_id === 'gt_overclocker')
  const hasOverclocker = Boolean(ocInstance)
  let highestTier = 'N/A'
  if (ocInstance) {
    const hatches = normalizeGtHatches({ energyHatches: data.hardware_specs?.energyHatches ?? ocInstance.uiState.energyHatches })
    highestTier = computePowerPool(hatches).highestTier
  }

  return { hasPowerSetting: baseEuPerTick > 0 || hasOverclocker, baseEuPerTick, actualEuPerTick, highestTier }
}
