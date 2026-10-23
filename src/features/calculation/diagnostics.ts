import { LPRequestSchema, LPResponseSchema, type LPRequest, type LPResponse } from '@/common/types/lp'
import type { CompiledNetwork, ModelOrigin } from './networkCompiler'

/** A hypothetical relaxation is evidence of a conflict, never an operating plan. */
export interface DiagnosticIssue {
  rowId: string
  kind: 'missing_supply' | 'missing_outlet' | 'capacity_shortfall'
  amount: number
  scale: number
  netId?: string
  nodeIds: string[]
  portKeys: string[]
}
/** Kept separate from normal results so diagnostic vectors cannot reach BOM or logistics. */
export interface DiagnosticReport {
  status: 'explained' | 'incomplete' | 'unavailable' | 'stale'
  issues: DiagnosticIssue[]
  message: string
  assumptions: string[]
}
/** A binding constraint does not prove that increasing it improves the objective. */
export interface ActiveLimit {
  id: string
  slack: number
  atLimit: boolean
  nodeIds: string[]
  portKeys: string[]
  benefit: 'unknown'
}
/** One bounded hypothetical deficit and its original domain evidence. */
interface Relaxation {
  col: number
  rowId: string
  scale: number
  kind: DiagnosticIssue['kind']
  origin: ModelOrigin
}
/** A separate mathematical request which must never publish normal results. */
export interface DiagnosticModel {
  request: LPRequest
  relaxations: Relaxation[]
}
const assumptions = [
  '仅诊断显式外供网络的供给缺口、配方及分流器产出网络的出口缺口，以及已识别容量约束；不会凭空补充内部制造的成品。',
  '比例、工况、未知约束及原变量上下界保持不变；诊断可能无法解释范围外的冲突。',
  '缺口按每行尺度归一化后等权惩罚，每项最多为该尺度的一百万倍；此上限仅用于诊断。',
  '可能存在多个冲突或同样代价的解释；这不是唯一原因或最小冲突集合，也不是可运行方案。',
]

/** Locate a row through explicit port evidence.
 * @param model - Original compiled network.
 * @param origin - Constraint evidence.
 * @returns Node and port identities for UI navigation.
 */
function location(model: CompiledNetwork, origin: ModelOrigin) {
  return { nodeIds: [...new Set([...(origin.nodeId ? [origin.nodeId] : []), ...model.ports.filter(port => origin.portKeys.includes(port.key)).map(port => port.nodeId)])], portKeys: origin.portKeys }
}

/** Build a bounded elastic LP without relaxing unknown rows, ratios, state or variable bounds.
 * @param model - Original compiled network.
 * @param requestId - Unique diagnostic request identity.
 * @param budgetMs - Original request's remaining total budget.
 * @param allowedRowIds - Optional explicit permission list; an empty list disables relaxation.
 * @returns A separate request and evidence mapping for hypothetical deficits.
 */
export function buildDiagnosticModel(model: CompiledNetwork, requestId: string, budgetMs: number, allowedRowIds?: readonly string[]): DiagnosticModel {
  const request = structuredClone(model.request)
  request.request_id = requestId
  request.compiler_fingerprint = `${model.fingerprint}:diagnostic`
  request.solver_options.time_limit_ms = Math.min(60000, budgetMs)
  request.objectives = [{ id: 'diagnostic:normalized-deficit', priority: 0, coefficients: [], normalization_scale: 1, abs_tolerance: 0, rel_tolerance: 0 }]
  const relaxations: Relaxation[] = []
  for (const name of ['equalities', 'inequalities'] as const) {
    const rows = request[name]
    const scales = rows.rhs.map(Math.abs)
    rows.entries.forEach(entry => { scales[entry.row] = Math.max(scales[entry.row], Math.abs(entry.value)) })
    rows.row_ids.forEach((rowId, row) => {
      const origin = model.provenance.rows[rowId]
      if (allowedRowIds && !allowedRowIds.includes(rowId)) return
      if (!origin || (name === 'equalities' ? origin.kind !== 'conservation' : origin.kind !== 'capacity')) return
      const scale = scales[row] || 1
      const append = (kind: Relaxation['kind'], sign: number) => {
        const col = request.variables.length
        request.variables.push({ id: `diagnostic:${rowId}:${kind}`, lower: 0, upper: 1e6 })
        rows.entries.push({ row, col, value: sign * scale })
        request.objectives[0].coefficients.push({ col, value: 1 })
        relaxations.push({ col, rowId, scale, kind, origin })
      }
      if (name === 'equalities') {
        const members = model.ports.filter(port => origin.portKeys.includes(port.key))
        const hasRecipeOutput = members.some(port => port.direction === 'output' && port.coefficient > 0 && (port.constant > 0 || (port.variable !== null && ['operation', 'splitter'].includes(model.provenance.variables[port.variable].kind))))
        const hasSource = model.provenance.variables.some(item => item.kind === 'source' && item.netId === origin.netId)
        if (hasSource) append('missing_supply', 1)
        if (hasRecipeOutput) append('missing_outlet', -1)
      } else append('capacity_shortfall', -1)
    })
  }
  if (!relaxations.length) throw new Error('没有允许放松的资源或容量约束。')
  return { request: LPRequestSchema.parse(request), relaxations }
}

