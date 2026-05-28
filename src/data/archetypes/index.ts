import type { MachineSystem, RecipeNodeData } from '@/common/types/recipe'
import type { MachineArchetype, Resource, RoutingMode, UtilityDef } from '@/common/types/resource'
import { customGenericArchetype } from './customGeneric'
import { fluidNetworkedArchetype } from './fluidNetworked'
import { gtElectricArchetype } from './gtElectric'
import { deriveUtilityAmount } from './shared'
import { getId, getCategory } from '@/common/utils/resourceId'

/** @description Registry of all registered machine archetypes, keyed by their ID. */
export const machineArchetypeRegistry: Record<string, MachineArchetype> = {
  [customGenericArchetype.id]: customGenericArchetype,
  [gtElectricArchetype.id]: gtElectricArchetype,
  [fluidNetworkedArchetype.id]: fluidNetworkedArchetype,
}

/** @description Flat array of all registered machine archetypes. */
export const machineArchetypes: MachineArchetype[] = Object.values(machineArchetypeRegistry)

/**
 * Looks up a machine archetype by its ID. Falls back to `custom_generic` when
 * the ID is missing or unknown.
 *
 * @param archetypeId The archetype ID to look up.
 * @returns The matching {@link MachineArchetype}, or the default `custom_generic` archetype.
 */
export function getMachineArchetype(archetypeId?: string | null): MachineArchetype {
  if (archetypeId && machineArchetypeRegistry[archetypeId]) {
    return machineArchetypeRegistry[archetypeId]
  }
  return machineArchetypeRegistry.custom_generic
}

/**
 * Return the default archetype ID for a given machine system.
 * @param system - The machine system identifier.
 * @returns The corresponding default archetype ID.
 */
export function getDefaultArchetypeIdForSystem(system?: MachineSystem): string {
  if (system === 'gregtech') return 'gt_electric'
  if (system === 'thermal') return 'fluid_networked'
  return 'custom_generic'
}

/**
 * Applies an archetype's fixed utilities to the given resource inputs,
 * separating material inputs from utility inputs/outputs.
 *
 * @param inputs      Raw resource list (may contain both materials and utilities).
 * @param archetypeId The archetype ID to apply.
 * @param metadata    Recipe metadata used to derive utility amounts.
 * @returns An object with three arrays: `materials`, `utilityInputs` and
 *          `utilityOutputs`.
 */
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
    const resourceId = def.resource_id ?? (def.type.includes(':') ? getId(def.type) : utilityId)
    const key = def.type.includes(':') ? def.type : `${def.type}:${resourceId}`
    const existing = existingByCategoryId.get(key)
    const defaultAmount = deriveUtilityAmount(def.type, metadata, existing?.amount ?? 0)
    const routingMode: RoutingMode = existing?.routing_mode ?? def.routing_mode

    const resource: Resource = {
      category: def.type.includes(':') ? getCategory(def.type) : def.type,
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

/**
 * Finds the matching utility definition for a given resource and archetype.
 *
 * @param resource    The resource to look up (must have `is_utility === true`).
 * @param archetypeId The archetype ID to search within.
 * @returns The matching {@link UtilityDef}, or `null` if not found.
 */
export function getUtilityDefForResource(
  resource: Resource,
  archetypeId: string
): UtilityDef | null {
  if (!resource.is_utility) return null
  const archetype = getMachineArchetype(archetypeId)
  return Object.values(archetype.fixed_utilities).find(
    (def) => getCategory(def.type) === resource.category && (def.resource_id ?? getId(def.type)) === resource.id
  ) ?? null
}
