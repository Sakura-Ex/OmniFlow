export type CalculateResponse = {
  status?: string
  node_results?: Record<string, any>
  total_eu_tick?: number
  system_inputs?: Record<string, number>
  system_outputs?: Record<string, number>
}