/** Caller-owned transport, permission and revision controls for a diagnostic run. */
export interface DiagnosticOptions {
  deadline: number
  requestId: string
  solve: (request: LPRequest) => Promise<LPResponse>
  isCurrent: () => boolean
  allowedRowIds?: readonly string[]
}

/** Spend only the original run's remaining deadline and discard superseded explanations.
 * @param model - Original compiled network.
 * @param original - Original terminal result, preserved unchanged.
 * @param options - Shared deadline, transport and revision controls.
 * @returns A diagnostic explanation without an operating solution vector.
 */
export async function runNetworkDiagnostics(model: CompiledNetwork, original: LPResponse, options: DiagnosticOptions): Promise<DiagnosticReport> {
  const report = (status: DiagnosticReport['status'], message: string, issues: DiagnosticIssue[] = []): DiagnosticReport => ({ status, message, issues, assumptions })
  if (original.status !== 'infeasible') return report('unavailable', '仅对原始不可行模型进行缺口诊断。')
  if (!options.isCurrent()) return report('stale', '图已改变，诊断已丢弃。')
  const remaining = options.deadline - performance.now()
  if (remaining <= 0) return report('unavailable', '总预算已用尽，原模型仍为不可行。')
  try {
    const diagnostic = buildDiagnosticModel(model, options.requestId, remaining, options.allowedRowIds)
    const result = LPResponseSchema.parse(await options.solve(diagnostic.request))
    if (!options.isCurrent()) return report('stale', '图已改变，诊断已丢弃。')
    if (performance.now() > options.deadline) return report('unavailable', '诊断超过总预算，原模型仍为不可行。')
    if (result.request_id !== options.requestId || result.document_revision !== model.request.document_revision || result.compiler_fingerprint !== diagnostic.request.compiler_fingerprint) return report('unavailable', '诊断响应与当前请求不匹配。')
    if (!result.solution || !['success', 'limit_reached'].includes(result.status)) return report('unavailable', '在允许的假设和预算内未得到诊断；原模型仍为不可行。')
    if (result.solution.variable_ids.length !== diagnostic.request.variables.length || result.solution.variable_ids.some((id, index) => id !== diagnostic.request.variables[index].id)) return report('unavailable', '诊断变量身份不匹配。')
    const issues = diagnostic.relaxations.flatMap(item => {
      const value = result.solution!.values[item.col]
      if (value <= 1e-7) return []
      return [{ rowId: item.rowId, kind: item.kind, amount: value * item.scale, scale: item.scale, netId: item.origin.netId, ...location(model, item.origin) }]
    })
    return report(result.status === 'success' ? 'explained' : 'incomplete', result.status === 'success' ? '以下是假设缺口的一种解释，原模型仍不可行。' : '诊断达到限制，缺口尚未证明最小；原模型仍不可行。', issues)
  } catch {
    return report(options.isCurrent() ? 'unavailable' : 'stale', '诊断未完成，原模型仍为不可行。')
  }
}

/** Report capacity/bound slack; never infer objective improvement from binding alone.
 * @param model - Compiled network associated with the verified response.
 * @param response - Original verified operating response.
 * @returns Located slack evidence with explicitly unknown expansion benefit.
 */
export function explainActiveLimits(model: CompiledNetwork, response: LPResponse): ActiveLimit[] {
  const evidence = response.solution?.feasibility
  if (!evidence) return []
  const rows = evidence.row_residuals.flatMap(row => {
    const origin = model.provenance.rows[row.row_id]
    if (origin?.kind !== 'capacity' || row.slack === null) return []
    return [{ id: row.row_id, slack: row.slack, atLimit: row.slack <= row.tolerance, ...location(model, origin), benefit: 'unknown' as const }]
  })
  const bounds = evidence.bound_slacks.flatMap(bound => {
    const index = model.request.variables.findIndex(variable => variable.id === bound.variable_id)
    const origin = model.provenance.variables[index]
    if (!origin || bound.upper_slack === null || !['operation', 'source', 'splitter', 'delivery', 'spill'].includes(origin.kind)) return []
    return [{ id: bound.variable_id, slack: bound.upper_slack, atLimit: bound.upper_slack <= bound.tolerance, ...location(model, origin), benefit: 'unknown' as const }]
  })
  return [...rows, ...bounds]
}
