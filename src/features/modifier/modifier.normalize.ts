import type { RecipeNodeData, RecipePort, ActiveModifier } from '@/common/types/recipe'
import type { Resource, ResourceCategory, RoutingMode } from '@/common/types/resource'
import { createDefaultModifierState } from './modifier.state'
import { getModifierById } from './modifier.registry'
import { applyArchetypeToInputs, getDefaultArchetypeIdForSystem, getMachineArchetype } from '@/data/archetypes'
import { identifyPorts } from '@/common/utils/ports'

/**
 * Normalise the duration from a recipe node, preferring `base_duration_seconds` and falling back to `duration_seconds`.
 * @param data - The recipe node data.
 * @returns A non-negative duration in seconds.
 */
function normalizeDurationSeconds(data: RecipeNodeData): number {
  if (typeof data.base_duration_seconds === 'number') return data.base_duration_seconds
  if (typeof data.duration_seconds === 'number') return data.duration_seconds
  return 0
}

/**
 * Coerce a raw value into a valid resource category string.
 * @param raw - The raw category value.
 * @returns A category string, defaulting to `'item'`.
 */
function normalizeCategory(raw: unknown): ResourceCategory {
  if (typeof raw === 'string' && raw.length > 0) return raw
  return 'item'
}

/**
 * Preserve numeric input so invalid amounts fail compilation explicitly.
 * @param raw - The raw amount value.
 * @returns Numeric input, including invalid values for later validation.
 */
function normalizeAmount(raw: unknown): number {
  const amount = Number(raw)
  return amount
}

/**
 * Normalize a partial port or resource object into a fully-shaped {@link Resource}.
 *
 * Fills in defaults for `category`, `amount`, `routing_mode`, and other optional fields.
 *
 * @param port - A partial resource or recipe port object.
 * @returns A fully-typed {@link Resource} with sensible defaults for missing fields.
 */
export function toResource(port: Partial<RecipePort> | Partial<Resource>): Resource {
  const routingRaw = (port as Partial<Resource>).routing_mode
  const routing_mode: RoutingMode = routingRaw === 'global' ? 'global' : 'wired'

  return {
    portId: port.portId,
    unit: port.unit,
    displayUnit: port.displayUnit,
    scaling: port.scaling,
    category: normalizeCategory((port as Partial<Resource>).category),
    id: String((port as Partial<Resource>).id ?? ''),
    amount: normalizeAmount((port as Partial<Resource>).amount),
    time_base: (port as Partial<Resource>).time_base,
    consumable: typeof (port as Partial<Resource>).consumable === 'boolean' ? (port as Partial<Resource>).consumable : undefined,
    probability: typeof (port as Partial<Resource>).probability === 'number' ? (port as Partial<Resource>).probability : undefined,
    routing_mode,
    routing_locked: Boolean((port as Partial<Resource>).routing_locked),
    is_utility: Boolean((port as Partial<Resource>).is_utility),
    utility_type: typeof (port as Partial<Resource>).utility_type === 'string' ? (port as Partial<Resource>).utility_type : undefined,
    amount_mutable: typeof (port as Partial<Resource>).amount_mutable === 'boolean' ? (port as Partial<Resource>).amount_mutable : undefined,
    _uid: typeof (port as Partial<Resource>)._uid === 'string' ? (port as Partial<Resource>)._uid : undefined,
  }
}

/**
 * Normalize raw recipe node data into a complete, well-shaped {@link RecipeNodeData}.
 *
 * Responsibilities:
 * - Resolves `base_inputs` / `base_outputs` from legacy `inputs` / `outputs` fields.
 * - Applies the machine archetype to derive utility inputs/outputs.
 * - Upgrades legacy modifier arrays to the `ActiveModifier[]` shape.
 * - Injects default modifiers from the archetype.
 * - Rejects unknown, incompatible or excessive modifier placements.
 * - Resolves hardware specs from archetype traits and user overrides.
 *
 * @param data - The raw recipe node data, possibly with legacy or missing fields.
 * @returns A fully-normalized {@link RecipeNodeData} ready for the modifier pipeline.
 */
