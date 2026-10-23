/** Stable JSON identity ignores object insertion order, preserving array order.
 * @param value - Serializable document content.
 * @returns Canonical document identity.
 */
export function documentKey(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
}

/** Track the exact document that was saved, independently from calculation state.
 * @param initial - Initial document baseline.
 * @returns Baseline comparison and successful-save acknowledgement.
 */
export function createSaveBaseline(initial: unknown) {
  let saved = documentKey(initial)
  return {
    isDirty: (current: unknown) => documentKey(current) !== saved,
    markSaved: (snapshot: unknown) => { saved = documentKey(snapshot) },
  }
}
