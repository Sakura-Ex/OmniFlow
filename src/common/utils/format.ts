/**
 * Sanitize floating-point numbers to avoid precision errors.
 * 
 * Rounds numbers that are very close to an integer value to avoid
 * floating-point representation artifacts (e.g., 2.999999999 -> 3).
 * 
 * @param num - The number to sanitize
 * @param epsilon - Tolerance threshold for rounding (default: 1e-6)
 * @returns The sanitized number (integer if close, original otherwise)
 * 
 * @example
 * ```typescript
 * sanitizeFloat(2.9999999) // returns 3
 * sanitizeFloat(2.5) // returns 2.5
 * ```
 */
export function sanitizeFloat(num: number, epsilon = 1e-6): number {
  const rounded = Math.round(num)
  return Math.abs(num - rounded) < epsilon ? rounded : num
}

/**
 * Format a number with space-separated thousands.
 * 
 * Internal utility function that applies number formatting and replaces
 * commas with thin space characters (U+202F) for better readability.
 * 
 * @param num - The number to format
 * @param maxDecimals - Maximum number of decimal places to show
 * @returns Formatted string with space separators
 */
function formatWithSpaceSeparator(num: number, maxDecimals: number): string {
  const cleanNum = sanitizeFloat(num)
  const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: maxDecimals }).format(cleanNum)
  return formatted.replace(/,/g, '\u202F')
}

/**
 * Format machine count with 2 decimal places.
 * 
 * Used for displaying exact machine rates in the UI with proper
 * thousand separators.
 * 
 * @param num - Machine count to format
 * @returns Formatted string (e.g., "10.00", "1000.50")
 * 
 * @example
 * ```typescript
 * formatMachineExact(10) // "10"
 * formatMachineExact(10.5) // "10.5"
 * formatMachineExact(1000.25) // "1000.25"
 * ```
 */
export function formatMachineExact(num: number): string {
  return formatWithSpaceSeparator(num, 2)
}

/**
 * Format capital expenditure (CapEx) value.
 * 
 * Rounds up to the nearest integer and formats with space separators.
 * Used for displaying machine costs and infrastructure expenses.
 * 
 * @param num - CapEx value to format
 * @returns Formatted integer string (e.g., "1000", "50000")
 * 
 * @example
 * ```typescript
 * formatCapEx(1000) // "1000"
 * formatCapEx(999.1) // "1000" (ceiling)
 * ```
 */
export function formatCapEx(num: number): string {
  return formatWithSpaceSeparator(Math.ceil(sanitizeFloat(num)), 0)
}

/**
 * Format operational expenditure rate.
 * 
 * Displays OpEx rates with 3 decimal places for precision.
 * 
 * @param num - OpEx rate to format
 * @returns Formatted string with 3 decimal places
 * 
 * @example
 * ```typescript
 * formatOpExRate(0.5) // "0.5"
 * formatOpExRate(1.23456) // "1.235"
 * ```
 */
export function formatOpExRate(num: number): string {
  return formatWithSpaceSeparator(num, 3)
}

/**
 * Format probability as percentage.
 * 
 * Converts decimal probability (0-1) to percentage string with 1 decimal place.
 * 
 * @param num - Probability value (0.0 to 1.0)
 * @returns Percentage string (e.g., "50.0 %", "33.3 %")
 * 
 * @example
 * ```typescript
 * formatProbability(0.5) // "50.0 %"
 * formatProbability(0.333) // "33.3 %"
 * ```
 */
export function formatProbability(num: number): string {
  return formatWithSpaceSeparator(num * 100, 1) + ' %'
}

/**
 * Format time scale modifier value.
 * 
 * Displays time scale multipliers with 4 decimal places for precision.
 * Used for showing recipe duration modifiers.
 * 
 * @param num - Time scale value to format
 * @returns Formatted string with 4 decimal places
 * 
 * @example
 * ```typescript
 * formatTimeScale(1.0) // "1"
 * formatTimeScale(0.5) // "0.5"
 * formatTimeScale(1.3333) // "1.3333"
 * ```
 */
export function formatTimeScale(num: number): string {
  return formatWithSpaceSeparator(num, 4)
}
