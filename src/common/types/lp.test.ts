import modelJson from '../../../fixtures/lp/models.json?raw'
import responseJson from '../../../fixtures/lp/responses.json?raw'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { LPRequestSchema, LPResponseSchema } from '@/common/types/lp'
import type { LPRequest, LPResponse } from '@/common/types/lp'

const models = z.array(z.object({
  id: z.string(), request: LPRequestSchema,
  expected: z.object({ status: z.string(), values: z.array(z.number()).nullable(), objective_ids: z.array(z.string().nullable()) }),
})).parse(JSON.parse(modelJson))
const responses = z.array(z.object({ id: z.string(), response: LPResponseSchema })).parse(JSON.parse(responseJson))
const requestFixture = () => structuredClone(models[0].request)
const responseFixture = () => structuredClone(responses[0].response)

describe('cross-language sparse LP fixtures', () => {
  it.each(models)('$id is accepted by the versioned TypeScript request schema', ({ request }) => {
    expect(LPRequestSchema.parse(request)).toEqual(request)
  })

  it.each(responses)('$id has a finite, consistent Python response', ({ response }) => {
    expect(LPResponseSchema.parse(response)).toEqual(response)
  })

  it.each(models)('$id agrees with the mathematical expected solution', ({ id, expected }) => {
    const result = responses.find(item => item.id === id)!.response
    expect(result.status).toBe(expected.status)
    expect(result.objective_results.map(item => item.objective_id)).toEqual(expected.objective_ids)
    if (expected.values === null) expect(result.solution).toBeNull()
    else {
      expect(result.solution!.values).toHaveLength(expected.values.length)
      expected.values.forEach((value, i) => expect(result.solution!.values[i]).toBeCloseTo(value, 8))
    }
  })

  it('covers all six terminal states without accepting unverified error solutions', () => {
    expect(new Set(responses.map(item => item.response.status))).toEqual(new Set([
      'success', 'infeasible', 'unbounded', 'limit_reached', 'invalid_model', 'solver_error',
    ]))
  })

  it('T21 retains a feasible first-layer solution with lock residual evidence', () => {
    const result = responses.find(item => item.id === 'T21-verified-first-layer-timeout')!.response
    expect(result.status).toBe('limit_reached')
    expect(result.solution!.values).toEqual([20000, 1])
    expect(result.objective_results.map(stage => stage.proven_optimal)).toEqual([true, false])
    expect(result.solution!.feasibility.row_residuals.some(row => row.kind === 'objective_lock' && row.passed)).toBe(true)
  })
})

describe('LP model validation before transport', () => {
  const invalid: Array<[string, (request: LPRequest) => void]> = [
    ['duplicate variable identity', request => request.variables.push({ ...request.variables[0] })],
    ['duplicate row identity', request => { request.equalities.row_ids[0] = 'bottleneck' }],
    ['duplicate objective identity', request => { request.objectives[0].id = 'delivery-first' }],
    ['ambiguous priority', request => { request.objectives[0].priority = 10 }],
    ['inverted bounds', request => { request.variables[0].lower = 2; request.variables[0].upper = 1 }],
    ['infinite bound', request => { request.variables[0].upper = Infinity }],
    ['missing right-hand side', request => { request.equalities.rhs = [] }],
    ['negative sparse index', request => { request.equalities.entries[0].col = -1 }],
    ['fractional sparse index', request => { request.equalities.entries[0].col = 0.5 }],
    ['unknown sparse column', request => { request.equalities.entries[0].col = 2 }],
    ['unknown sparse row', request => { request.equalities.entries[0].row = 1 }],
    ['nonfinite coefficient', request => { request.equalities.entries[0].value = NaN }],
    ['unknown objective column', request => { request.objectives[0].coefficients[0].col = 2 }],
    ['invalid normalization', request => { request.objectives[0].normalization_scale = 0 }],
    ['normalization overflow', request => { request.objectives[0].coefficients[0].value = 1e308; request.objectives[0].normalization_scale = 1e-308 }],
    ['normalization underflow', request => { request.objectives[0].coefficients[0].value = 1e-308; request.objectives[0].normalization_scale = 1e308 }],
    ['duplicate sum overflow', request => { request.equalities.entries = [{ row: 0, col: 0, value: 1e308 }, { row: 0, col: 0, value: 1e308 }] }],
    ['negative tolerance', request => { request.objectives[0].abs_tolerance = -1 }],
    ['unsafe revision', request => { request.document_revision = Number.MAX_SAFE_INTEGER + 1 }],
    ['invalid budget', request => { request.solver_options.time_limit_ms = 0 }],
    ['excessive budget', request => { request.solver_options.time_limit_ms = 60_001 }],
  ]

  it.each(invalid)('rejects %s', (_, mutate) => {
    const request = requestFixture()
    mutate(request)
    expect(LPRequestSchema.safeParse(request).success).toBe(false)
  })

  it('keeps additive cancellation and fractional coefficients legal', () => {
    const request = requestFixture()
    request.equalities.entries = [1e16, 1, -1e16].map(value => ({ row: 0, col: 0, value }))
    expect(LPRequestSchema.safeParse(request).success).toBe(true)
  })

  it('rejects unversioned graph and extra solver settings', () => {
    expect(LPRequestSchema.safeParse({ nodes: [], edges: [] }).success).toBe(false)
    const request = requestFixture()
    expect(LPRequestSchema.safeParse({ ...request, solver_options: { ...request.solver_options, arbitrary: true } }).success).toBe(false)
  })
})

describe('LP response validation before consumption', () => {
  const invalid: Array<[string, (response: LPResponse) => void]> = [
    ['nonfinite solution', response => { response.solution!.values[0] = Infinity }],
    ['nonfinite objective', response => { response.objective_results[0].value = NaN }],
    ['nonfinite normalized objective', response => { response.objective_results[0].normalized_value = Infinity }],
    ['nonfinite lock', response => { response.objective_results[0].lock_upper = Infinity }],
    ['nonfinite residual', response => { response.solution!.feasibility.row_residuals[0].residual = NaN }],
    ['nonfinite bound slack', response => { response.solution!.feasibility.bound_slacks[0].upper_slack = Infinity }],
    ['missing solution', response => { response.solution = null }],
    ['unverified solution', response => { response.solution!.feasibility.passed = false }],
    ['missing stage', response => { response.objective_results.pop() }],
    ['unproven stage', response => { response.objective_results[0].proven_optimal = false }],
    ['contradictory stage status', response => { response.objective_results[0].status = 'solver_error' }],
    ['missing objective value', response => { response.objective_results[0].value = null }],
    ['missing stage evidence', response => { response.objective_results[0].feasibility = null }],
    ['missing variable value', response => { response.solution!.values.pop() }],
    ['duplicate variable identity', response => { response.solution!.variable_ids[1] = response.solution!.variable_ids[0] }],
    ['misaligned evidence', response => { response.solution!.feasibility.bound_slacks[0].value = -100 }],
    ['contradictory row evidence', response => { response.solution!.feasibility.row_residuals[0].passed = false }],
    ['contradictory violation', response => { response.solution!.feasibility.row_residuals[0].violation = 100 }],
    ['contradictory maximum violation', response => { response.solution!.feasibility.max_violation = 100 }],
    ['solution attached to infeasible', response => { response.status = 'infeasible' }],
  ]

  it.each(invalid)('rejects %s', (_, mutate) => {
    const response = responseFixture()
    mutate(response)
    expect(LPResponseSchema.safeParse(response).success).toBe(false)
  })
})
