import type { RecipeNodeData, RecipePort } from '../types/recipe'
import type { Resource, ResourceCategory, RoutingMode } from '../types/types'
import { createDefaultModifierState } from './state'
import { getModifierById } from './registry'
import { applyArchetypeToInputs, getDefaultArchetypeIdForSystem, getMachineArchetype } from '../data/archetypes/index'

const MAX_INSTANT_RATE = 1e9
const LEGACY_PORT_CATEGORIES: ResourceCategory[] = ['item', 'fluid']
const TICKS_PER_SECOND = 20

function deepCloneResources(resources: Resource[]): Resource[] {
  return resources.map((res) => ({ ...res }))
}

export function ticksToSeconds(value: number | undefined): number {
  const ticks = Number(value)
  return Number.isFinite(ticks) ? ticks / TICKS_PER_SECOND : 0
}

export function secondsToTicks(value: number | undefined): number {
  const seconds = Number(value)
  return Number.isFinite(seconds) ? seconds * TICKS_PER_SECOND : 0
}

function normalizeDurationSeconds(data: RecipeNodeData): number {
  if (typeof data.base_duration_seconds === 'number') return Math.max(0, data.base_duration_seconds)
  if (typeof data.duration_seconds === 'number') return Math.max(0, data.duration_seconds)
  if (typeof data.base_duration === 'number') return Math.max(0, ticksToSeconds(data.base_duration))
  return Math.max(0, ticksToSeconds(data.duration_ticks))
}

function normalizeCategory(raw: unknown): ResourceCategory {
  if (typeof raw === 'string' && (['item', 'fluid', 'energy', 'stress', 'heat'] as string[]).includes(raw)) {
    return raw as ResourceCategory
  }
  return 'item'
}

function normalizeAmount(raw: unknown): number {
  const amount = Number(raw)
  return Number.isFinite(amount) ? amount : 0
}

export function toResource(port: Partial<RecipePort> | Partial<Resource>): Resource {
  const routingRaw = (port as Partial<Resource>).routing_mode
  const routing_mode: RoutingMode = routingRaw === 'global' ? 'global' : 'wired'

  return {
    category: normalizeCategory((port as Partial<Resource>).category ?? (port as Partial<RecipePort>).type),
    id: String((port as Partial<Resource>).id ?? ''),
    amount: normalizeAmount((port as Partial<Resource>).amount),
    probability: typeof (port as Partial<Resource>).probability === 'number' ? (port as Partial<Resource>).probability : undefined,
    routing_mode,
    routing_locked: Boolean((port as Partial<Resource>).routing_locked),
    is_utility: Boolean((port as Partial<Resource>).is_utility),
    utility_type: typeof (port as Partial<Resource>).utility_type === 'string' ? (port as Partial<Resource>).utility_type : undefined,
    amount_mutable: typeof (port as Partial<Resource>).amount_mutable === 'boolean' ? (port as Partial<Resource>).amount_mutable : undefined,
    _uid: typeof (port as Partial<Resource>)._uid === 'string' ? (port as Partial<Resource>)._uid : undefined,
  }
}

export function toLegacyPort(resource: Resource): RecipePort {
  const category = LEGACY_PORT_CATEGORIES.includes(resource.category) ? resource.category : 'item'
  return {
    id: resource.id,
    amount: resource.amount,
    category: resource.category,
    type: category as 'item' | 'fluid',
    probability: resource.probability,
  }
}

