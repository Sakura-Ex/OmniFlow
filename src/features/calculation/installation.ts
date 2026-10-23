import type { CompiledNetwork } from './networkCompiler'
import type { LPResponse } from '@/common/types/lp'
import type { CalculationNodeResult, StartupChecklist } from '@/common/types/api'
import type { RecipeNodeData } from '@/common/types/recipe'

/** Recommend integer installation only when verified capacity evidence permits snapping.
 * @param value - Verified operating equivalents.
 * @param column - Operation variable column.
 * @param model - Original compiled mathematical model.
 * @param response - Verified solution and residual evidence.
 * @returns Integer installation recommendation within numerical evidence.
 */
export function recommendInstalled(value: number, column: number, model: CompiledNetwork, response: LPResponse): number {
  if (value <= 0) return 0
  const nearest = Math.round(value)
  const delta = Math.abs(value - nearest)
  const evidence = response.solution!.feasibility
  const bound = evidence.bound_slacks[column]
  const safe = delta <= (bound?.tolerance ?? 0) && (['equalities', 'inequalities'] as const).every(kind => model.request[kind].entries.filter(entry => entry.col === column).every(entry => {
    const row = evidence.row_residuals.find(item => item.row_id === model.request[kind].row_ids[entry.row])
    return row !== undefined && Math.abs(entry.value) * delta <= row.tolerance
  }))
  return Math.max(0, safe ? nearest : Math.ceil(value))
}

/** Inspect active material cycles without claiming dynamic startup feasibility.
 * @param model - Final ports, operating variables and recipe evidence.
 * @param results - Verified operation and installation presentation.
 * @param recipes - Original fixed startup declarations.
 * @returns Separate startup checklist requiring user confirmation.
 */
export function buildStartupChecklist(model: CompiledNetwork, results: Record<string, CalculationNodeResult>, recipes: Record<string, RecipeNodeData>): StartupChecklist {
  const active = new Set(model.provenance.variables.flatMap(origin => origin.nodeId && (origin.kind === 'operation' ? (results[origin.nodeId]?.operating_equivalent ?? 0) > 0 : origin.kind === 'splitter' && model.ports.some(port => port.nodeId === origin.nodeId && port.direction === 'input' && (results[origin.nodeId!]?.port_throughputs?.[port.portId] ?? 0) > 0)) ? [origin.nodeId] : []))
  const adjacency = new Map([...active].map(id => [id, new Set<string>()]))
  for (const net of model.nets.filter(net => net.semantics === 'flow')) {
    const ports = model.ports.filter(port => port.netId === net.id && active.has(port.nodeId) && port.coefficient > 0)
    for (const producer of ports.filter(port => port.direction === 'output')) for (const consumer of ports.filter(port => port.direction === 'input')) adjacency.get(producer.nodeId)!.add(consumer.nodeId)
  }
  const cycles: string[][] = [], visited = new Set<string>(), stack: string[] = [], onStack = new Set<string>()
  const visit = (id: string) => {
    visited.add(id); stack.push(id); onStack.add(id)
    for (const target of adjacency.get(id) ?? []) {
      if (!visited.has(target)) visit(target)
      else if (onStack.has(target)) {
        const cycle = stack.slice(stack.indexOf(target)).sort()
        if (!cycles.some(previous => JSON.stringify(previous) === JSON.stringify(cycle))) cycles.push(cycle)
      }
    }
    stack.pop(); onStack.delete(id)
  }
  for (const id of active) if (!visited.has(id)) visit(id)
  const catalysts = Object.entries(model.recipes).flatMap(([nodeId, payload]) => active.has(nodeId) ? payload.bom_occupancy.map(entry => ({ nodeId, resourceId: `${entry.resource.category}:${entry.resource.id}`, amount: entry.amount * (entry.resource.occupancy_basis === 'global' ? 1 : results[nodeId]?.planned_installed ?? 0) })) : [])
  const preheat = Object.entries(recipes).flatMap(([nodeId, recipe]) => active.has(nodeId) && typeof recipe.metadata.startup_requirement === 'string' && recipe.metadata.startup_requirement.trim() ? [{ nodeId, requirement: recipe.metadata.startup_requirement }] : [])
  return { status: 'needs_confirmation', catalysts, cycles, preheat }
}
