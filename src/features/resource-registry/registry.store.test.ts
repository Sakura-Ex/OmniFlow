import { afterEach, expect, it } from 'vitest'
import { useGlobalResourceTable } from './registry.store'
import { useSettingsStore } from '@/features/settings/settings.store'

const initial = useGlobalResourceTable.getState()
const environment = useSettingsStore.getState().units
const snapshot = () => structuredClone({ categories: initial.categories, overrides: initial.overrides, entries: initial.entries })
afterEach(() => { useGlobalResourceTable.getState().restore(snapshot()); useSettingsStore.getState().setEnvironment(environment) })

it('commits a registry batch once and keeps repeated apply stable', () => {
  const draft = snapshot()
  draft.categories.custom = { id: 'custom', displayName: 'Custom', base_unit: 'widgets', preferred_time_base: 'per_cycle', themeColor: 'blue' }
  draft.overrides['custom:ore'] = { unit_override: 'ore-unit' }
  let changes = 0
  const unsubscribe = useGlobalResourceTable.subscribe(() => changes++)
  try {
    useGlobalResourceTable.getState().apply(draft)
    expect(changes).toBe(1)
    expect(useGlobalResourceTable.getState().resolve('custom:ore').unit).toBe('ore-unit')
    expect(useSettingsStore.getState().units.definitions.some((d) => d.symbol === 'ore-unit')).toBe(true)
    useGlobalResourceTable.getState().apply(draft)
    expect(useGlobalResourceTable.getState().categories).toEqual(draft.categories)
    draft.categories.custom.displayName = 'Uncommitted'
    expect(useGlobalResourceTable.getState().categories.custom.displayName).toBe('Custom')
  } finally { unsubscribe() }
})

it('rejects unfinished identities before mutating registry or unit definitions', () => {
  const draft = snapshot()
  draft.categories.__new_draft = { ...draft.categories.item, id: '__new_draft', base_unit: 'uncommitted-unit' }
  expect(() => useGlobalResourceTable.getState().apply(draft)).toThrow('identity')
  expect(useGlobalResourceTable.getState().categories).toEqual(initial.categories)
  expect(useSettingsStore.getState().units).toEqual(environment)
})
