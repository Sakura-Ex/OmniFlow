import { expect, it } from 'vitest'
import { formatCalculationError, readCalculationResponse } from './calculationClient'

it('preserves structured HTTP 422 errors and their node locations', async () => {
  const error = {
    status: 'invalid_model', message: 'Graph validation failed',
    errors: [{ node_id: 'source', path: ['nodes', 0, 'data', 'id'], code: 'missing', message: 'Required' }],
  }
  const result = await readCalculationResponse(Response.json(error, { status: 422 }))
  expect(result).toEqual(error)
  expect(formatCalculationError(result)).toContain('source: nodes.0.data.id — Required')
  expect(formatCalculationError(result)).not.toContain('Cannot connect')
})

it.each(['infeasible', 'unbounded', 'limit_reached', 'solver_error'] as const)(
  'preserves %s without treating it as a connection failure', async (status) => {
    const result = { status, message: 'Solver detail' }
    expect(await readCalculationResponse(Response.json(result, { status: status === 'solver_error' ? 500 : 200 })))
      .toEqual(result)
    expect(formatCalculationError(result)).toContain('Solver detail')
  },
)

it('handles non-JSON and unexpected HTTP errors', async () => {
  expect(await readCalculationResponse(new Response('bad gateway', { status: 502 })))
    .toEqual({ status: 'solver_error', message: 'HTTP 502: Invalid JSON response' })
  expect((await readCalculationResponse(Response.json({}, { status: 503 }))).message).toContain('HTTP 503')
  expect((await readCalculationResponse(Response.json({ status: 'unknown' }))).status).toBe('solver_error')
})

it('preserves fractional endpoint results', async () => {
  const result = { status: 'success', node_results: { source: { actual_amounts: { ore: 0.25 } } } }
  expect(await readCalculationResponse(Response.json(result))).toEqual(result)
})
