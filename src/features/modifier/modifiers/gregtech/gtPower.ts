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
