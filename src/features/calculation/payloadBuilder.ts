import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import type { UnitSnapshot } from '@/common/types/units'
import type { NormalizedResource } from '@/common/types/resource'
import { runModifierPipeline } from '@/features/modifier/modifier.pipeline'
import { UnitSystem } from '@/common/units/UnitSystem'
import { DEFAULT_UNIT_SNAPSHOT, defaultResourceUnit } from '@/common/units/defaults'
import { portIdentity } from '@/common/utils/ports'
import { buildTopologicalNets, portKey } from './topology'

/** Legacy API adapter; the v2 mathematical model is introduced in PR-07. */
export interface CalculationPayload {
  payloadNodes: Array<{ id: string; type: string; data: Record<string, unknown> }>
  payloadEdges: Array<{ source: string; target: string; sourceHandle: string | null | undefined; targetHandle: string | null | undefined }>
  globalInputSet: Set<string>
  globalOutputSet: Set<string>
}

/**
 * Stable subnode identity survives endpoint reordering.
 * @returns Stable backend endpoint variable identity.
 * @param nodeId - Persistent node identity.
 * @param portId - Persistent port identity within the node.
 */
export const endpointSubNodeId = (nodeId: string, portId: string): string => `${nodeId}__port:${encodeURIComponent(portId)}`

/**
 * Route final ports individually before summing coefficients on a shared net.
 * @returns Current API payload with per-port routing and aggregated net coefficients.
 * @param nodes - Canvas nodes.
 * @param edges - Canvas edges with persistent port handles.
 * @param recipeStore - Authoritative recipes keyed by node identity.
 * @param environment - Serializable environment, definitions and prefixes.
 */
export function buildCalculationPayload(nodes: Node[], edges: Edge[], recipeStore: Record<string, RecipeNodeData>, environment: UnitSnapshot = DEFAULT_UNIT_SNAPSHOT): CalculationPayload {
  const units = new UnitSystem(environment)
  const topology = buildTopologicalNets(nodes, edges, new Map(Object.entries(recipeStore)), environment)
  const payloadNodes: CalculationPayload['payloadNodes'] = []
  const endpointIds = new Map<string, string>()
  const globalInputSet = new Set<string>(), globalOutputSet = new Set<string>()
  for (const p of topology.ports) {
    if (p.port.routing_mode === 'global') (p.direction === 'input' ? globalInputSet : globalOutputSet).add(p.resourceId)
  }
  const aggregate = (nodeId: string, ports: NormalizedResource[]) => {
    const result: Record<string, number> = {}
    for (const port of ports) {
      const net = topology.lookup.get(portKey(nodeId, portIdentity(port)))!
      result[net] = (result[net] ?? 0) + port.amount
    }
    return result
  }
  for (const node of nodes) {
    if (node.type === 'recipeNode') {
      const recipe = recipeStore[node.id]
      if (!recipe) throw new Error(`Missing recipe: ${node.id}`)
      // Recompute from one captured environment; stored previews are not solver inputs.
      const payload = runModifierPipeline(recipe, environment)
      if (!payload.eligibility.eligible) throw new Error(`${recipe.machine_name}: ${payload.eligibility.reasons.join('; ')}`)
      payloadNodes.push({ id: node.id, type: node.type, data: {
        recipe_id: recipe.recipe_id || node.id, machine_name: recipe.machine_name, system: recipe.system,
        inputs: aggregate(node.id, [...payload.recipe_inputs, ...payload.utility_inputs]),
        outputs: aggregate(node.id, [...payload.recipe_outputs, ...payload.utility_outputs]),
        mode: recipe.mode ?? 'auto', manual_machines: recipe.manual_machines, metadata: recipe.metadata,
      } })
    } else if (node.type === 'sourceNode' || node.type === 'targetNode') {
      const ports = topology.ports.filter((p) => p.nodeId === node.id)
      if (!ports.length) throw new Error(`Endpoint ${node.id} has no ports`)
      for (const p of ports) {
        if (!p.port.id.trim()) throw new Error(`Endpoint ${node.id}/${p.portId} has no resource`)
        const id = endpointSubNodeId(node.id, p.portId)
        endpointIds.set(portKey(node.id, p.portId), id)
        payloadNodes.push({ id, type: node.type, data: {
          id: topology.lookup.get(portKey(node.id, p.portId)),
          amount: units.toRate(p.port.amount, p.port.unit ?? defaultResourceUnit(p.port.category, p.port.id), 'rate_per_sec', 1),
          mode: node.data.mode ?? (node.type === 'sourceNode' ? 'infinite' : 'maximize'),
        } })
      }
    } else throw new Error(`Unsupported node type: ${node.type}`)
  }
  return {
    payloadNodes,
    payloadEdges: edges.map((e) => ({ source: endpointIds.get(portKey(e.source, e.sourceHandle!)) ?? e.source, target: endpointIds.get(portKey(e.target, e.targetHandle!)) ?? e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })),
    globalInputSet, globalOutputSet,
  }
}
