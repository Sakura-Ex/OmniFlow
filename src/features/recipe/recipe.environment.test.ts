import type { SourceNodeData } from '@/common/types/recipe'
import { normalizeEndpointData } from './recipe.endpointNorm'
import { buildCalculationPayload } from '@/features/calculation/payloadBuilder'
import { beforeEach, expect, it } from 'vitest'
import { useRecipeStore } from './recipe.store'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'

beforeEach(() => {
  useRecipeStore.setState({ recipes: {} })
  useSettingsStore.getState().setEnvironment(DEFAULT_UNIT_SNAPSHOT)
})

it('invalidates cached recipes and subscribed previews when TPS changes', () => {
  useRecipeStore.getState().setRecipe('r', {
    recipe_id: 'r', machine_name: 'Machine', system: 'custom', duration_seconds: 4,
    inputs: [{ category: 'energy', id: 'gt_eu', amount: 32, time_base: 'rate_per_tick' }], outputs: [], metadata: {},
  })
  const before = useRecipeStore.getState().getPayload('r')!
  expect(before.recipe_inputs[0].amount).toBe(640)
  useSettingsStore.getState().setTps(40)
  const after = useRecipeStore.getState().getPayload('r')!
  expect(after.recipe_inputs[0].amount).toBe(1280)
  expect(after.cache_key).not.toBe(before.cache_key)
  expect(useRecipeStore.getState().dumpAll().r._computed).toBeUndefined()
})

it('resolves registered custom categories into units without filtering their rates', () => {
  useGlobalResourceTable.getState().addCategory({ id: 'service', displayName: 'Service', base_unit: 'custom-unit', themeColor: '#fff', preferred_time_base: 'per_cycle' })
  useRecipeStore.getState().setRecipe('r', { recipe_id: 'r', machine_name: 'Service', system: 'custom', duration_seconds: 2, inputs: [], outputs: [{ category: 'service', id: 'work', amount: 4 }], metadata: {} })
  const payload = useRecipeStore.getState().getPayload('r')!
  expect(payload.eligibility.eligible).toBe(true)
  expect(payload.recipe_outputs[0].amount).toBe(2)
  expect(payload.recipe_outputs[0].unit).toEqual([{ baseUnitId: 'legacy:custom-unit', exponent: 1 }])
})

it('rejects invalid TPS updates atomically', () => {
  const before = useSettingsStore.getState().units
  expect(() => useSettingsStore.getState().setTps(NaN)).toThrow()
  expect(useSettingsStore.getState().units).toBe(before)
})

it('updates display prefixes without recompiling physical rates or changing the model cache key', () => {
  useRecipeStore.getState().setRecipe('r', {
    recipe_id: 'r', machine_name: 'Fluid', system: 'custom', duration_seconds: 4,
    inputs: [], outputs: [{ category: 'fluid', id: 'water', amount: 2, portId: 'water', unit: [{ baseUnitId: 'L', exponent: 1 }] }], metadata: {},
  })
  const before = useRecipeStore.getState().getPayload('r')!
  const output = useRecipeStore.getState().recipes.r.base_outputs![0]
  useRecipeStore.getState().updateRecipe('r', { base_outputs: [{ ...output, displayUnit: [{ baseUnitId: 'L', prefixId: 'milli', exponent: 1 }, { baseUnitId: 's', exponent: -1 }] }] })
  const after = useRecipeStore.getState().getPayload('r')!
  expect(after.cache_key).toBe(before.cache_key)
  expect(after.trace).toBe(before.trace)
  expect(after.recipe_outputs[0].amount).toBe(0.5)
  expect(after.recipe_outputs[0].displayUnit?.[0].prefixId).toBe('milli')
})

it('captures a custom category’s declared unit on endpoint creation', () => {
  useGlobalResourceTable.getState().addCategory({ id: 'mass', displayName: 'Mass', base_unit: 'g', themeColor: '#fff', preferred_time_base: 'rate_per_sec' })
  const data = normalizeEndpointData<SourceNodeData>({ ports: [{ category: 'mass', id: 'powder', amount: 0.25 }] })
  expect(data.ports?.[0].unit).toEqual([{ baseUnitId: 'g', exponent: 1 }])
  const payload = buildCalculationPayload([{ id: 'source', type: 'sourceNode', position: { x: 0, y: 0 }, data }], [], {}, useSettingsStore.getState().units)
  expect(payload.payloadNodes[0].data.amount).toBe(0.25)
})
