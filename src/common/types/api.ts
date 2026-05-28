/**
 * Result of a single node in the calculation response.
 * 
 * Contains the solver's output for each node in the production flow,
 * including machine counts, utilization, and actual throughput.
 */
export type CalculationNodeResult = {
  /** Exact (floating-point) machine count required */
  machines_exact?: number
  /** Integer machine count (ceiling of exact) */
  machine_actual?: number
  /** Machine utilization rate (0.0 to 1.0) */
  utilization?: number
  /** Actual throughput per resource for source/target nodes */
  actual_amounts?: Record<string, number>
}

/**
 * Response from the /api/calculate endpoint.
 * 
 * Contains the complete solver result including per-node results,
 * system-level material balance, and status information.
 */
export type CalculateResponse = {
  /** Solver status: 'success', 'unbounded', 'infeasible' */
  status?: string
  /** Per-node calculation results, keyed by node ID */
  node_results?: Record<string, CalculationNodeResult>
  /** Total system input rates (items/s) */
  system_inputs?: Record<string, number>
  /** Total system output rates (items/s) */
  system_outputs?: Record<string, number>
  /** Error or status message from the solver */
  message?: string
}
