import type { Node } from 'reactflow'
import type { CalculateResponse } from '@/common/types/api'
import type { RecipeNodeData } from '@/common/types/recipe'
import type { Resource } from '@/common/types/resource'
import type { UnitExpression } from '@/common/types/units'
import type { NetworkConfiguration } from '@/common/schemas/network.schema'
import { flattenRecipeResources } from '@/common/utils/recipeResources'
import { buildResourceId } from '@/common/utils/resourceId'
import { parseNormalizedKey } from '@/common/utils/resourceId'
import { UnitSystem } from '@/common/units/UnitSystem'
import { defaultResourceUnit } from '@/common/units/defaults'
import { buildUnitSuffix } from '@/features/resource-registry/registry.units'
import { formatSimpleRate } from '@/common/utils/rateFormat'
import type { ResultEvidence } from './resultEvidence'

/** Presentation metadata for explicit delivery resources, never inferred graph leaves. */
export type DeliveryResource = { resourceId: string; unit?: UnitExpression }

/** Select authoritative delivery totals without adding net or endpoint copies.
 * @param result - Accepted evidence or no result.
 * @param targets - Explicit target metadata captured with the evidence.
 * @returns Stable resource rows; missing results retain unknown quantities.
 */
export function deliverySummary(result: CalculateResponse | null, targets: DeliveryResource[]) {
  const resources = [...new Set([...targets.map(target => target.resourceId), ...Object.keys(result?.system_outputs ?? {})])].sort()
  return resources.map(resourceId => {
    const value = result?.system_outputs?.[resourceId]
    return { ...targets.find(target => target.resourceId === resourceId), resourceId, amount: typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined }
  })
}

/** Resolve delivery identities once per resource in stable document order.
 * @param nodes - Document nodes.
 * @param recipes - Authoritative recipes.
 * @param configuration - Explicit boundary policies.
 * @returns Unique delivery resources and their display units.
 */
export function deliveryResources(nodes: Node[], recipes: Record<string, RecipeNodeData>, configuration: NetworkConfiguration): DeliveryResource[] {
  const resources = new Map<string, DeliveryResource>()
  for (const node of nodes) {
    const recipe = recipes[node.id]
    const ports: Resource[] = node.type === 'recipeNode' && recipe
      ? flattenRecipeResources(recipe)
      : node.data.ports ?? []
    for (const port of ports) {
      const policy = configuration.ports[JSON.stringify([node.id, port.portId])]
      if (policy?.boundary?.kind !== 'delivery' || policy.semantics.kind !== 'flow') continue
      const resourceId = buildResourceId(port.category, port.id)
      if (!resources.has(resourceId)) resources.set(resourceId, { resourceId, unit: port.displayUnit ?? port.unit })
    }
  }
  return [...resources.values()]
}

/** Build installation totals exclusively from the verified plan, including retained nodes.
 * @param result - Last accepted calculation, or no evidence.
 * @param recipes - Display names captured with the result.
 * @returns Installation total and type rows; absent evidence stays absent.
 */
export function installationSummary(result: CalculateResponse | null, recipes: Record<string, Pick<RecipeNodeData, 'machine_name' | 'system'>>) {
  if (!result) return { total: null, types: [] }
  // A missing recipe plan is missing evidence, not a zero-machine solution.
  if (Object.keys(recipes).some(nodeId => result.node_results?.[nodeId]?.planned_installed === undefined)) return { total: null, types: [] }
  const types = new Map<string, number>()
  let total = 0
  for (const [nodeId, node] of Object.entries(result.node_results ?? {})) {
    if (node.planned_installed === undefined) {
      if (node.operating_equivalent !== undefined || node.recommended_installed !== undefined || node.fixed_installed !== undefined) return { total: null, types: [] }
      continue
    }
    if (!Number.isInteger(node.planned_installed) || node.planned_installed < 0) return { total: null, types: [] }
    const recipe = recipes[nodeId]
    const name = recipe ? `${recipe.machine_name} · ${recipe.system}` : nodeId
    types.set(name, (types.get(name) ?? 0) + node.planned_installed)
    total += node.planned_installed
  }
  return { total, types: [...types].map(([name, count]) => ({ name, count })) }
}

/** Format canonical evidence using its captured unit environment.
 * @param resourceId - Qualified resource identity.
 * @param amount - Canonical quantity, or missing evidence.
 * @param evidence - Metadata captured for the result.
 * @param kind - Flow and installation occupancy use different dimensions.
 * @returns Readable quantity and unit; invalid metadata stays visibly unknown.
 */
export function resultQuantity(resourceId: string, amount: number | undefined, evidence: ResultEvidence, kind: 'flow' | 'occupancy' = 'flow'): { value: string; unit: string; unavailable: boolean } {
  const { category, id } = parseNormalizedKey(resourceId)
  const metadata = evidence.resources[resourceId]
  const expression = (kind === 'occupancy' ? metadata?.occupancyUnit : metadata?.unit) ?? defaultResourceUnit(category, id)
  try {
    const units = new UnitSystem(evidence.environment)
    const unit = kind === 'flow' ? buildUnitSuffix(expression, 'rate_per_sec', units) : units.expression(expression).toString()
    const valid = amount !== undefined && Number.isFinite(amount) && amount >= 0
    const value = !valid ? '—' : formatSimpleRate(kind === 'flow' ? units.fromRate(amount, expression, 'rate_per_sec') : amount / units.registry.normalize(expression).scale)
    return { value, unit, unavailable: false }
  } catch {
    return { value: '—', unit: '?', unavailable: true }
  }
}

/** Select result-backed internal resources without inventing a zero throughput.
 * @param result - Accepted network evidence.
 * @returns Stable resource identities with no external exchange in this result.
 */
export function internalResultResources(result: CalculateResponse): string[] {
  const external = new Set([...Object.keys(result.system_inputs ?? {}), ...Object.keys(result.system_outputs ?? {}), ...Object.keys(result.system_spills ?? {})])
  return [...new Set((result.net_summaries ?? []).map(net => net.resourceId))].filter(id => !external.has(id)).sort()
}

/** Convert declared startup occupancy using the exact source declaration unit.
 * @param result - Accepted startup checklist.
 * @param index - Checklist row; repeated resource declarations remain distinct.
 * @param evidence - Original compiled occupancy units.
 * @returns Canonical occupancy, or unknown if the source unit is unavailable.
 */
export function startupCanonicalAmount(result: CalculateResponse, index: number, evidence: ResultEvidence): number | undefined {
  const rows = result.startup?.catalysts ?? []
  const row = rows[index]
  if (!row) return undefined
  const occurrence = rows.slice(0, index).filter(item => item.nodeId === row.nodeId).length
  const unit = evidence.occupancyUnits[row.nodeId]?.[occurrence]
  if (!unit) return undefined
  try { return row.amount * new UnitSystem(evidence.environment).registry.normalize(unit).scale } catch { return undefined }
}
