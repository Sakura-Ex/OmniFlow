import { expect, it } from 'vitest'
import { recipePortPresentation } from './recipePortPresentation'
import { runModifierPipeline } from '@/features/modifier/modifier.pipeline'
import { UnitSystem } from '@/common/units/UnitSystem'
import { DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'
import { setLocale } from '@/common/i18n'

it('shows verified gross throughput separately from per-machine coefficients and unknown actual flow', () => {
  const payload = runModifierPipeline({ recipe_id: 'r', machine_name: 'r', system: 'vanilla', duration_seconds: 1, inputs: [{ portId: 'water', category: 'fluid', id: 'water', amount: 1, unit: [{ baseUnitId: 'L', exponent: 1 }], displayUnit: [{ baseUnitId: 'L', prefixId: 'milli', exponent: 1 }] }], outputs: [], metadata: {} })
  const units = new UnitSystem(DEFAULT_UNIT_SNAPSHOT)
  const category = { id: 'fluid', displayName: 'Fluid', base_unit: 'L', themeColor: 'blue', preferred_time_base: 'per_cycle' as const }
  expect(recipePortPresentation(payload.recipe_inputs[0], payload, 1.2, units, category).rate).toBe('实际 1 200 mL/s')
  const unsolved = recipePortPresentation(payload.recipe_inputs[0], payload, undefined, units, category)
  expect(unsolved.rate).toBe('实际 —')
  expect(unsolved.rateValue).toBe('—')
  expect(unsolved.amount).toContain('每台')
})

it('retains time denominators for per-tick coefficients and canonical actual rates', () => {
  const payload = runModifierPipeline({ recipe_id: 'r', machine_name: 'r', system: 'vanilla', duration_seconds: 2, inputs: [{ portId: 'power', category: 'energy', id: 'gt_eu', amount: 16, time_base: 'rate_per_tick', unit: [{ baseUnitId: 'EU', exponent: 1 }] }], outputs: [], metadata: {} })
  const units = new UnitSystem(DEFAULT_UNIT_SNAPSHOT)
  const category = { id: 'energy', displayName: 'Energy', base_unit: 'EU', themeColor: 'blue', preferred_time_base: 'rate_per_tick' as const }
  const presentation = recipePortPresentation(payload.recipe_inputs[0], payload, 640, units, category)
  expect(presentation.amount).toBe('每台 16 EU/t')
  expect(presentation.rateValue).toBe('640 EU/s')
})

it('keeps capacity and state as prefixed quantities without flow time denominators', () => {
  const payload = runModifierPipeline({ recipe_id: 'r', machine_name: 'r', system: 'vanilla', duration_seconds: 1, inputs: [{ portId: 'water', category: 'fluid', id: 'water', amount: 1, unit: [{ baseUnitId: 'L', exponent: 1 }], displayUnit: [{ baseUnitId: 'L', prefixId: 'milli', exponent: 1 }] }], outputs: [], metadata: {} })
  const units = new UnitSystem(DEFAULT_UNIT_SNAPSHOT)
  const category = { id: 'fluid', displayName: 'Fluid', base_unit: 'L', themeColor: 'blue', preferred_time_base: 'per_cycle' as const }
  const capacity = recipePortPresentation(payload.recipe_inputs[0], payload, 1.2, units, category, { kind: 'capacity', available: 3 })
  expect(capacity.amount).toBe('每台 1 000 mL')
  expect(capacity.rateValue).toBe('1 200 mL')
  expect(capacity.formatQuantity(3)).toBe('3 000 mL')
  const state = recipePortPresentation(payload.recipe_inputs[0], payload, undefined, units, category, { kind: 'state', actual: 2.5 })
  expect(state.amount).toBe('状态 2 500 mL')
  expect(state.rateValue).toBe('—')
})

it('keeps zero-loss inventory occupancy distinct from zero actual consumption', () => {
  const payload = runModifierPipeline({ recipe_id: 'r', machine_name: 'r', system: 'vanilla', duration_seconds: 1, inputs: [{ portId: 'catalyst', category: 'item', id: 'catalyst', amount: 2, consumable: false }], outputs: [], metadata: {} })
  const units = new UnitSystem(DEFAULT_UNIT_SNAPSHOT)
  const category = { id: 'item', displayName: 'Item', base_unit: '个', themeColor: 'blue', preferred_time_base: 'per_cycle' as const }
  const labels = recipePortPresentation(payload.recipe_inputs[0], payload, 0, units, category)
  expect(labels.amount).toBe('每台库存占用 2 个')
  expect(labels.rate).toBe('实际 0 个/s')
})

it('localizes presentation prefixes while retaining numeric rate values and resource identity', () => {
  const payload = runModifierPipeline({ recipe_id: 'r', machine_name: 'r', system: 'vanilla', duration_seconds: 1, inputs: [{ portId: 'water', category: 'fluid', id: '原始资源', amount: 1, unit: [{ baseUnitId: 'L', exponent: 1 }] }], outputs: [], metadata: {} })
  const units = new UnitSystem(DEFAULT_UNIT_SNAPSHOT)
  const category = { id: 'fluid', displayName: 'Fluid', base_unit: 'L', themeColor: 'blue', preferred_time_base: 'per_cycle' as const }
  setLocale('en')
  try {
    const presentation = recipePortPresentation(payload.recipe_inputs[0], payload, 1.2, units, category)
    expect(presentation.rate).toBe(`Actual ${presentation.rateValue}`)
    expect(presentation.amount).toContain('Per machine')
    expect(payload.recipe_inputs[0].id).toBe('原始资源')
  } finally {
    setLocale('zh-CN')
  }
})
