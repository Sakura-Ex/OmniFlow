import type { RecipeNodeData } from '@/common/types/recipe'
import type { Resource, ComputedNodePayload, NormalizedResource } from '@/common/types/resource'
import type { UnitSnapshot } from '@/common/types/units'
import type { ModifierTrace } from '@/common/types/computation'
import type { PipelineContext } from './modifier.types'
import { ensureRecipeDataShape } from './modifier.normalize'
import { getModifierById, modifierRegistry } from './modifier.registry'
import { UnitSystem, positive, finite } from '@/common/units/UnitSystem'
import { DEFAULT_UNIT_SNAPSHOT, defaultResourceUnit } from '@/common/units/defaults'
import { portIdentity } from '@/common/utils/ports'
export { ensureRecipeDataShape }

/**
 * Freeze snapshots so plugins cannot change their input or shared configuration.
 * @returns The recursively frozen input value.
 * @param value - Input snapshot or configuration to freeze.
 */
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

/**
 * Complete cache identity includes recipe, environment, definitions and plugin versions.
 * @returns Cache identity for physical inputs, environment and plugin versions.
 * @param data - Editable recipe snapshot.
 * @param environment - Serializable environment, definitions and prefixes.
 */
export function computationKey(data: RecipeNodeData, environment: UnitSnapshot): string {
  const { _computed, ...recipe } = data
  void _computed
  return JSON.stringify([recipe, environment, Object.values(modifierRegistry).map((m) => [m.id, m.apiVersion, m.version])], (key, value) => key === 'displayUnit' ? undefined : value)
}

/**
 * Convert editing intent once and apply production probability separately.
 * @returns Canonical per-second rate with production probability applied once.
 * @param res - Resource amount, production probability and input unit.
 * @param duration - Finite positive cycle duration in seconds.
 * @param units - Explicit unit system for the captured environment.
 */
export function normalizeRate(res: Resource, duration: number, units = new UnitSystem(DEFAULT_UNIT_SNAPSHOT)): number {
  positive(duration)
  finite(res.amount)
  const probability = finite(res.probability ?? 1)
  if (res.amount < 0 || probability < 0 || probability > 1) throw new Error('Invalid resource amount/probability')
  const rate = units.toRate(res.amount, res.unit ?? defaultResourceUnit(res.category, res.id), res.time_base ?? 'per_cycle', duration)
  return res.consumable === false ? 0 : finite(rate * probability)
}

/**
 * Compile final ports, eligibility, occupancy and trace using one explicit environment.
 * @returns Deterministic final ports, eligibility, occupancy and step trace.
 * @param rawData - Editable recipe snapshot before shaping.
 * @param environment - Serializable environment, definitions and prefixes.
 */
