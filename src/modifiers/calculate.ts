import type { RecipeNodeData, RecipePort } from '../types/recipe'
import type { Resource, ResourceCategory, RoutingMode, ComputedNodePayload, NormalizedResource } from '../types/types'
import { createDefaultModifierState } from './state'
import { getModifierById } from './registry'
import { applyArchetypeToInputs, getDefaultArchetypeIdForSystem, getMachineArchetype } from '../data/archetypes/index'
import { DEFAULT_RESOURCE_CATEGORIES } from '../registry/defaults'
import type { ModifierEffect } from './types'

export const GAME_BASE_TPS = 20

const MAX_INSTANT_RATE = 1e9
const TICKS_PER_SECOND = GAME_BASE_TPS

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
    time_base: (port as Partial<Resource>).time_base,
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

// ── Pre-processing: normalize raw recipe data into a shaped baseline ──

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

// ── Pipeline context: mutable working copy during modifier application ──

interface PipelineContext {
  recipeInputs: Resource[]
  recipeOutputs: Resource[]
  utilityInputs: Resource[]
  utilityOutputs: Resource[]
  durationSeconds: number
  machineStopped: boolean
}

// ── The 5-Step Modifier Pipeline ──

export function runModifierPipeline(rawData: RecipeNodeData): ComputedNodePayload {
  // ── Step 1: Init State — deep clone, separate recipe_io from utility_io ──
  const normalized = ensureRecipeDataShape(rawData)
  const allInputs = deepCloneResources(normalized.base_inputs ?? [])
  const allOutputs = deepCloneResources(normalized.base_outputs ?? [])

  const ctx: PipelineContext = {
    recipeInputs: allInputs.filter((r) => !r.is_utility),
    recipeOutputs: allOutputs.filter((r) => !r.is_utility),
    utilityInputs: allInputs.filter((r) => r.is_utility),
    utilityOutputs: allOutputs.filter((r) => r.is_utility),
    durationSeconds: normalized.base_duration_seconds ?? 0,
    machineStopped: false,
  }

  // ── Collect effects from all active modifiers evaluated against base data ──
  type CollectedEffects = {
    stat: ModifierEffect['statMultipliers'][]
    parallel: number[]
    duration: number[]
    utility: Record<string, number>[]
    output: Record<string, number>[]
    energyAmount: number | undefined
    stopped: boolean
  }

  const collected: CollectedEffects = {
    stat: [],
    parallel: [],
    duration: [],
    utility: [],
    output: [],
    energyAmount: undefined,
    stopped: false,
  }

  for (const modifierId of normalized.active_modifiers ?? []) {
    const modifier = getModifierById(modifierId)
    if (!modifier) continue

    const uiState = normalized.modifier_states?.[modifierId] ?? createDefaultModifierState(modifierId)
    const effect = modifier.evaluate(allInputs, allOutputs, ctx.durationSeconds, uiState)

    if (effect.machineStopped) collected.stopped = true
    if (effect.statMultipliers) collected.stat.push(effect.statMultipliers)
    if (effect.parallelMultiplier !== undefined) collected.parallel.push(effect.parallelMultiplier)
    if (effect.durationMultiplier !== undefined) collected.duration.push(effect.durationMultiplier)
    if (effect.utilityMultipliers) collected.utility.push(effect.utilityMultipliers)
    if (effect.outputMultipliers) collected.output.push(effect.outputMultipliers)
    if (effect.energyAmount !== undefined) collected.energyAmount = effect.energyAmount
  }

  // ── Step 2: Phase 0 — Stat Multipliers (linear, unconditional) ──
  for (const sm of collected.stat) {
    if (!sm) continue
    if (sm.duration !== undefined) ctx.durationSeconds *= sm.duration
    if (sm.recipeInput !== undefined) {
      for (const r of ctx.recipeInputs) r.amount *= sm.recipeInput
    }
    if (sm.recipeOutput !== undefined) {
      for (const r of ctx.recipeOutputs) r.amount *= sm.recipeOutput
    }
    if (sm.utility !== undefined) {
      for (const r of ctx.utilityInputs) r.amount *= sm.utility
      for (const r of ctx.utilityOutputs) r.amount *= sm.utility
    }
  }

  // ── Step 3: Phase 1 & Phase 2 — Parallel + Overclock ──

  // Phase 1: Parallel (uniform scaling of ALL amounts, consumable guard)
  let totalParallel = 1
  for (const p of collected.parallel) totalParallel *= p

  if (totalParallel !== 1) {
    for (const r of ctx.recipeInputs) {
      if (r.consumable !== false && r.consumable_probability !== 0) r.amount *= totalParallel
    }
    for (const r of ctx.recipeOutputs) {
      if (r.consumable !== false && r.consumable_probability !== 0) r.amount *= totalParallel
    }
    for (const r of ctx.utilityInputs) {
      if (r.consumable !== false && r.consumable_probability !== 0) r.amount *= totalParallel
    }
    for (const r of ctx.utilityOutputs) {
      if (r.consumable !== false && r.consumable_probability !== 0) r.amount *= totalParallel
    }
  }

  // Phase 2: Duration (overclock time scaling)
  for (const d of collected.duration) ctx.durationSeconds *= d
  ctx.durationSeconds = Math.max(0.05, ctx.durationSeconds)

  // Phase 2: Utility multipliers (targeted overclock)
  const mergedUtility: Record<string, number> = {}
  for (const um of collected.utility) {
    for (const [typeId, mult] of Object.entries(um)) {
      mergedUtility[typeId] = (mergedUtility[typeId] ?? 1) * mult
    }
  }
  for (const r of ctx.utilityInputs) {
    if (r.utility_type) {
      const mult = mergedUtility[r.utility_type]
      if (mult !== undefined) r.amount *= mult
    }
  }

  // Phase 2: Legacy energyAmount fallback
  if (collected.energyAmount !== undefined) {
    const euInput = ctx.utilityInputs.find((r) => r.category === 'energy:gt_eu')
    if (euInput) euInput.amount = collected.energyAmount
  }

  // Phase 2: Output multipliers (probability)
  const mergedOutput: Record<string, number> = {}
  for (const om of collected.output) {
    for (const [id, mult] of Object.entries(om)) {
      mergedOutput[id] = (mergedOutput[id] ?? 1) * mult
    }
  }
  for (const r of ctx.recipeOutputs) {
    const mult = mergedOutput[r.id]
    if (mult !== undefined) r.amount *= mult
  }

  // Machine stopped: zero all recipe outputs
  if (collected.stopped) {
    ctx.machineStopped = true
    for (const r of ctx.recipeOutputs) r.amount = 0
  }

  // ── Step 4: Ultimate Rate Normalization — all amounts → rate/sec ──
  const dur = Math.max(0.05, ctx.durationSeconds)

  function normalizeRate(res: Resource): number {
    const probability = res.consumable_probability ?? 1
    if (res.consumable === false || probability === 0) return 0
    const mMode = res.time_base ?? 'per_cycle'
    const baseRate = mMode === 'rate_per_tick'
      ? res.amount * GAME_BASE_TPS
      : mMode === 'rate_per_sec'
        ? res.amount
        : dur > 0 ? res.amount / dur : MAX_INSTANT_RATE
    return baseRate * probability
  }

  const toNormalized = (resources: Resource[]): NormalizedResource[] =>
    resources.map((res) => ({
      category: res.category,
      id: res.id,
      amount: normalizeRate(res),
      time_base: res.time_base ?? 'per_cycle',
      consumable: res.consumable,
      consumable_probability: res.consumable_probability,
      probability: res.probability,
      routing_mode: res.routing_mode,
      routing_locked: res.routing_locked,
      is_utility: Boolean(res.is_utility),
      utility_type: res.utility_type,
      amount_mutable: res.amount_mutable,
      _uid: res._uid,
    }))

  // ── Step 5: Structured Output ──
  return {
    nodeId: normalized.recipe_id || '',
    recipe_inputs: toNormalized(ctx.recipeInputs),
    recipe_outputs: toNormalized(ctx.recipeOutputs),
    utility_inputs: toNormalized(ctx.utilityInputs),
    utility_outputs: toNormalized(ctx.utilityOutputs),
    duration_seconds: dur,
    is_instant: dur === 0,
  }
}

