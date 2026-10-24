import type { Node } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import type { ResourceEntry } from '@/common/types/registry'
import type { UnitExpression, UnitSnapshot } from '@/common/types/units'
import type { NetworkConfiguration } from '@/common/schemas/network.schema'
import type { CompiledNetwork } from '@/features/calculation/networkCompiler'
import { defaultResourceUnit } from '@/common/units/defaults'
import { flattenRecipeResources } from '@/common/utils/recipeResources'
import { buildResourceId } from '@/common/utils/resourceId'
import { deliveryResources, type DeliveryResource } from './resultSummary'

/** Display metadata owned by the accepted result, not by a mounted panel. */
export type ResultEvidence = {
  environment: UnitSnapshot
  recipes: Record<string, Pick<RecipeNodeData, 'machine_name' | 'system'>>
  resources: Record<string, { name?: string; unit?: UnitExpression; occupancyUnit?: UnitExpression; global: boolean }>
  targets: DeliveryResource[]
  occupancyUnits: Record<string, UnitExpression[]>
  netKinds: Record<string, 'flow' | 'capacity' | 'state'>
}

/** Capture display metadata before a compiled request leaves the client.
 * @param model - Immutable model used for this exact solve.
 * @param entries - Resource labels at request time.
 * @returns Detached evidence retained with an accepted result.
 */
export function compiledResultEvidence(model: CompiledNetwork, entries: Record<string, ResourceEntry>): ResultEvidence {
  const resources: ResultEvidence['resources'] = {}
  const targetKeys = new Set(model.provenance.variables.filter(origin => origin.kind === 'delivery').flatMap(origin => origin.portKeys))
  const targets = new Map<string, DeliveryResource>()
  for (const port of model.ports) {
    const unit = port.port.displayUnit ?? port.port.unit ?? defaultResourceUnit(port.port.category, port.port.id)
    const current = resources[port.resourceId]
    resources[port.resourceId] = { ...current, name: entries[port.resourceId]?.displayName, unit: current?.unit ?? unit, global: Boolean(current?.global || port.port.routing_mode === 'global') }
    if (targetKeys.has(port.key) && !targets.has(port.resourceId)) {
      targets.set(port.resourceId, { resourceId: port.resourceId, unit })
      resources[port.resourceId].unit = unit
    }
  }
  for (const recipe of Object.values(model.recipes)) for (const { resource } of recipe.bom_occupancy) {
    const id = buildResourceId(resource.category, resource.id)
    resources[id] = { ...resources[id], name: entries[id]?.displayName, occupancyUnit: resource.displayUnit ?? resource.unit, global: resources[id]?.global ?? false }
  }
  const occupancyUnits = Object.fromEntries(Object.entries(model.recipes).map(([id, recipe]) => [id, recipe.bom_occupancy.map(({ resource }) => resource.unit ?? defaultResourceUnit(resource.category, resource.id))]))
  return structuredClone({ environment: model.environment, recipes: Object.fromEntries(Object.entries(model.recipeDefinitions).map(([id, recipe]) => [id, { machine_name: recipe.machine_name, system: recipe.system }])), resources, targets: [...targets.values()], occupancyUnits, netKinds: Object.fromEntries(model.nets.map(net => [net.id, net.semantics])) })
}

/** Capture current document labels for empty-state presentation and direct result producers.
 * @param nodes - Current nodes.
 * @param recipes - Authoritative recipes.
 * @param configuration - Explicit delivery policies.
 * @param environment - Current units.
 * @param entries - Current labels.
 * @returns Detached metadata; production solves use compiledResultEvidence instead.
 */
export function documentResultEvidence(nodes: Node[], recipes: Record<string, RecipeNodeData>, configuration: NetworkConfiguration, environment: UnitSnapshot, entries: Record<string, ResourceEntry>): ResultEvidence {
  const resources: ResultEvidence['resources'] = {}
  for (const node of nodes) {
    const ports = node.type === 'recipeNode' && recipes[node.id] ? flattenRecipeResources(recipes[node.id]) : node.data.ports ?? []
    for (const port of ports) {
      const id = buildResourceId(port.category, port.id)
      resources[id] ??= { name: entries[id]?.displayName, unit: port.displayUnit ?? port.unit, global: port.routing_mode === 'global' }
    }
  }
  return structuredClone({ environment, recipes: Object.fromEntries(Object.entries(recipes).map(([id, recipe]) => [id, { machine_name: recipe.machine_name, system: recipe.system }])), resources, targets: deliveryResources(nodes, recipes, configuration), occupancyUnits: {}, netKinds: {} })
}
