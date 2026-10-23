/** Node presentation derived from an already verified compiled LP solution. */
export type CalculationNodeResult = {
  operating_equivalent?: number
  recommended_installed?: number
  fixed_installed?: number | null
  planned_installed?: number
  existing_installed?: number | null
  additional_installed?: number | null
  utilization?: number | null
  port_throughputs?: Record<string, number>
  /** Standard per-second endpoint throughput indexed by persistent port ID. */
  actual_amounts?: Record<string, number>
}
/** Separate gross boundary totals on one conserved Net. */
export type NetSummary = { id: string; resourceId: string; portKeys: string[]; source: number; delivery: number; spill: number }
/** Startup evidence is separate from steady-state feasibility. */
export type StartupChecklist = { status: 'needs_confirmation' | 'not_assessed'; catalysts: Array<{ nodeId: string; resourceId: string; amount: number }>; cycles: string[][]; preheat: Array<{ nodeId: string; requirement: string }> }
/** Internal view model; HTTP transport uses LPResponse exclusively. */
export type CalculateResponse = {
  status: 'success' | 'invalid_model' | 'unbounded' | 'infeasible' | 'limit_reached' | 'solver_error'
  startup?: StartupChecklist
  bom?: Record<string, number>
  has_verified_solution?: boolean
  node_results?: Record<string, CalculationNodeResult>
  system_inputs?: Record<string, number>
  system_outputs?: Record<string, number>
  system_spills?: Record<string, number>
  net_summaries?: NetSummary[]
  message?: string
  errors?: Array<{ node_id?: string | null; path: Array<string | number>; code: string; message: string }>
}
