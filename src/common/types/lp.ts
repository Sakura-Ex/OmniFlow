import { z } from 'zod'

/** Independent LP contract; the graph-based calculation API is replaced in PR-07. */
export const LP_SCHEMA_VERSION = 'omniflow.lp.v1' as const

/** Server defaults are also enforced by backend/solver/schema.py and service.py. */
export const LP_LIMITS = {
  variables: 50_000,
  rows: 100_000,
  nonzeros: 1_000_000,
  objectiveLayers: 32,
  timeLimitMs: 60_000,
} as const

const finite = z.number().finite()
const nonnegative = finite.nonnegative()
const index = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const identifier = z.string().min(1).max(200)
const variable = z.object({ id: identifier, lower: finite.nullable(), upper: finite.nullable() }).strict()
const matrixEntry = z.object({ row: index, col: index, value: finite }).strict()
const sparseRows = z.object({
  row_ids: z.array(identifier).max(LP_LIMITS.rows),
  rhs: z.array(finite).max(LP_LIMITS.rows),
  entries: z.array(matrixEntry).max(LP_LIMITS.nonzeros),
}).strict()
const coefficient = z.object({ col: index, value: finite }).strict()
const objective = z.object({
  id: identifier,
  priority: index,
  coefficients: z.array(coefficient).max(LP_LIMITS.nonzeros),
  normalization_scale: finite.positive(),
  abs_tolerance: nonnegative,
  rel_tolerance: nonnegative,
}).strict()

/** Validate the same mathematical request structure and identity rules as Python. */
export const LPRequestSchema = z.object({
  schema_version: z.literal(LP_SCHEMA_VERSION),
  request_id: identifier,
  document_revision: index,
  compiler_fingerprint: identifier,
  variables: z.array(variable).max(LP_LIMITS.variables),
  equalities: sparseRows,
  inequalities: sparseRows,
  objectives: z.array(objective).max(LP_LIMITS.objectiveLayers),
  solver_options: z.object({ time_limit_ms: finite.positive().max(LP_LIMITS.timeLimitMs) }).strict(),
}).strict().superRefine((request, context) => {
  const issue = (message: string, path: Array<string | number>) => context.addIssue({
    code: z.ZodIssueCode.custom, message, path,
  })
  const unique = (values: Array<string | number>, path: Array<string | number>) => {
    const seen = new Set<string | number>()
    values.forEach((value, i) => {
      if (seen.has(value)) issue('Identities and objective priorities must be unique', [...path, i])
      seen.add(value)
    })
  }
  const sums = (terms: Array<{ key: string; value: number }>, path: Array<string | number>) => {
    const groups = new Map<string, { sum: number; correction: number }>()
    terms.forEach(({ key, value }) => {
      const previous = groups.get(key) ?? { sum: 0, correction: 0 }
      const sum = previous.sum + value
      const correction = previous.correction + (Math.abs(previous.sum) >= Math.abs(value)
        ? (previous.sum - sum) + value : (value - sum) + previous.sum)
      groups.set(key, { sum, correction })
    })
    return [...groups.values()].map(({ sum, correction }) => {
      const result = sum + correction
      if (!Number.isFinite(result)) issue('Duplicate coefficients must sum to a finite value', path)
      return result
    })
  }
  unique(request.variables.map(item => item.id), ['variables'])
  unique([...request.equalities.row_ids, ...request.inequalities.row_ids], ['row_ids'])
  unique(request.objectives.map(item => item.id), ['objectives'])
  unique(request.objectives.map(item => item.priority), ['objectives', 'priority'])
  request.variables.forEach((item, i) => {
    if (item.lower !== null && item.upper !== null && item.lower > item.upper) {
      issue('The lower bound exceeds the upper bound', ['variables', i])
    }
  })
  const columns = request.variables.length
  let entries = 0
  for (const name of ['equalities', 'inequalities'] as const) {
    const rows = request[name]
    entries += rows.entries.length
    if (rows.row_ids.length !== rows.rhs.length) issue('Row identities and right-hand sides must align', [name, 'rhs'])
    rows.entries.forEach((item, i) => {
      if (item.row >= rows.row_ids.length || item.col >= columns) {
        issue('Sparse coefficient index is out of range', [name, 'entries', i])
      }
    })
    sums(rows.entries.map(item => ({ key: `${item.row}:${item.col}`, value: item.value })), [name, 'entries'])
  }
  request.objectives.forEach((item, i) => {
    entries += item.coefficients.length
    item.coefficients.forEach((value, j) => {
      if (value.col >= columns) issue('Objective coefficient index is out of range', ['objectives', i, 'coefficients', j])
    })
    const coefficients = sums(item.coefficients.map(value => ({ key: String(value.col), value: value.value })), ['objectives', i, 'coefficients'])
    if (coefficients.some(value => value !== 0 && (!Number.isFinite(value / item.normalization_scale) || value / item.normalization_scale === 0))) {
      issue('Objective normalization must preserve finite nonzero coefficients', ['objectives', i, 'normalization_scale'])
    }
  })
  if (request.equalities.row_ids.length + request.inequalities.row_ids.length > LP_LIMITS.rows) {
    issue('The model exceeds the total row limit', ['equalities'])
  }
  if (entries > LP_LIMITS.nonzeros) issue('The model exceeds the submitted entry limit', ['entries'])
})

/** Generic sparse request with no Recipe, Source, Target or canvas data. */
export type LPRequest = z.infer<typeof LPRequestSchema>

/** Stable terminal outcomes; success means all layers have proven optima. */
export const LPStatusSchema = z.enum([
  'success', 'infeasible', 'unbounded', 'limit_reached', 'invalid_model', 'solver_error',
])

