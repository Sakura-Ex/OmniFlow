import { recommendInstalled, buildStartupChecklist } from './installation'
import { computeCapexList } from './capEx'
import type { LPResponse } from '@/common/types/lp'
import type { CalculateResponse, CalculationNodeResult, NetSummary } from '@/common/types/api'
import type { CompiledNetwork } from './networkCompiler'

/**
 * Map the verified vector using the exact compiled model and origin table.
 * @param model - Original compiled snapshot.
 * @param response - Validated solver response.
 * @returns Internal view with gross boundary summaries.
 */
export function mapCalculationResult(model: CompiledNetwork, response: LPResponse): CalculateResponse {
  const nodeResults: Record<string, CalculationNodeResult> = {}
  const inputs: Record<string, number> = {}, outputs: Record<string, number> = {}, spills: Record<string, number> = {}
  const nets: NetSummary[] = model.nets.map(net => ({ id: net.id, resourceId: net.resourceId, portKeys: net.ports, source: 0, delivery: 0, spill: 0 }))
  response.solution?.values.forEach((value, index) => {
    const origin = model.provenance.variables[index]
    if (origin.kind === 'operation' && origin.nodeId) {
      const recipe = model.recipeDefinitions[origin.nodeId]
      const policy = model.configuration.machines[origin.nodeId]
      const fixed = policy ? policy.installed : recipe?.mode === 'limit' ? recipe.manual_machines ?? null : null
      const recommended = recommendInstalled(value, index, model, response)
      const planned = fixed ?? recommended
      const existing = policy?.existing ?? null
      nodeResults[origin.nodeId] = { operating_equivalent: value, recommended_installed: recommended, fixed_installed: fixed, planned_installed: planned, existing_installed: existing, additional_installed: existing === null ? null : Math.max(0, planned - existing), utilization: value <= 0 || planned <= 0 ? null : value / planned }
    }
    if (!['source', 'delivery', 'spill'].includes(origin.kind)) return
    const net = nets.find(item => item.id === origin.netId)
    if (!net) throw new Error('Boundary variable has no compiled Net origin')
    const kind = origin.kind as 'source' | 'delivery' | 'spill'
    net[kind] += value
    const aggregate = kind === 'source' ? inputs : kind === 'delivery' ? outputs : spills
    aggregate[net.resourceId] = (aggregate[net.resourceId] ?? 0) + value
    for (const key of origin.portKeys) {
      const port = model.ports.find(item => item.key === key)!
      if (port.variable !== index) continue
      const node = nodeResults[port.nodeId] ?? { actual_amounts: {} }
      node.actual_amounts = { ...node.actual_amounts, [port.portId]: value }
      nodeResults[port.nodeId] = node
    }
  })
  if (response.solution) for (const port of model.ports) {
    if (port.semantics === 'state') continue
    const throughput = port.constant + (port.variable === null ? 0 : port.coefficient * response.solution.values[port.variable])
    const result = nodeResults[port.nodeId] ?? {}
    result.port_throughputs = { ...result.port_throughputs, [port.portId]: throughput }
    nodeResults[port.nodeId] = result
  }
  const bom = response.solution ? computeCapexList(model.recipes, nodeResults, model.environment) : {}
  const startup = response.solution ? buildStartupChecklist(model, nodeResults, model.recipeDefinitions) : undefined
  return { bom, startup, status: response.status, node_results: nodeResults, system_inputs: inputs, system_outputs: outputs, system_spills: spills, net_summaries: nets,
    message: response.status === 'limit_reached' && response.solution ? '已验证可行方案；达到求解限制，尚未证明最优。' : response.diagnostics.map(issue => issue.message).join('\n'),
    has_verified_solution: Boolean(response.solution),
    errors: response.diagnostics.map(issue => {
      const origin = issue.row_id ? model.provenance.rows[issue.row_id] : issue.variable_id ? model.provenance.variables[model.request.variables.findIndex(variable => variable.id === issue.variable_id)] : undefined
      return { node_id: origin?.nodeId, path: origin?.portKeys ?? issue.path, code: issue.code, message: issue.message }
    }),
  }
}
