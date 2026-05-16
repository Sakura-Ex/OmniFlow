export type CalculateResponse = {
  status?: string
  node_results?: Record<string, { machines_exact?: number; machines_actual?: number; utilization?: number }>
  system_inputs?: Record<string, number>
  system_outputs?: Record<string, number>
  message?: string
}