export function runModifierPipeline(rawData: RecipeNodeData, environment: UnitSnapshot = DEFAULT_UNIT_SNAPSHOT): ComputedNodePayload {
  const units = new UnitSystem(environment)
  const normalized = ensureRecipeDataShape(rawData)
  const baseline = {
    recipeInputs: structuredClone(normalized.base_inputs ?? []),
    recipeOutputs: structuredClone(normalized.base_outputs ?? []),
    utilityInputs: structuredClone(normalized.base_utility_inputs ?? []),
    utilityOutputs: structuredClone(normalized.base_utility_outputs ?? []),
    durationSeconds: positive(normalized.base_duration_seconds ?? normalized.duration_seconds),
  }
  let ctx: PipelineContext = { ...baseline, baseline, units, instanceId: '', actualParallel: 1, machineStopped: false, hardwareSpecs: structuredClone(normalized.hardware_specs ?? {}) }
  const reasons: string[] = []
  const trace: ModifierTrace[] = []
  const instances = normalized.active_modifiers ?? []
  if (new Set(instances.map((i) => i.instance_id)).size !== instances.length) throw new Error('Duplicate modifier instance identity')
  const positions = new Map(instances.map((inst, i) => [inst.definition_id, i]))
  const ports = (context: PipelineContext) => [...context.recipeInputs, ...context.recipeOutputs, ...context.utilityInputs, ...context.utilityOutputs]
  const validate = (context: PipelineContext) => {
    positive(context.durationSeconds)
    if (!Number.isSafeInteger(context.actualParallel) || context.actualParallel < 1) throw new Error('Invalid parallel count')
    const seen = new Set<string>()
    for (const port of ports(context)) {
      if (!port.category?.trim() || !port.id.trim()) throw new Error('Resource category and ID must not be blank')
      const id = portIdentity(port)
      if (seen.has(id)) throw new Error(`Duplicate final port: ${id}`)
      seen.add(id)
      normalizeRate(port, context.durationSeconds, units)
    }
  }
  validate(ctx)
  for (const [index, inst] of instances.entries()) {
    const modifier = getModifierById(inst.definition_id)
    if (!modifier || modifier.apiVersion !== 2 || !Number.isSafeInteger(modifier.version) || modifier.version < 1) throw new Error(`Unsupported modifier: ${inst.definition_id}`)
    for (const dependency of modifier.requires ?? []) {
      if (!positions.has(dependency)) throw new Error(`${modifier.id} requires ${dependency}`)
    }
    for (const dependency of [...modifier.after ?? [], ...modifier.requires ?? []]) {
      if (!getModifierById(dependency)) throw new Error(`Unknown modifier dependency: ${dependency}`)
      const position = positions.get(dependency)
      if (position !== undefined && position >= index) throw new Error(`${modifier.id} must run after ${dependency}`)
    }
    const before = ctx
    const beforeIds = ports(before).map(portIdentity)
    const effect = modifier.evaluate(freeze({ ...ctx, instanceId: inst.instance_id }), freeze(structuredClone(inst.uiState)))
    const allowed = new Set(['recipeInputs', 'recipeOutputs', 'utilityInputs', 'utilityOutputs', 'durationSeconds', 'actualParallel', 'machineStopped', 'reason'])
    if (Object.keys(effect).some((key) => !allowed.has(key))) throw new Error(`Invalid effect from ${modifier.id}`)
    const { reason, ...changes } = effect
    ctx = { ...ctx, ...changes, machineStopped: ctx.machineStopped || Boolean(effect.machineStopped) }
    validate(ctx)
    const originalIds = ports({ ...ctx, ...baseline }).map(portIdentity)
    for (const port of ports(ctx)) {
      const id = portIdentity(port)
      if (!beforeIds.includes(id) && !originalIds.includes(id) && !id.startsWith(`dynamic:${inst.instance_id}:`)) {
        throw new Error(`New port ${id} must use dynamic:${inst.instance_id}:<stable-local-key>`)
      }
    }
    if (effect.machineStopped) reasons.push(reason ?? `${modifier.id}: machine stopped`)
    const afterIds = ports(ctx).map(portIdentity)
    trace.push({ instanceId: inst.instance_id, definitionId: modifier.id, version: modifier.version, durationBefore: before.durationSeconds, durationAfter: ctx.durationSeconds, addedPorts: afterIds.filter((id) => !beforeIds.includes(id)), removedPorts: beforeIds.filter((id) => !afterIds.includes(id)), reason })
  }
  const dur = positive(ctx.durationSeconds)
  const toNormalized = (resources: readonly Resource[]): NormalizedResource[] => resources.map((res) => ({ ...res, amount: normalizeRate(res, dur, units), time_base: res.time_base ?? 'per_cycle', is_utility: Boolean(res.is_utility) }))
  const recipe_inputs = toNormalized(ctx.recipeInputs)
  const recipe_outputs = toNormalized(ctx.recipeOutputs)
  const utility_inputs = toNormalized(ctx.utilityInputs)
  const utility_outputs = toNormalized(ctx.utilityOutputs)
  return {
    recipe_inputs, recipe_outputs, utility_inputs, utility_outputs, duration_seconds: dur,
    final_ports: [
      ...[...recipe_inputs, ...utility_inputs].map((port) => ({ port, direction: 'input' as const })),
      ...[...recipe_outputs, ...utility_outputs].map((port) => ({ port, direction: 'output' as const })),
    ],
    eligibility: { eligible: !ctx.machineStopped, reasons },
    actual_parallel: ctx.actualParallel,
    bom_occupancy: [...ctx.recipeInputs, ...ctx.utilityInputs].filter((r) => r.consumable === false || r.probability === 0).map((resource) => ({ resource, basis: resource.scaling === 'per_parallel_slot' ? 'per_parallel_slot' : resource.scaling === 'per_installed_machine' ? 'per_installed_machine' : 'per_running_machine', amount: resource.amount })),
    trace, cache_key: computationKey(rawData, environment),
  }
}

/**
 * Resource summary only; routing must resolve each final port before aggregation.
 * @returns Resource-level summaries without routing information.
 * @param payload - Final compiled port and rate payload.
 */
export function flattenForBackend(payload: ComputedNodePayload): { inputs: Record<string, number>; outputs: Record<string, number> } {
  const inputs: Record<string, number> = {}
  const outputs: Record<string, number> = {}
  for (const { port, direction } of payload.final_ports) {
    const target = direction === 'input' ? inputs : outputs
    const key = `${port.category}:${port.id}`
    target[key] = (target[key] ?? 0) + port.amount
  }
  return { inputs, outputs }
}

/**
 * Preview invalid drafts without presenting them as runnable calculation inputs.
 * @returns Compiled preview, or an explicitly ineligible invalid draft.
 * @param data - Editable recipe snapshot.
 * @param environment - Serializable environment, definitions and prefixes.
 */
export function previewModifierPipeline(data: RecipeNodeData, environment: UnitSnapshot): ComputedNodePayload {
  try { return runModifierPipeline(data, environment) }
  catch (error) {
    const reasons = [error instanceof Error ? error.message : String(error)]
    return { recipe_inputs: [], recipe_outputs: [], utility_inputs: [], utility_outputs: [], duration_seconds: data.duration_seconds, final_ports: [], eligibility: { eligible: false, reasons }, actual_parallel: 1, bom_occupancy: [], trace: [], cache_key: computationKey(data, environment) }
  }
}