export function ensureRecipeDataShape(data: RecipeNodeData): RecipeNodeData {
  const baseInputsRaw = (data.base_inputs ?? data.inputs) ?? []
  const baseOutputsRaw = (data.base_outputs ?? data.outputs) ?? []
  const archetype_id = data.archetype_id ?? getDefaultArchetypeIdForSystem(data.system)

  const rawInputs = baseInputsRaw.map(toResource)
  const { materials, utilityInputs, utilityOutputs } = applyArchetypeToInputs(rawInputs, archetype_id, data.metadata ?? {})
  const base_inputs = materials

  const mergeUtilities = (defaults: Resource[], existing: Resource[]): Resource[] => {
    const consumed = new Set<Resource>()
    const merged = defaults.map((utility) => {
      const match = existing.find((port) => port._uid === utility._uid && !consumed.has(port))
        ?? existing.find((port) => port.utility_type === utility.utility_type && !consumed.has(port))
      if (!match) return utility
      consumed.add(match)
      return { ...utility, ...match }
    })
    return [...merged, ...existing.filter((port) => !consumed.has(port))]
  }
  const base_utility_inputs = mergeUtilities(utilityInputs, data.base_utility_inputs ?? [])
  const base_utility_outputs = mergeUtilities(utilityOutputs, data.base_utility_outputs ?? [])
  const base_outputs = baseOutputsRaw.map(toResource).map((entry) => ({
    ...entry,
    routing_mode: (entry.routing_mode === 'global' ? 'global' : 'wired') as RoutingMode,
    routing_locked: Boolean(entry.routing_locked),
  }))
  const base_duration_seconds = normalizeDurationSeconds(data)
  const archetype = getMachineArchetype(archetype_id)

  const userModifiers: ActiveModifier[] = (() => {
    const raw = data.active_modifiers ?? []
    if (raw.length === 0) return []
    if (typeof raw[0] === 'object' && 'instance_id' in raw[0]) return raw as ActiveModifier[]

    const oldStates = data.modifier_states ?? {}
    return (raw as unknown as string[]).map((defId, idx) => {
      const state = oldStates[String(idx)] ?? oldStates[defId] ?? createDefaultModifierState(defId)
      return { instance_id: `legacy:${defId}:${idx}`, definition_id: defId, uiState: state }
    })
  })()

  const userDefIds = new Set(userModifiers.map((m) => m.definition_id))
  const missingDefaults = (archetype.default_modifiers ?? [])
    .filter((d) => !userDefIds.has(d))
    .map((d) => ({
      instance_id: `default:${d}`,
      definition_id: d,
      uiState: createDefaultModifierState(d),
    }))
  let active_modifiers: ActiveModifier[] = [...userModifiers, ...missingDefaults]

  active_modifiers = active_modifiers.filter((m) => {
    const modifier = getModifierById(m.definition_id)
    if (!modifier) throw new Error(`Unknown modifier: ${m.definition_id}`)
    const allowed = modifier.compatible_archetypes
    if (!allowed || allowed.length === 0) return true
    if (!allowed.includes(archetype_id)) throw new Error(`Incompatible modifier: ${m.definition_id}`)
    return true
  })

  const occurrenceCount = new Map<string, number>()
  active_modifiers = active_modifiers.filter((m) => {
    const modifier = getModifierById(m.definition_id)
    const maxP = modifier?.max_placements ?? 1
    const count = occurrenceCount.get(m.definition_id) ?? 0
    occurrenceCount.set(m.definition_id, count + 1)
    if (count >= maxP) throw new Error(`Too many modifier placements: ${m.definition_id}`)
    return true
  })

  const traits = archetype.traits ?? {}
  const hardware_specs: Record<string, unknown> = { ...data.hardware_specs }
  for (const [traitKey, traitDef] of Object.entries(traits)) {
    hardware_specs[traitKey] = data.hardware_specs?.[traitKey] ?? traitDef.default
  }

  const used = new Set<string>()
  return {
    ...data,
    archetype_id,
    base_inputs: identifyPorts(base_inputs, 'input', used),
    base_outputs: identifyPorts(base_outputs, 'output', used),
    base_utility_inputs: identifyPorts(base_utility_inputs, 'utility-input', used),
    base_utility_outputs: identifyPorts(base_utility_outputs, 'utility-output', used),
    base_duration_seconds,
    duration_seconds: base_duration_seconds,
    active_modifiers,
    hardware_specs,
  }
}
