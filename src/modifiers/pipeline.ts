import type { RecipeNodeData } from '../types/recipe'
import type { Resource, ComputedNodePayload, NormalizedResource } from '../types/types'
import { ensureRecipeDataShape } from './normalize'
import { getModifierById } from './registry'
export { ensureRecipeDataShape }

import type { PipelineContext } from './types'
import { getCategory } from '../utils/resourceIdentifier'
import { DEFAULT_RESOURCE_CATEGORIES } from '../registry/defaults'
import { useSettingsStore } from '../stores/settingsStore'

const MAX_INSTANT_RATE = 1e9

function deepCloneResources(resources: Resource[]): Resource[] {
  return resources.map((res) => ({ ...res }))
}

export function normalizeRate(res: Resource, dur: number): number {
  const probability = res.probability ?? 1
  if (res.consumable === false || probability === 0) return 0
  const mMode = res.time_base ?? 'per_cycle'
  const baseRate = mMode === 'rate_per_tick'
    ? res.amount * useSettingsStore.getState().tps
    : mMode === 'rate_per_sec'
      ? res.amount
      : dur > 0 ? res.amount / dur : MAX_INSTANT_RATE
  return baseRate * probability
}

export function runModifierPipeline(rawData: RecipeNodeData): ComputedNodePayload {
  const normalized = ensureRecipeDataShape(rawData)
  const recipeInputs = deepCloneResources(normalized.base_inputs ?? [])
  const recipeOutputs = deepCloneResources(normalized.base_outputs ?? [])
  const utilityInputs = deepCloneResources(normalized.base_utility_inputs ?? [])
  const utilityOutputs = deepCloneResources(normalized.base_utility_outputs ?? [])
  const durationSeconds = normalized.base_duration_seconds ?? 0

  const baseline = {
    recipeInputs: deepCloneResources(recipeInputs),
    recipeOutputs: deepCloneResources(recipeOutputs),
    utilityInputs: deepCloneResources(utilityInputs),
    utilityOutputs: deepCloneResources(utilityOutputs),
    durationSeconds,
  }

  let ctx: PipelineContext = {
    recipeInputs,
    recipeOutputs,
    utilityInputs,
    utilityOutputs,
    durationSeconds,
    machineStopped: false,
    hardwareSpecs: normalized.hardware_specs ?? {},
    baseline,
  }

  for (const inst of normalized.active_modifiers ?? []) {
    const modifier = getModifierById(inst.definition_id)
    if (!modifier) continue

    ctx = modifier.evaluate(ctx, inst.uiState)
  }

  const dur = rawData.system === 'gregtech' ? Math.max(0.05, ctx.durationSeconds) : ctx.durationSeconds

  const toNormalized = (resources: Resource[]): NormalizedResource[] =>
    resources.map((res) => ({
      category: res.category,
      id: res.id,
      amount: normalizeRate(res, dur),
      time_base: res.time_base ?? 'per_cycle',
      consumable: res.consumable,
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
    if (r.consumable === false || r.probability === 0) continue
    if (isUnknownResource(r.category)) continue
    const key = `${r.category}:${r.id}`
    inputs[key] = (inputs[key] ?? 0) + r.amount
  }
  for (const r of [...payload.recipe_outputs, ...payload.utility_outputs]) {
    if (r.probability === 0) continue
    if (isUnknownResource(r.category)) continue
    const key = `${r.category}:${r.id}`
    outputs[key] = (outputs[key] ?? 0) + r.amount
  }

  return { inputs, outputs }
}
