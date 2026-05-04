import type { RecipeNodeData, RecipePort } from '../types/recipe'
import type { Resource, ResourceCategory, RoutingMode } from '../types/types'
import { createDefaultModifierState } from './state'
import { getModifierById } from './registry'
import { applyArchetypeToInputs, getDefaultArchetypeIdForSystem, getMachineArchetype } from '../data/archetypes/index'

const MAX_INSTANT_RATE = 1e9
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
  if (typeof raw === 'string' && raw.length > 0) return raw
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
  const type = resource.category.toLowerCase().includes('fluid') ? 'fluid' : 'item'
  return {
    id: resource.id,
    amount: resource.amount,
    category: resource.category,
    type,
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

  // ═══ Phase 1: collect effects from all modifiers evaluated against base data ═══
  let machineStopped = false
  let totalParallelMultiplier = 1
  let totalDurationMultiplier = 1
  const combinedOutputMultipliers: Record<string, number> = {}
  const combinedUtilityMultipliers: Record<string, number> = {}
  let legacyEnergyAmount: number | undefined

  for (const modifierId of normalized.active_modifiers ?? []) {
    const modifier = getModifierById(modifierId)
    if (!modifier) continue

    const uiState = normalized.modifier_states?.[modifierId] ?? createDefaultModifierState(modifierId)
    const effect = modifier.evaluate(inputs, outputs, baseDuration, uiState)

    if (effect.machineStopped) machineStopped = true
    if (effect.parallelMultiplier !== undefined) totalParallelMultiplier *= effect.parallelMultiplier
    if (effect.durationMultiplier !== undefined) totalDurationMultiplier *= effect.durationMultiplier
    if (effect.energyAmount !== undefined) legacyEnergyAmount = effect.energyAmount
    if (effect.utilityMultipliers) {
      for (const [typeId, mult] of Object.entries(effect.utilityMultipliers)) {
        combinedUtilityMultipliers[typeId] = (combinedUtilityMultipliers[typeId] ?? 1) * mult
      }
    }
    if (effect.outputMultipliers) {
      for (const [id, mult] of Object.entries(effect.outputMultipliers)) {
        combinedOutputMultipliers[id] = (combinedOutputMultipliers[id] ?? 1) * mult
      }
    }
  }

  // ═══ Phase 2: Parallel — multiply ALL resources uniformly ═══
  for (const res of inputs) {
    res.amount *= totalParallelMultiplier
  }
  for (const res of outputs) {
    if (machineStopped) {
      res.amount = 0
      continue
    }
    res.amount *= totalParallelMultiplier
  }

  // ═══ Phase 3: Targeted Overclocking — only matched utility types are scaled ═══
  for (const res of inputs) {
    if (res.is_utility && res.utility_type) {
      const mult = combinedUtilityMultipliers[res.utility_type]
      if (mult !== undefined) res.amount *= mult
    }
  }

  // Backwards-compat fallback: legacy energyAmount still supported for simple overrides
  if (legacyEnergyAmount !== undefined) {
    const euInput = inputs.find((r) => r.id === 'gt:eu' && r.is_utility)
    if (euInput) euInput.amount = legacyEnergyAmount
  }

  // ═══ Phase 4: Output modifiers (probability) ═══
  for (const res of outputs) {
    const outputMult = combinedOutputMultipliers[res.id]
    if (outputMult !== undefined) res.amount *= outputMult
  }

  // ═══ Phase 5: Duration and rate calculation ═══
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
