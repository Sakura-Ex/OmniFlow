/** UI weight validation preserves the normalized-ratio document contract. */
export type NormalizedSplitterWeights = { ok: true; ratios: number[] } | { ok: false; reason: 'invalid' | 'zero' | 'precision' }

/** Normalize arbitrary nonnegative branch weights without overflowing their sum.
 * @param weights - User-entered relative weights, such as 2 and 3.
 * @returns Existing schema-compatible ratios, or a reason to keep the draft unapplied.
 */
export function normalizeSplitterWeights(weights: readonly number[]): NormalizedSplitterWeights {
  if (!weights.length || weights.some(weight => !Number.isFinite(weight) || weight < 0)) return { ok: false, reason: 'invalid' }
  const maximum = Math.max(...weights)
  if (maximum === 0) return { ok: false, reason: 'zero' }
  const sum = weights.reduce((total, weight) => total + weight, 0)
  const scaled = Number.isFinite(sum) ? weights : weights.map(weight => weight / maximum)
  const total = Number.isFinite(sum) ? sum : scaled.reduce((value, weight) => value + weight, 0)
  const ratios = scaled.map(weight => weight / total)
  if (ratios.some((ratio, index) => ratio === 0 && weights[index] > 0)) return { ok: false, reason: 'precision' }
  return { ok: true, ratios }
}

/** Use saved ratios as equivalent editable weights without inventing persisted display metadata.
 * @param outputs - Saved branch identities and normalized ratios.
 * @returns Decimal weight drafts; weights need not sum to any prescribed value.
 */
export function splitterWeightDrafts(outputs: readonly { portId: string; ratio: number }[]): Record<string, string> {
  return Object.fromEntries(outputs.map(output => [output.portId, String(output.ratio * 100)]))
}

/** Associate session display weights with the committed branch allocation, excluding result updates.
 * @param outputs - Committed identities and normalized allocation.
 * @returns Stable identity for retaining a user's equivalent 2:3 representation after saving.
 */
export function splitterAllocationKey(outputs: readonly { portId: string; ratio: number }[]): string {
  return JSON.stringify(outputs.map(output => [output.portId, output.ratio]))
}