const rowResidual = z.object({
  row_id: z.string(),
  kind: z.enum(['equality', 'inequality', 'objective_lock']),
  activity: finite,
  rhs: finite,
  residual: finite,
  slack: finite.nullable(),
  tolerance: nonnegative,
  violation: nonnegative,
  passed: z.boolean(),
}).strict()
const boundSlack = z.object({
  variable_id: z.string(),
  value: finite,
  lower_slack: finite.nullable(),
  upper_slack: finite.nullable(),
  tolerance: nonnegative,
  violation: nonnegative,
  passed: z.boolean(),
}).strict()
const feasibility = z.object({
  passed: z.boolean(),
  absolute_tolerance: nonnegative,
  relative_tolerance: nonnegative,
  max_violation: nonnegative,
  row_residuals: z.array(rowResidual),
  bound_slacks: z.array(boundSlack),
}).strict().superRefine((evidence, context) => {
  const checks = [...evidence.row_residuals, ...evidence.bound_slacks]
  if (checks.some(item => item.passed !== (item.violation <= item.tolerance))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Individual check disagrees with violation and tolerance' })
  }
  if (evidence.passed !== checks.every(item => item.passed)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Aggregate feasibility disagrees with individual checks' })
  }
  if (evidence.max_violation !== checks.reduce((maximum, item) => Math.max(maximum, item.violation), 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Maximum violation disagrees with individual checks' })
  }
})
const solution = z.object({
  variable_ids: z.array(z.string()),
  values: z.array(finite),
  feasibility,
}).strict()
const objectiveResult = z.object({
  objective_id: z.string().nullable(),
  priority: index.nullable(),
  status: z.enum(['optimal', 'infeasible', 'unbounded', 'limit_reached', 'solver_error']),
  proven_optimal: z.boolean(),
  value: finite.nullable(),
  normalized_value: finite.nullable(),
  normalization_scale: finite.positive(),
  abs_tolerance: nonnegative,
  rel_tolerance: nonnegative,
  lock_upper: finite.nullable(),
  elapsed_ms: nonnegative,
  feasibility: feasibility.nullable(),
}).strict()

/** Validate version, numerical evidence, stage completion and solution eligibility. */
export const LPResponseSchema = z.object({
  schema_version: z.literal(LP_SCHEMA_VERSION),
  request_id: z.string().nullable(),
  document_revision: index.nullable(),
  compiler_fingerprint: z.string().nullable(),
  status: LPStatusSchema,
  solution: solution.nullable(),
  objective_results: z.array(objectiveResult),
  diagnostics: z.array(z.object({
    code: z.string(), message: z.string(), path: z.array(z.union([z.string(), index])),
    row_id: z.string().nullable(), variable_id: z.string().nullable(), objective_id: z.string().nullable(),
  }).strict()),
  model_stats: z.object({
    variables: index, equality_rows: index, inequality_rows: index,
    matrix_nonzeros: index, objective_nonzeros: index, objective_layers: index,
  }).strict().nullable(),
  timings: z.object({ queue_ms: nonnegative, solve_ms: nonnegative, total_ms: nonnegative }).strict(),
}).strict().superRefine((response, context) => {
  const issue = (message: string, path: Array<string | number>) => context.addIssue({ code: z.ZodIssueCode.custom, message, path })
  if (response.solution) {
    const current = response.solution
    if (!['success', 'limit_reached'].includes(response.status)) issue('This status cannot carry a solution', ['solution'])
    if (!response.solution.feasibility.passed) issue('A solution requires passed feasibility checks', ['solution', 'feasibility'])
    if (response.solution.variable_ids.length !== response.solution.values.length) issue('Solution identities and values must align', ['solution', 'values'])
    if (new Set(response.solution.variable_ids).size !== response.solution.variable_ids.length) issue('Solution variable identities must be unique', ['solution', 'variable_ids'])
    const bounds = response.solution.feasibility.bound_slacks
    if (bounds.length !== current.values.length || bounds.some((item, i) => item.variable_id !== current.variable_ids[i] || item.value !== current.values[i])) {
      issue('Bound evidence must align with the solution vector', ['solution', 'feasibility', 'bound_slacks'])
    }
  }
  response.objective_results.forEach((stage, i) => {
    if (stage.proven_optimal !== (stage.status === 'optimal')) issue('Stage status and proven optimality must agree', ['objective_results', i])
    if (stage.proven_optimal && (stage.value === null || stage.normalized_value === null || stage.lock_upper === null || !stage.feasibility?.passed)) {
      issue('An optimal stage requires a verified vector, value and lock', ['objective_results', i])
    }
  })
  if (response.status === 'success') {
    if (!response.solution || !response.objective_results.length) issue('Success requires a verified solution and stage evidence', ['status'])
    if (response.objective_results.some(stage => !stage.proven_optimal)) issue('Success requires all stages to be proven optimal', ['objective_results'])
    if (!response.model_stats || response.objective_results.length !== Math.max(1, response.model_stats.objective_layers)) issue('Success requires evidence for every requested layer', ['objective_results'])
  }
})

/** Versioned response reserved for the future compiled-LP calculation entry point. */
export type LPResponse = z.infer<typeof LPResponseSchema>

/** Explicit per-layer objective; callers aggregate objectives sharing one priority. */
export type LPObjective = LPRequest['objectives'][number]

/** Full feasibility evidence with original row IDs and objective-lock IDs. */
export type LPFeasibilityEvidence = LPResponse['objective_results'][number]['feasibility']
