const calculationFields = new Set([
  '_computed', 'machines_exact', 'machines_actual', 'operating_equivalent',
  'recommended_installed', 'fixed_installed', 'planned_installed',
  'existing_installed', 'additional_installed', 'utilization',
  'actual_amounts', 'port_throughputs',
])

/**
 * Keep editable configuration separate from explicitly known runtime projections.
 * @param data - Node data containing configuration and optional result fields.
 * @returns A shallow configuration copy preserving all unrelated fields.
 */
export function stripCalculationResults<T extends object>(data: T): T {
  return Object.fromEntries(Object.entries(data).filter(([key]) => !calculationFields.has(key))) as T
}
