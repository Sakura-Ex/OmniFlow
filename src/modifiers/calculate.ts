import type { RecipeNodeData, RecipePort } from '../types/recipe'
import type { Resource, ResourceCategory, RoutingMode, ComputedNodePayload, NormalizedResource } from '../types/types'
import { createDefaultModifierState } from './state'
import { getModifierById } from './registry'
import { applyArchetypeToInputs, getDefaultArchetypeIdForSystem, getMachineArchetype } from '../data/archetypes/index'
import { DEFAULT_RESOURCE_CATEGORIES } from '../registry/defaults'
import type { ModifierEffect, PipelineContext } from './types'
import { getCategory } from '../utils/resourceIdentifier'

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

// ── Pre-processing: normalize raw recipe data into a shaped baseline ──

export function ensureRecipeDataShape(data: RecipeNodeData): RecipeNodeData {
  const baseInputsRaw = (data.base_inputs?.length ? data.base_inputs : data.inputs) ?? []
  const baseOutputsRaw = (data.base_outputs?.length ? data.base_outputs : data.outputs) ?? []
  const archetype_id = data.archetype_id ?? getDefaultArchetypeIdForSystem(data.system)

  const rawInputs = baseInputsRaw.map(toResource)
  const { materials, utilityInputs, utilityOutputs } = applyArchetypeToInputs(rawInputs, archetype_id, data.metadata ?? {})
  const base_inputs = materials

  const existingUtilityMap = new Map<string, Resource>()
  for (const u of (data.base_utility_inputs ?? [])) {
    if (u.id) existingUtilityMap.set(`${u.category}:${u.id}`, u)
  }
  for (const u of (data.base_utility_outputs ?? [])) {
    if (u.id) existingUtilityMap.set(`${u.category}:${u.id}`, u)
  }

  const mergeWithExisting = (archetypeItems: Resource[]): Resource[] =>
    archetypeItems.map((u) => {
      const key = `${u.category}:${u.id}`
      const existing = existingUtilityMap.get(key)
      if (!existing) return u
      return {
        ...u,
        amount: existing.amount,
        time_base: existing.time_base ?? u.time_base,
        routing_mode: existing.routing_mode,
        _uid: existing._uid ?? u._uid,
      }
    })

  const base_utility_inputs = [
    ...mergeWithExisting(utilityInputs),
    ...(data.base_utility_inputs ?? []).filter((u) => u.id && !utilityInputs.some((a) => `${a.category}:${a.id}` === `${u.category}:${u.id}`)),
  ]
  const base_utility_outputs = [
    ...mergeWithExisting(utilityOutputs),
    ...(data.base_utility_outputs ?? []).filter((u) => u.id && !utilityOutputs.some((a) => `${a.category}:${a.id}` === `${u.category}:${u.id}`)),
  ]
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
    base_utility_inputs,
    base_utility_outputs,
    base_duration_seconds,
    duration_seconds: base_duration_seconds,
    base_duration: secondsToTicks(base_duration_seconds),
    active_modifiers,
    modifier_states,
  }
}

function applyEffect(ctx: PipelineContext, effect: ModifierEffect): void {
  if (effect.statMultipliers) {
    const sm = effect.statMultipliers
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

  if (effect.parallelMultiplier !== undefined && effect.parallelMultiplier !== 1) {
    const p = effect.parallelMultiplier
    for (const r of ctx.recipeInputs) {
      if (r.consumable !== false && r.consumable_probability !== 0) r.amount *= p
    }
    for (const r of ctx.recipeOutputs) {
      if (r.consumable !== false && r.consumable_probability !== 0) r.amount *= p
    }
    for (const r of ctx.utilityInputs) {
      if (r.consumable !== false && r.consumable_probability !== 0) r.amount *= p
    }
    for (const r of ctx.utilityOutputs) {
      if (r.consumable !== false && r.consumable_probability !== 0) r.amount *= p
    }
  }

  if (effect.durationMultiplier !== undefined) {
    ctx.durationSeconds *= effect.durationMultiplier
    ctx.durationSeconds = Math.max(0.05, ctx.durationSeconds)
  }

  if (effect.utilityMultipliers) {
    for (const r of ctx.utilityInputs) {
      if (r.utility_type) {
        const mult = effect.utilityMultipliers[r.utility_type]
        if (mult !== undefined) r.amount *= mult
      }
    }
  }

  if (effect.outputMultipliers) {
    for (const r of ctx.recipeOutputs) {
      const mult = effect.outputMultipliers[r.id]
      if (mult !== undefined) r.amount *= mult
    }
  }

  if (effect.machineStopped) {
    ctx.machineStopped = true
    for (const r of ctx.recipeOutputs) r.amount = 0
  }

  if (effect.removedInputs) {
    const removeSet = new Set(effect.removedInputs)
    ctx.recipeInputs = ctx.recipeInputs.filter((r) => !removeSet.has(r.id))
    ctx.utilityInputs = ctx.utilityInputs.filter((r) => !removeSet.has(r.id))
  }

  if (effect.removedOutputs) {
    const removeSet = new Set(effect.removedOutputs)
    ctx.recipeOutputs = ctx.recipeOutputs.filter((r) => !removeSet.has(r.id))
    ctx.utilityOutputs = ctx.utilityOutputs.filter((r) => !removeSet.has(r.id))
  }

  if (effect.addedInputs) {
    for (const res of effect.addedInputs) {
      if (res.is_utility) {
        ctx.utilityInputs.push(res)
      } else {
        ctx.recipeInputs.push(res)
      }
    }
  }

  if (effect.addedOutputs) {
    for (const res of effect.addedOutputs) {
      if (res.is_utility) {
        ctx.utilityOutputs.push(res)
      } else {
        ctx.recipeOutputs.push(res)
      }
    }
  }
}

export function normalizeRate(res: Resource, dur: number): number {
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

export function runModifierPipeline(rawData: RecipeNodeData): ComputedNodePayload {
  const normalized = ensureRecipeDataShape(rawData)
  const ctx: PipelineContext = {
    recipeInputs: deepCloneResources(normalized.base_inputs ?? []),
    recipeOutputs: deepCloneResources(normalized.base_outputs ?? []),
    utilityInputs: deepCloneResources(normalized.base_utility_inputs ?? []),
    utilityOutputs: deepCloneResources(normalized.base_utility_outputs ?? []),
    durationSeconds: normalized.base_duration_seconds ?? 0,
    machineStopped: false,
  }

  for (const modifierId of normalized.active_modifiers ?? []) {
    const modifier = getModifierById(modifierId)
    if (!modifier) continue

    const uiState = normalized.modifier_states?.[modifierId] ?? createDefaultModifierState(modifierId)
    const effect = modifier.evaluate(ctx, uiState)
    applyEffect(ctx, effect)
  }

  // ── Rate Normalization — all amounts → rate/sec ──
  const dur = Math.max(0.05, ctx.durationSeconds)

  const toNormalized = (resources: Resource[]): NormalizedResource[] =>
    resources.map((res) => ({
      category: res.category,
      id: res.id,
      amount: normalizeRate(res, dur),
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

  return {
    recipe_inputs: toNormalized(ctx.recipeInputs),
    recipe_outputs: toNormalized(ctx.recipeOutputs),
    utility_inputs: toNormalized(ctx.utilityInputs),
    utility_outputs: toNormalized(ctx.utilityOutputs),
    duration_seconds: dur,
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
    const dimensionId = category.includes(':') ? getCategory(category) : category
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
