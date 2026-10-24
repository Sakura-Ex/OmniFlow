import { expect, it } from 'vitest'
import { DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'
import { capturePlanningBaseline, planningConflict, preparePlanningCommit, type PlanningInputs } from './planningDraft'
import { portKey } from './topology'

const machinePort = portKey('machine', 'ore')
const sourcePort = portKey('source', 'out')
const inputs = (): PlanningInputs => ({
  nodes: [
    { id: 'machine', type: 'recipeNode', position: { x: 20, y: 10 }, data: { label: 'Machine' } },
    { id: 'source', type: 'sourceNode', position: { x: -20, y: 10 }, data: { ports: [{ portId: 'out', category: 'item', id: 'ore', amount: 3 }] } },
  ],
  edges: [{ id: 'wire', source: 'source', sourceHandle: 'out', target: 'machine', targetHandle: 'ore' }],
  recipes: { machine: { recipe_id: 'recipe', machine_name: 'Machine', system: 'custom', duration_seconds: 2, inputs: [{ portId: 'ore', category: 'item', id: 'ore', amount: 1 }], outputs: [], metadata: {} } },
  environment: structuredClone(DEFAULT_UNIT_SNAPSHOT),
  configuration: { version: 1, machines: { machine: { installed: null, operatingUpper: 4 } }, ports: {
    [machinePort]: { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' } },
    [sourcePort]: { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: { kind: 'source', capacity: 3 } },
  } },
})

it('merges only focused machine and port edits while preserving concurrent changes elsewhere', () => {
  const current = inputs()
  const baseline = capturePlanningBaseline(current, 'machine')
  const draft = structuredClone(current.configuration)
  draft.machines.machine.operatingUpper = 7
  delete draft.ports[machinePort]
  current.configuration.ports[sourcePort].boundary = { kind: 'source', capacity: 9 }
  current.configuration.minimizeMachines = { priority: 3, scale: 1, weight: 2 }
  current.configuration.machines.another = { installed: 5, operatingUpper: null }
  const before = structuredClone(current)
  const result = preparePlanningCommit(baseline, draft, current)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error('Expected valid merge')
  expect(result.configuration.machines.machine.operatingUpper).toBe(7)
  expect(result.configuration.ports[machinePort]).toBeUndefined()
  expect(result.configuration.ports[sourcePort].boundary).toEqual({ kind: 'source', capacity: 9 })
  expect(result.configuration.minimizeMachines).toEqual(current.configuration.minimizeMachines)
  expect(result.configuration.machines.another.installed).toBe(5)
  expect(current).toEqual(before)
})

it('ignores view changes and results but rejects edits to the focused recipe, policy, connections or environment', () => {
  const current = inputs()
  const baseline = capturePlanningBaseline(current, 'machine')
  current.nodes[0] = { ...current.nodes[0], selected: true, position: { x: 900, y: 800 }, width: 450, data: { operating_equivalent: 2, planned_installed: 2 } }
  current.edges[0].selected = true
  expect(planningConflict(baseline, current)).toBeNull()
  const cases: ((value: PlanningInputs) => void)[] = [
    value => { value.recipes.machine.duration_seconds = 3 },
    value => { value.configuration.machines.machine.installed = 4 },
    value => { value.configuration.ports[machinePort].busId = 'other' },
    value => { value.environment.ticksPerSecond += 1 },
    value => { value.edges = [] },
  ]
  for (const change of cases) {
    const changed = structuredClone(current)
    change(changed)
    expect(preparePlanningCommit(baseline, baseline.inputs.configuration, changed)).toEqual({ ok: false, reason: 'conflict' })
  }
})

it('rejects endpoint edits and missing objects instead of applying settings to stale identities', () => {
  const current = inputs()
  const baseline = capturePlanningBaseline(current, 'source')
  current.nodes[1].data.ports[0].amount = 4
  expect(planningConflict(baseline, current)).toBe('conflict')
  current.nodes = current.nodes.filter(node => node.id !== 'source')
  expect(preparePlanningCommit(baseline, baseline.inputs.configuration, current)).toEqual({ ok: false, reason: 'missing' })
})

it('prevents a whole-document draft from overwriting any concurrent configuration edit', () => {
  const current = inputs()
  const baseline = capturePlanningBaseline(current)
  current.configuration.ports[sourcePort].boundary = { kind: 'source', capacity: null }
  expect(preparePlanningCommit(baseline, baseline.inputs.configuration, current)).toEqual({ ok: false, reason: 'conflict' })
})

it('validates a merged draft before mutation and refreshes a reusable baseline after success', () => {
  const current = inputs()
  const baseline = capturePlanningBaseline(current, 'machine')
  const draft = structuredClone(current.configuration)
  draft.machines.machine.installed = 2.5
  const invalid = preparePlanningCommit(baseline, draft, current)
  expect(invalid.ok).toBe(false)
  if (invalid.ok) throw new Error('Expected invalid installation')
  expect(invalid.reason).toBe('invalid')
  expect(current.configuration.machines.machine.installed).toBeNull()
  draft.machines.machine.installed = 3
  const prepared = preparePlanningCommit(baseline, draft, current)
  if (!prepared.ok) throw new Error('Expected valid installation')
  current.configuration = prepared.configuration
  const nextBaseline = capturePlanningBaseline(current, 'machine')
  expect(planningConflict(nextBaseline, current)).toBeNull()
  expect(nextBaseline.inputs.configuration.machines.machine.installed).toBe(3)
})
