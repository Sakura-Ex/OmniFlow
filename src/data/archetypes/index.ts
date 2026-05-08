import type { MachineSystem, RecipeNodeData } from '../../types/recipe'
import type { MachineArchetype, Resource, RoutingMode, UtilityDef } from '../../types/types'
import { customGenericArchetype } from './customGeneric'
import { fluidNetworkedArchetype } from './fluidNetworked'
import { gtElectricArchetype } from './gtElectric'
import { deriveUtilityAmount } from './shared'

// Add new archetypes by creating a new file and registering it here.
export const machineArchetypeRegistry: Record<string, MachineArchetype> = {
  [customGenericArchetype.id]: customGenericArchetype,
  [gtElectricArchetype.id]: gtElectricArchetype,
  [fluidNetworkedArchetype.id]: fluidNetworkedArchetype,
}

export const machineArchetypes: MachineArchetype[] = Object.values(machineArchetypeRegistry)

export function getMachineArchetype(archetypeId?: string | null): MachineArchetype {
  if (archetypeId && machineArchetypeRegistry[archetypeId]) {
    return machineArchetypeRegistry[archetypeId]
  }
  return machineArchetypeRegistry.custom_generic
}

export function getDefaultArchetypeIdForSystem(system?: MachineSystem): string {
  if (system === 'gregtech') return 'gt_electric'
  if (system === 'thermal') return 'fluid_networked'
  return 'custom_generic'
}

export function applyArchetypeToInputs(
  inputs: Resource[],
  archetypeId: string,
  metadata: RecipeNodeData['metadata']
): { materials: Resource[]; utilityInputs: Resource[]; utilityOutputs: Resource[] } {
  const archetype = getMachineArchetype(archetypeId)
  const utilityEntries = Object.entries(archetype.fixed_utilities)

  if (utilityEntries.length === 0) {
    return {
      materials: inputs.filter((entry) => !entry.is_utility),
      utilityInputs: [],
      utilityOutputs: [],
    }
  }

  const normalizedMaterials = inputs.filter((entry) => !entry.is_utility)
  const existingByCategoryId = new Map(inputs.map((entry) => [`${entry.category}:${entry.id}`, entry]))

  const utilityInputs: Resource[] = []
  const utilityOutputs: Resource[] = []

  for (const [utilityId, def] of utilityEntries) {
    const resourceId = def.resource_id ?? (def.type.includes(':') ? def.type.split(':').pop()! : utilityId)
    const key = `${def.type}:${resourceId}`
    const existing = existingByCategoryId.get(key)
    const defaultAmount = deriveUtilityAmount(def.type, metadata, existing?.amount ?? 0)
    const routingMode: RoutingMode = existing?.routing_mode ?? def.routing_mode

    const resource: Resource = {
      category: def.type,
      id: resourceId,
      amount: typeof existing?.amount === 'number' ? existing.amount : defaultAmount,
      time_base: def.time_base ?? existing?.time_base ?? 'per_cycle',
      probability: existing?.probability,
      _uid: existing?._uid ?? `utility-${utilityId}`,
      is_utility: true,
      utility_type: def.type,
      amount_mutable: def.amount_mutable,
      routing_mode: routingMode,
      routing_locked: def.routing_locked,
    }

    if (def.io === 'output') {
      utilityOutputs.push(resource)
    } else {
      utilityInputs.push(resource)
    }
  }

  return { materials: normalizedMaterials, utilityInputs, utilityOutputs }
}

export function getUtilityDefForResource(
  resource: Resource,
  archetypeId: string
): UtilityDef | null {
  if (!resource.is_utility) return null
  const archetype = getMachineArchetype(archetypeId)
  return Object.values(archetype.fixed_utilities).find(
    (def) => def.type === resource.category && (def.resource_id ?? def.type.split(':').pop()) === resource.id
  ) ?? null
}
