/**
 * Generate a unique identifier string.
 *
 * Uses `crypto.randomUUID()` when available (modern browsers / Node 19+).
 * Falls back to a timestamp + random string in environments without crypto support.
 *
 * @returns A unique ID string.
 *
 * @example
 * generateId() // => "550e8400-e29b-41d4-a716-446655440000"
 * generateId() // => "k8f3a_7x9m2r"  (fallback format)
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 15)
  return `${timestamp}_${randomPart}`
}
