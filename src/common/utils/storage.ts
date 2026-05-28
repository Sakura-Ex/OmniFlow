/**
 * Load a JSON-serialized value from `localStorage`.
 *
 * @param key - The storage key to read from.
 * @param fallback - The default value returned if the key is missing or parsing fails.
 * @returns The deserialized value, or `fallback` on error / missing data.
 *
 * @example
 * const theme = loadFromStorage('theme', 'light')
 * const config = loadFromStorage<MyConfig>('config', defaultConfig)
 */
export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/**
 * Save a value as JSON to `localStorage`.
 *
 * @param key - The storage key to write to.
 * @param data - The data to serialize and store.
 *
 * @example
 * saveToStorage('theme', 'dark')
 * saveToStorage('config', { volume: 0.8 })
 */
export function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    return
  }
}