// ── API Flattening: merge recipe + utility → minimal payload for backend ──

export function flattenForBackend(payload: ComputedNodePayload): {
  inputs: Record<string, number>
  outputs: Record<string, number>
} {
  const inputs: Record<string, number> = {}
  const outputs: Record<string, number> = {}

  const knownCategories = new Set(DEFAULT_RESOURCE_CATEGORIES.map((c) => c.id))

  const isUnknownResource = (category: string): boolean => {
    const dimensionId = category.includes(':') ? category.slice(0, category.lastIndexOf(':')) : category
    return !knownCategories.has(dimensionId)
  }

  for (const r of [...payload.recipe_inputs, ...payload.utility_inputs]) {
    if (r.consumable === false || r.consumable_probability === 0) continue
    if (isUnknownResource(r.category)) continue
    const key = `${r.category}:${r.id}`
    inputs[key] = (inputs[key] ?? 0) + r.amount
  }
  for (const r of [...payload.recipe_outputs, ...payload.utility_outputs]) {
    if (r.consumable === false || r.consumable_probability === 0) continue
    if (isUnknownResource(r.category)) continue
    const key = `${r.category}:${r.id}`
    outputs[key] = (outputs[key] ?? 0) + r.amount
  }

  return { inputs, outputs }
}

// ── Legacy compatibility — kept for consumers that haven't migrated yet ──

export type CalculatedRates = {
  transformedInputs: Resource[]
  transformedOutputs: Resource[]
  inputRates: Resource[]
  outputRates: Resource[]
  duration: number
  isInstant: boolean
}

export function getCalculatedRates(nodeData: RecipeNodeData): CalculatedRates {
  const payload = runModifierPipeline(nodeData)
  const ratesToResource = (nr: NormalizedResource): Resource => ({
    category: nr.category,
    id: nr.id,
    amount: nr.amount,
    time_base: nr.time_base,
    consumable: nr.consumable,
    probability: nr.probability,
    routing_mode: nr.routing_mode,
    routing_locked: nr.routing_locked,
    is_utility: nr.is_utility,
    utility_type: nr.utility_type,
    amount_mutable: nr.amount_mutable,
    _uid: nr._uid,
  })

  const allInputs = [...payload.recipe_inputs, ...payload.utility_inputs].map(ratesToResource)
  const allOutputs = [...payload.recipe_outputs, ...payload.utility_outputs].map(ratesToResource)

  return {
    transformedInputs: allInputs,
    transformedOutputs: allOutputs,
    inputRates: allInputs,
    outputRates: allOutputs,
    duration: payload.duration_seconds,
    isInstant: payload.is_instant,
  }
}

export function normalizePayloadResources(rates: Resource[]): Resource[] {
  const keep = rates.filter((r) => r.consumable !== false)
  const merged = new Map<string, Resource>()
  for (const r of keep) {
    const key = `${r.category}:${r.id}`
    const existing = merged.get(key)
    if (existing) {
      existing.amount += r.amount
    } else {
      merged.set(key, { ...r })
    }
  }
  return [...merged.values()]
}
