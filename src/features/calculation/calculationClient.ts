import { z } from 'zod'
import type { CalculateResponse } from '@/common/types/api'

const failureSchema = z.object({
  status: z.enum(['invalid_model', 'infeasible', 'unbounded', 'limit_reached', 'solver_error']),
  message: z.string().optional(),
  errors: z.array(z.object({
    node_id: z.string().nullable().optional(),
    path: z.array(z.union([z.string(), z.number()])),
    code: z.string(),
    message: z.string(),
  })).optional(),
})

/**
 * Read HTTP calculation failures without confusing them with network failures.
 * @param response - The backend HTTP response.
 * @returns The calculation result or a structured HTTP/protocol failure.
 */
export async function readCalculationResponse(response: Response): Promise<CalculateResponse> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { status: 'solver_error', message: `HTTP ${response.status}: Invalid JSON response` }
  }
  const failure = failureSchema.safeParse(body)
  if (failure.success) return failure.data
  if (!response.ok) {
    return { status: 'solver_error', message: `HTTP ${response.status}: Calculation request failed` }
  }
  if (typeof body !== 'object' || body === null || !('status' in body) || body.status !== 'success') {
    return { status: 'solver_error', message: 'Invalid calculation response status' }
  }
  return body as CalculateResponse
}

/**
 * Format solver status and validation locations for the calculation error panel.
 * @param result - The backend calculation outcome.
 * @returns A human-readable failure description.
 */
export function formatCalculationError(result: CalculateResponse): string {
  const labels = {
    success: 'Success',
    invalid_model: 'Invalid model',
    infeasible: 'Infeasible',
    unbounded: 'Unbounded',
    limit_reached: 'Solver limit reached',
    solver_error: 'Solver error',
  }
  const details = result.errors?.map((issue) =>
    `${issue.node_id ? `${issue.node_id}: ` : ''}${issue.path.join('.')} — ${issue.message}`,
  ) ?? []
  return [`${labels[result.status]}: ${result.message ?? 'Calculation failed.'}`, ...details].join('\n')
}
