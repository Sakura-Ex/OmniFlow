import { afterEach, describe, expect, it } from 'vitest'
import type { RecipeNodeData } from '@/common/types/recipe'
import { DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'
import { modifierRegistry } from './modifier.registry'
import { runModifierPipeline, flattenForBackend, computationKey } from './modifier.pipeline'
import { ensureRecipeDataShape } from './modifier.normalize'
import type { IMachineModifier } from './modifier.types'

const recipe: RecipeNodeData = {
  recipe_id: 'r', machine_name: 'Machine', system: 'custom', duration_seconds: 4,
  inputs: [{ category: 'item', id: 'ore', amount: 2 }], outputs: [{ category: 'item', id: 'plate', amount: 1 }], metadata: {},
}
const gt: RecipeNodeData = { ...recipe, system: 'gregtech', metadata: { eu_per_tick: 32 }, hardware_specs: { energyHatches: [{ tier: 'HV', amps: 1 }] } }
const modifier = (id: string, definition: Partial<IMachineModifier> = {}): IMachineModifier => ({ id, name: id, apiVersion: 2, version: 1, ui_schema: [], evaluate: () => ({}), ...definition })
afterEach(() => { delete modifierRegistry.dynamic; delete modifierRegistry.bad; delete modifierRegistry.extra })

describe('deterministic Context → Effect compilation', () => {
  it('returns identical snapshots including identities and trace', () => {
    expect(runModifierPipeline(gt)).toEqual(runModifierPipeline(gt))
    expect(gt.inputs[0].portId).toBeUndefined()
  })
  it('parallel configuration affects subsequent overclocking and rejects the reverse order', () => {
    const instances = [
      { instance_id: 'p', definition_id: 'gt_parallel', uiState: { parallelLimit: 4 } },
      { instance_id: 'oc', definition_id: 'gt_overclocker', uiState: {} },
    ]
    const parallel = runModifierPipeline({ ...gt, active_modifiers: instances })
    const single = runModifierPipeline(gt)
    expect(parallel.actual_parallel).toBe(4)
    expect(parallel.duration_seconds).toBe(2)
    expect(single.duration_seconds).toBe(1)
    expect(() => runModifierPipeline({ ...gt, active_modifiers: [...instances].reverse() })).toThrow('must run after')
  })
  it('exposes stopped eligibility without erasing material output evidence', () => {
    const stopped = runModifierPipeline({ ...gt, hardware_specs: { energyHatches: [{ tier: 'ULV', amps: 1 }] } })
    expect(stopped.eligibility.eligible).toBe(false)
    expect(stopped.eligibility.reasons[0]).toContain('供电不足')
    expect(stopped.recipe_outputs[0].amount).toBeGreaterThan(0)
  })
  it('accepts legitimate energy-consuming facilities without ordinary material outputs', () => {
    const result = runModifierPipeline({ ...gt, outputs: [] })
    expect(result.eligibility.eligible).toBe(true)
    expect(result.utility_inputs[0].amount).toBeGreaterThan(0)
  })
  it('preserves custom resource categories and applies probability once', () => {
    const result = runModifierPipeline({ ...recipe, outputs: [{ category: 'custom', id: 'service', amount: 8, probability: 0.25, unit: [{ baseUnitId: 'item', exponent: 1 }] }] })
    expect(flattenForBackend(result).outputs).toEqual({ 'custom:service': 0.5 })
  })
  it('tracks deterministic dynamic ports and removals', () => {
    modifierRegistry.dynamic = modifier('dynamic', { evaluate: (ctx) => ({ recipeOutputs: [{ category: 'item', id: 'waste', amount: 1, portId: `dynamic:${ctx.instanceId}:waste` }] }) })
    const data = { ...recipe, active_modifiers: [{ instance_id: 'dyn', definition_id: 'dynamic', uiState: {} }] }
    const result = runModifierPipeline(data)
    expect(result.trace[0].addedPorts).toEqual(['dynamic:dyn:waste'])
    expect(result.trace[0].removedPorts).toEqual(['output:0'])
    expect(result.final_ports.some(({ port }) => port.portId === 'dynamic:dyn:waste')).toBe(true)
    expect(result).toEqual(runModifierPipeline(data))
  })
  it('rejects unknown, incompatible and over-placed plugins rather than silently filtering them', () => {
    expect(() => runModifierPipeline({ ...recipe, active_modifiers: [{ instance_id: 'x', definition_id: 'missing', uiState: {} }] })).toThrow('Unknown modifier')
    expect(() => runModifierPipeline({ ...recipe, active_modifiers: [{ instance_id: 'x', definition_id: 'gt_parallel', uiState: {} }] })).toThrow('Incompatible')
    expect(() => runModifierPipeline({ ...gt, active_modifiers: [1, 2].map((i) => ({ instance_id: String(i), definition_id: 'gt_parallel', uiState: {} })) })).toThrow('Too many')
  })
  it('validates dependencies, effect ports and immutable contexts', () => {
    modifierRegistry.bad = modifier('bad', { requires: ['time_multiplier'] })
    const active_modifiers = [{ instance_id: 'b', definition_id: 'bad', uiState: {} }]
    expect(() => runModifierPipeline({ ...recipe, active_modifiers })).toThrow('requires')
    modifierRegistry.bad = modifier('bad', { evaluate: () => ({ recipeOutputs: [{ category: 'item', id: 'waste', amount: 1 }] }) })
    expect(() => runModifierPipeline({ ...recipe, active_modifiers })).toThrow('persistent identity')
    modifierRegistry.bad = modifier('bad', { evaluate: () => ({ recipeOutputs: [{ category: 'item', id: 'waste', amount: 1, portId: 'unscoped' }] }) })
    expect(() => runModifierPipeline({ ...recipe, active_modifiers })).toThrow('stable-local-key')
    modifierRegistry.bad = modifier('bad', { evaluate: (ctx) => { Object.assign(ctx.recipeInputs[0], { amount: 7 }); return {} } })
    expect(() => runModifierPipeline({ ...recipe, active_modifiers })).toThrow()
    expect(recipe.inputs[0].amount).toBe(2)
  })
  it('separates per-slot and per-machine catalyst occupancy during parallel scaling', () => {
    const result = runModifierPipeline({ ...gt, inputs: [
      { category: 'item', id: 'tool', portId: 'tool', amount: 2, consumable: false, scaling: 'per_parallel_slot' },
      { category: 'item', id: 'chassis', portId: 'chassis', amount: 1, consumable: false, scaling: 'per_installed_machine' },
    ], active_modifiers: [{ instance_id: 'p', definition_id: 'gt_parallel', uiState: { parallelLimit: 4 } }] })
    expect(result.bom_occupancy.map((o) => [o.basis, o.amount])).toEqual([['per_parallel_slot', 8], ['per_installed_machine', 1]])
    expect(result.recipe_inputs.every((p) => p.amount === 0)).toBe(true)
  })
  it('does not resurrect explicitly deleted legacy ports or merge repeated utility resources', () => {
    expect(ensureRecipeDataShape({ ...recipe, base_inputs: [] }).base_inputs).toEqual([])
    const data = ensureRecipeDataShape({ ...gt, base_utility_inputs: [
      { category: 'energy', id: 'gt_eu', amount: 32, _uid: 'utility-gt_energy', portId: 'power', utility_type: 'energy:gt_eu' },
      { category: 'energy', id: 'gt_eu', amount: 7, portId: 'separate' },
    ] })
    expect(data.base_utility_inputs?.map((p) => p.portId)).toEqual(['power', 'separate'])
  })
  it('invalidates cache identity for environment, registry, recipe and plugin version changes', () => {
    const base = computationKey(recipe, DEFAULT_UNIT_SNAPSHOT)
    expect(computationKey(recipe, { ...DEFAULT_UNIT_SNAPSHOT, ticksPerSecond: 40 })).not.toBe(base)
    expect(computationKey({ ...recipe, duration_seconds: 5 }, DEFAULT_UNIT_SNAPSHOT)).not.toBe(base)
    modifierRegistry.extra = modifier('extra')
    expect(computationKey(recipe, DEFAULT_UNIT_SNAPSHOT)).not.toBe(base)
  })
  it.each([0, NaN, Infinity])('rejects invalid cycle %s', (duration_seconds) => {
    expect(() => runModifierPipeline({ ...recipe, duration_seconds })).toThrow()
  })
})

it('keeps GT capacity and overclock results invariant under input energy prefixes', () => {
  const base = runModifierPipeline(gt)
  const prefixed = runModifierPipeline({ ...gt, base_utility_inputs: [{
    category: 'energy', id: 'gt_eu', utility_type: 'energy:gt_eu', _uid: 'utility-gt_energy', amount: 0.032,
    time_base: 'rate_per_tick', unit: [{ baseUnitId: 'EU', prefixId: 'k', exponent: 1 }],
  }] })
  expect(prefixed.duration_seconds).toBe(base.duration_seconds)
  expect(prefixed.utility_inputs[0].amount).toBe(base.utility_inputs[0].amount)
})
