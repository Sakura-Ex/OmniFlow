import { LPResponseSchema, type LPRequest, type LPResponse } from '@/common/types/lp'
import type { CalculateResponse } from '@/common/types/api'

/**
 * Read a versioned LP response and bind all numerical evidence to its request.
 * @param response - HTTP response from the solver.
 * @param request - Exact submitted model and identity.
 * @returns Validated, request-bound solver evidence.
 */
export async function readCalculationResponse(response: Response, request: LPRequest): Promise<LPResponse> {
  let body: unknown
  try { body = await response.json() } catch { throw new Error(`HTTP ${response.status}: Invalid JSON response`) }
  const parsed = LPResponseSchema.safeParse(body)
  if (!parsed.success) throw new Error(`计算服务返回格式不兼容（HTTP ${response.status}），请从当前项目重新启动后端。`)
  const result = parsed.data
  if (result.request_id !== request.request_id || result.document_revision !== request.document_revision || result.compiler_fingerprint !== request.compiler_fingerprint) throw new Error('Calculation response identity does not match the requested document')
  if (!response.ok && result.status === 'success') throw new Error(`HTTP ${response.status}: Unexpected success response`)
  const stats = result.model_stats
  if (stats && (stats.variables !== request.variables.length || stats.equality_rows !== request.equalities.row_ids.length || stats.inequality_rows !== request.inequalities.row_ids.length || stats.objective_layers !== request.objectives.length)) throw new Error('Calculation response model dimensions do not match')
  if (result.solution) {
    const { variable_ids: ids, values, feasibility } = result.solution
    if (ids.length !== request.variables.length || ids.some((id, i) => id !== request.variables[i].id)) throw new Error('Calculation response variable identities do not match')
    for (const [i, variable] of request.variables.entries()) {
      const tolerance = feasibility.absolute_tolerance + feasibility.relative_tolerance * Math.max(1, Math.abs(values[i]), Math.abs(variable.lower ?? 0), Math.abs(variable.upper ?? 0))
      if ((variable.lower !== null && values[i] < variable.lower - tolerance) || (variable.upper !== null && values[i] > variable.upper + tolerance)) throw new Error(`Solution violates bound: ${variable.id}`)
    }
    for (const kind of ['equalities', 'inequalities'] as const) {
      const rows = request[kind]
      const activity = rows.rhs.map(() => 0)
      rows.entries.forEach(entry => { activity[entry.row] += entry.value * values[entry.col] })
      rows.row_ids.forEach((id, i) => {
        const evidence = feasibility.row_residuals.find(row => row.row_id === id)
        const tolerance = feasibility.absolute_tolerance + feasibility.relative_tolerance * Math.max(1, Math.abs(activity[i]), Math.abs(rows.rhs[i]))
        const violation = kind === 'equalities' ? Math.abs(activity[i] - rows.rhs[i]) : Math.max(0, activity[i] - rows.rhs[i])
        if (!evidence || evidence.kind !== (kind === 'equalities' ? 'equality' : 'inequality') || violation > tolerance) throw new Error(`Solution violates or omits row: ${id}`)
      })
    }
  }
  if (result.status === 'success') {
    const expected = [...request.objectives].sort((a, b) => a.priority - b.priority)
    if (expected.length && (result.objective_results.length !== expected.length || result.objective_results.some((stage, i) => stage.objective_id !== expected[i].id || stage.priority !== expected[i].priority))) throw new Error('Calculation response objective identities do not match')
  }
  return result
}

/**
 * Format domain diagnostics already mapped through the compiled origin table.
 * @param result - Internal presentation result.
 * @returns Located diagnostic text.
 */
export function formatCalculationError(result: CalculateResponse): string {
  const details = result.errors?.map(issue => `${issue.node_id ? `${issue.node_id}: ` : ''}${issue.path.join('.')} — ${issue.message}`) ?? []
  return [`${result.status}: ${result.message ?? 'Calculation failed.'}`, ...details].join('\n')
}
