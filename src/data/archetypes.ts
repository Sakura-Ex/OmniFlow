import type { MachineSystem, RecipeNodeData } from '../types/recipe'
import type { MachineArchetype, Resource, ResourceCategory, RoutingMode, UtilityDef } from '../types/types'

const utilityCategoryHints: Array<{ pattern: RegExp; category: ResourceCategory }> = [
  { pattern: /eu|rf|power|energy|voltage/i, category: 'energy' },
  { pattern: /water|steam|fluid|coolant|lava/i, category: 'fluid' },
  { pattern: /stress/i, category: 'stress' },
  { pattern: /heat|thermal/i, category: 'heat' },
]

function inferUtilityCategory(type: string): ResourceCategory {
  for (const hint of utilityCategoryHints) {
    if (hint.pattern.test(type)) return hint.category
  }
  return 'item'
}

export const machineArchetypeRegistry: Record<string, MachineArchetype> = {
  custom_generic: {
    id: 'custom_generic',
    name: '通用自定义底盘',
    fixed_utilities: {},
    default_modifiers: [],
  },
  gt_electric: {
    id: 'gt_electric',
    name: '格雷电力机器底盘',
    fixed_utilities: {
      'gt:eu': {
        type: 'gt:eu',
        amount_mutable: true,
        routing_mode: 'global',
        routing_locked: true,
      },
    },
    default_modifiers: ['gt_overclock'],
  },
  fluid_networked: {
    id: 'fluid_networked',
    name: '流体公用底盘',
    fixed_utilities: {
      'utility:water': {
        type: 'utility:water',
        amount_mutable: true,
        routing_mode: 'global',
        routing_locked: false,
      },
    },
    default_modifiers: [],
  },
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

function deriveUtilityAmount(utilityId: string, metadata: RecipeNodeData['metadata'], fallback: number): number {
  if (utilityId === 'gt:eu' && typeof metadata.eu_per_tick === 'number') return metadata.eu_per_tick
  if (utilityId === 'thermal:rf' && typeof metadata.rf_per_tick === 'number') return metadata.rf_per_tick
  return fallback
}

export function applyArchetypeToInputs(
  inputs: Resource[],
  archetypeId: string,
  metadata: RecipeNodeData['metadata']
): Resource[] {
  const archetype = getMachineArchetype(archetypeId)
  const utilityEntries = Object.entries(archetype.fixed_utilities)

  if (utilityEntries.length === 0) {
    return inputs.filter((entry) => !entry.is_utility)
  }

  const normalizedMaterials = inputs.filter((entry) => !entry.is_utility)
  const existingById = new Map(inputs.map((entry) => [entry.id, entry]))

  const normalizedUtilities = utilityEntries.map(([utilityId, def]) => {
    const existing = existingById.get(utilityId)
    const defaultAmount = deriveUtilityAmount(utilityId, metadata, existing?.amount ?? 0)
    const routingMode: RoutingMode = existing?.routing_mode ?? def.routing_mode

    return {
      category: inferUtilityCategory(def.type),
      id: utilityId,
      amount: typeof existing?.amount === 'number' ? existing.amount : defaultAmount,
      probability: existing?.probability,
      _uid: existing?._uid ?? `utility-${utilityId}`,
      is_utility: true,
      utility_type: def.type,
      amount_mutable: def.amount_mutable,
      routing_mode: routingMode,
      routing_locked: def.routing_locked,
    } satisfies Resource
  })

  return normalizedMaterials.concat(normalizedUtilities)
}

export function getUtilityDefForResource(
  resource: Resource,
  archetypeId: string
): UtilityDef | null {
  if (!resource.is_utility) return null
  const archetype = getMachineArchetype(archetypeId)
  return archetype.fixed_utilities[resource.id] ?? null
}
