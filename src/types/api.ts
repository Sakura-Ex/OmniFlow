export type CalculationNodeResult = {
  machines_exact?: number
  machine_actual?: number
  utilization?: number
  actual_amounts?: Record<string, number>
}

export type CalculateResponse = {
  status?: string
  node_results?: Record<string, CalculationNodeResult>
  system_inputs?: Record<string, number>
  system_outputs?: Record<string, number>
  message?: string
}
