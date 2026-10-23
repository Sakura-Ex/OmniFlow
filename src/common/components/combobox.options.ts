/** One searchable candidate with a stable submitted value. */
export interface ComboboxOption { value: string; label: string; disabled?: boolean }

/**
 * Match the visible label or identifier while preserving caller order.
 * @param options - Available candidates.
 * @param query - User search text.
 * @returns Matching candidates, including disabled entries for explanation.
 */
export function filterComboboxOptions(options: readonly ComboboxOption[], query: string): ComboboxOption[] {
  const normalized = query.trim().toLocaleLowerCase()
  return options.filter(option => !normalized || option.label.toLocaleLowerCase().includes(normalized) || option.value.toLocaleLowerCase().includes(normalized))
}

/**
 * Move to an enabled candidate, wrapping around and skipping disabled entries.
 * @param options - Currently visible candidates.
 * @param current - Active candidate index, or -1.
 * @param direction - Forward or backward navigation.
 * @returns The next enabled index, or -1 when none can be selected.
 */
export function nextComboboxOption(options: readonly ComboboxOption[], current: number, direction: 1 | -1): number {
  if (!options.some(option => !option.disabled)) return -1
  let index = current < 0 ? (direction === 1 ? -1 : 0) : current
  for (let count = 0; count < options.length; count++) {
    index = (index + direction + options.length) % options.length
    if (!options[index].disabled) return index
  }
  return -1
}