export function ensureRecipeDataShape(data: RecipeNodeData): RecipeNodeData {
  const baseInputsRaw = (data.base_inputs?.length ? data.base_inputs : data.inputs) ?? []
  const baseOutputsRaw = (data.base_outputs?.length ? data.base_outputs : data.outputs) ?? []
  const archetype_id = data.archetype_id ?? getDefaultArchetypeIdForSystem(data.system)

  const rawInputs = baseInputsRaw.map(toResource)
  const base_inputs = applyArchetypeToInputs(rawInputs, archetype_id, data.metadata ?? {})
  const base_outputs = baseOutputsRaw.map(toResource).map((entry) => ({
    ...entry,
    routing_mode: (entry.routing_mode === 'global' ? 'global' : 'wired') as RoutingMode,
    routing_locked: Boolean(entry.routing_locked),
  }))
  const base_duration_seconds = normalizeDurationSeconds(data)
  const archetype = getMachineArchetype(archetype_id)
  const activeModifierSet = new Set<string>([
    ...archetype.default_modifiers,
    ...(Array.isArray(data.active_modifiers) ? data.active_modifiers : []),
  ])
  let active_modifiers = Array.from(activeModifierSet)

  // Strip modifiers incompatible with the current archetype
  active_modifiers = active_modifiers.filter((modifierId) => {
    const modifier = getModifierById(modifierId)
    if (!modifier) return false
    const allowed = modifier.compatible_archetypes
    if (!allowed || allowed.length === 0) return true
    return allowed.includes(archetype_id)
  })

  const modifier_states = { ...(data.modifier_states ?? {}) }
  for (const modifierId of active_modifiers) {
    const defaults = createDefaultModifierState(modifierId)
    modifier_states[modifierId] = {
      ...defaults,
      ...(modifier_states[modifierId] ?? {}),
    }
  }

  return {
    ...data,
    archetype_id,
    base_inputs,
    base_outputs,
    base_duration_seconds,
    duration_seconds: base_duration_seconds,
    base_duration: secondsToTicks(base_duration_seconds),
    active_modifiers,
    modifier_states,
    inputs: base_inputs.map(toLegacyPort),
    outputs: base_outputs.map(toLegacyPort),
    duration_ticks: secondsToTicks(base_duration_seconds),
  }
}

export type CalculatedRates = {
  transformedInputs: Resource[]
  transformedOutputs: Resource[]
  inputRates: Resource[]
  outputRates: Resource[]
  duration: number
  isInstant: boolean
}

export function getCalculatedRates(nodeData: RecipeNodeData): CalculatedRates {
  const normalized = ensureRecipeDataShape(nodeData)
  const baseInputs = normalized.base_inputs ?? []
  const baseOutputs = normalized.base_outputs ?? []
  const baseDuration = normalized.base_duration_seconds ?? normalized.duration_seconds ?? 0

  const inputs = deepCloneResources(baseInputs)
  const outputs = deepCloneResources(baseOutputs)

  // Phase 1: collect effects from all modifiers evaluated against base data
  let machineStopped = false
  let totalParallelMultiplier = 1
  let totalDurationMultiplier = 1
  const combinedOutputMultipliers: Record<string, number> = {}
  let energyAmount: number | undefined

  for (const modifierId of normalized.active_modifiers ?? []) {
    const modifier = getModifierById(modifierId)
    if (!modifier) continue

    const uiState = normalized.modifier_states?.[modifierId] ?? createDefaultModifierState(modifierId)
    const effect = modifier.evaluate(inputs, outputs, baseDuration, uiState)

    if (effect.machineStopped) machineStopped = true
    if (effect.parallelMultiplier !== undefined) totalParallelMultiplier *= effect.parallelMultiplier
    if (effect.durationMultiplier !== undefined) totalDurationMultiplier *= effect.durationMultiplier
    if (effect.energyAmount !== undefined) energyAmount = effect.energyAmount
    if (effect.outputMultipliers) {
      for (const [id, mult] of Object.entries(effect.outputMultipliers)) {
        combinedOutputMultipliers[id] = (combinedOutputMultipliers[id] ?? 1) * mult
      }
    }
  }

  // Phase 2: apply combined effects in deterministic order
  for (const res of inputs) {
    res.amount *= totalParallelMultiplier
  }

  if (energyAmount !== undefined) {
    const euInput = inputs.find((r) => r.id === 'gt:eu' && r.is_utility)
    if (euInput) euInput.amount = energyAmount
  }

  for (const res of outputs) {
    if (machineStopped) {
      res.amount = 0
      continue
    }
    res.amount *= totalParallelMultiplier
    const outputMult = combinedOutputMultipliers[res.id]
    if (outputMult !== undefined) res.amount *= outputMult
  }

  const duration = Math.max(0.05, baseDuration * totalDurationMultiplier)
  const divisor = duration > 0 ? duration : null

  const inputRates = inputs.map((res) => ({
    ...res,
    amount: divisor ? res.amount / divisor : MAX_INSTANT_RATE,
  }))
  const outputRates = outputs.map((res) => ({
    ...res,
    amount: divisor ? res.amount / divisor : MAX_INSTANT_RATE,
  }))

  return {
    transformedInputs: inputs,
    transformedOutputs: outputs,
    inputRates,
    outputRates,
    duration,
    isInstant: duration === 0,
  }
}
