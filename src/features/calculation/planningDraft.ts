import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import type { UnitSnapshot } from '@/common/types/units'
import { documentKey } from '@/common/utils/saveBaseline'
import { calculationDocumentKey } from './calculationSession'
import { NetworkConfigurationSchema, type NetworkConfiguration } from './networkConfig'

/** Model data whose semantics determine the meaning of a planning draft. */
export interface PlanningInputs {
  nodes: Node[]
  edges: Edge[]
  recipes: Record<string, RecipeNodeData>
  environment: UnitSnapshot
  configuration: NetworkConfiguration
}

/** Frozen editing baseline; a node scope never owns another node's policy. */
export interface PlanningBaseline {
  nodeId?: string
  key: string
  inputs: PlanningInputs
}

/** Check persistent JSON port ownership without matching ID substrings.
 * @param address - Serialized node and port pair.
 * @param nodeId - Exact owning node identity.
 * @returns Whether this address belongs to the node.
 */
function ownsPort(address: string, nodeId: string): boolean {
  try {
    const pair: unknown = JSON.parse(address)
    return Array.isArray(pair) && pair.length === 2 && pair[0] === nodeId
  } catch { return false }
}

/** Extract only the policy fields edited by the current scope.
 * @param configuration - Complete document policy.
 * @param nodeId - Optional focused object; omitted means the entire document.
 * @returns The scope's independent comparison shape.
 */
export function planningScope(configuration: NetworkConfiguration, nodeId?: string): NetworkConfiguration {
  if (!nodeId) return configuration
  return { version: 1,
    machines: configuration.machines[nodeId] ? { [nodeId]: configuration.machines[nodeId] } : {},
    ports: Object.fromEntries(Object.entries(configuration.ports).filter(([address]) => ownsPort(address, nodeId))),
  }
}

/** Compare editor meaning while ignoring selection, results and canvas layout.
 * @param inputs - Current graph and planning inputs.
 * @param nodeId - Optional object being edited.
 * @returns Stable semantic baseline key.
 */
function planningKey(inputs: PlanningInputs, nodeId?: string): string {
  const nodes = (nodeId ? inputs.nodes.filter(node => node.id === nodeId) : inputs.nodes).slice().sort((a, b) => a.id.localeCompare(b.id))
  const edges = (nodeId ? inputs.edges.filter(edge => edge.source === nodeId || edge.target === nodeId) : inputs.edges).slice().sort((a, b) => a.id.localeCompare(b.id))
  const recipes = nodeId ? Object.fromEntries(Object.entries(inputs.recipes).filter(([id]) => id === nodeId)) : inputs.recipes
  return documentKey(JSON.parse(calculationDocumentKey(nodes, edges, recipes, planningScope(inputs.configuration, nodeId), inputs.environment)))
}

/** Capture the meanings and values shown throughout one editing session.
 * @param inputs - Current authoritative data.
 * @param nodeId - Optional focused object.
 * @returns Independent baseline for conflict detection and reset.
 */
export function capturePlanningBaseline(inputs: PlanningInputs, nodeId?: string): PlanningBaseline {
  return { nodeId, key: planningKey(inputs, nodeId), inputs: structuredClone(inputs) }
}

/** Detect deleted objects and meaningful concurrent changes before applying a draft.
 * @param baseline - Frozen editing context.
 * @param current - Latest authoritative model.
 * @returns A failure code, or null when the scope is unchanged.
 */
export function planningConflict(baseline: PlanningBaseline, current: PlanningInputs): 'missing' | 'conflict' | null {
  if (baseline.nodeId && !current.nodes.some(node => node.id === baseline.nodeId)) return 'missing'
  return planningKey(current, baseline.nodeId) === baseline.key ? null : 'conflict'
}

/** Validate and merge a draft without overwriting unrelated concurrent edits.
 * @param baseline - Frozen source context.
 * @param draft - Proposed configuration; node editing may only commit its own scope.
 * @param current - Current model read immediately before the transaction.
 * @returns A validated complete configuration, or a located editing failure.
 */
export function preparePlanningCommit(baseline: PlanningBaseline, draft: NetworkConfiguration, current: PlanningInputs):
  { ok: true; configuration: NetworkConfiguration } | { ok: false; reason: 'missing' | 'conflict' | 'invalid'; message?: string } {
  const conflict = planningConflict(baseline, current)
  if (conflict) return { ok: false, reason: conflict }
  const nodeId = baseline.nodeId
  const scoped = planningScope(draft, nodeId)
  const merged = nodeId ? {
    ...current.configuration,
    machines: { ...Object.fromEntries(Object.entries(current.configuration.machines).filter(([id]) => id !== nodeId)), ...scoped.machines },
    ports: { ...Object.fromEntries(Object.entries(current.configuration.ports).filter(([address]) => !ownsPort(address, nodeId))), ...scoped.ports },
  } : draft
  const parsed = NetworkConfigurationSchema.safeParse(merged)
  return parsed.success ? { ok: true, configuration: parsed.data } : { ok: false, reason: 'invalid', message: parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('\n') }
}
