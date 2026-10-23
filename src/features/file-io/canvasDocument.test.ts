import exportedDocumentJson from '../../../docs/validation/pr-02-04/export-roundtrip.json?raw'
import { describe, expect, it } from 'vitest'
import type { RecipeNodeData } from '@/common/types/recipe'
import { readCanvasDocument } from './canvasDocument'
import { UnitSystem } from '@/common/units/UnitSystem'
import { DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'
import { runModifierPipeline } from '@/features/modifier/modifier.pipeline'

const recipe: RecipeNodeData = {
  recipe_id: 'r', machine_name: 'Machine', system: 'custom', duration_seconds: 4,
  inputs: [{ category: 'item', id: 'ore', amount: 1 }], outputs: [{ category: 'item', id: 'plate', amount: 1 }], metadata: {},
}
const legacy = () => ({
  version: 2,
  ui: { nodes: [
    { id: 'r', type: 'recipeNode', position: { x: 0, y: 0 }, data: { label: 'Machine' } },
    { id: 's', type: 'sourceNode', position: { x: -300, y: 0 }, data: { mode: 'limit', ports: [{ category: 'item', id: 'ore', amount: 10 }] } },
  ], edges: [{ id: 'e', source: 's', sourceHandle: 'item:ore', target: 'r', targetHandle: 'item:ore' }] },
  domain: { recipes: { r: structuredClone(recipe) } },
})

describe('versioned document migration', () => {
  it('upgrades v2 units/environment/ports without mutating the original and reports default TPS', () => {
    const raw = legacy(), original = structuredClone(raw)
    const { document, warnings } = readCanvasDocument(raw)
    expect(document.version).toBe(5)
    expect(document.environment.ticksPerSecond).toBe(20)
    expect(warnings.join(' ')).toContain('20 TPS')
    expect(document.ui.edges[0].targetHandle).toBe(document.domain.recipes.r.base_inputs![0].portId)
    expect(document.ui.edges[0].sourceHandle).toBe(document.ui.nodes[1].data.ports[0].portId)
    expect(raw).toEqual(original)
  })
  it('round trips kg, m/s, EU/tick and custom environment definitions as JSON', () => {
    const raw = legacy()
    raw.domain.recipes.r.inputs = [
      { category: 'mass', id: 'powder', amount: 1, unit: [{ baseUnitId: 'g', prefixId: 'k', exponent: 1 }] },
      { category: 'speed', id: 'belt', amount: 10, unit: [{ baseUnitId: 'm', exponent: 1 }, { baseUnitId: 's', exponent: -1 }] },
      { category: 'energy', id: 'eu', amount: 32, unit: [{ baseUnitId: 'EU', exponent: 1 }, { baseUnitId: 'tick', exponent: -1 }] },
    ]
    raw.ui.edges = []
    raw.ui.nodes = raw.ui.nodes.slice(0, 1)
    const migrated = readCanvasDocument(raw).document
    const environment = { ...DEFAULT_UNIT_SNAPSHOT, ticksPerSecond: 40, definitions: [...DEFAULT_UNIT_SNAPSHOT.definitions, { id: 'custom', symbol: 'custom', scale: 2, derived: [{ baseUnitId: 'J', exponent: 1 }] }] }
    const saved = { ...migrated, environment }
    const restored = readCanvasDocument(JSON.parse(JSON.stringify(saved)))
    expect(restored.warnings).toEqual([])
    expect(restored.document.environment.ticksPerSecond).toBe(40)
    expect(restored.document.domain.recipes.r.base_inputs?.map((p) => p.unit)).toEqual(migrated.domain.recipes.r.base_inputs?.map((p) => p.unit))
    const units = new UnitSystem(restored.document.environment)
    expect(units.unit('custom').conversionScale(units.unit('J'))).toBe(2)
    expect(runModifierPipeline(restored.document.domain.recipes.r, restored.document.environment).recipe_inputs.find((port) => port.id === 'eu')?.amount).toBe(1280)
  })
  it('preserves unrecognized legacy labels as isolated atoms and only maps explicit kg', () => {
    const registry = { categories: {
      item: { id: 'item', displayName: 'Items', base_unit: 'mysterykg', themeColor: '#fff', preferred_time_base: 'per_cycle' },
    }, overrides: { 'item:plate': { unit_override: 'kg' } }, entries: {} }
    const { document } = readCanvasDocument({ ...legacy(), registry })
    expect(document.environment.definitions).toContainEqual({ id: 'legacy:mysterykg', symbol: 'mysterykg' })
    expect(document.domain.recipes.r.base_inputs![0].unit).toEqual([{ baseUnitId: 'legacy:mysterykg', exponent: 1 }])
    expect(document.domain.recipes.r.base_outputs![0].unit).toEqual([{ baseUnitId: 'g', prefixId: 'k', exponent: 1 }])
  })
  it('keeps ambiguous legacy edges with repair messages', () => {
    const raw = legacy()
    raw.domain.recipes.r.inputs.push({ category: 'item', id: 'ore', amount: 2 })
    const { document, warnings } = readCanvasDocument(raw)
    expect(document.ui.edges[0].targetHandle).toBe('item:ore')
    expect(warnings.join(' ')).toContain('ambiguous')
    expect(document.ui.edges[0].data.legacyHandles.target).toBe('item:ore')
  })
  it('rejects invalid environment, unknown factors and unsupported file/plugin API versions', () => {
    const migrated = readCanvasDocument(legacy()).document
    expect(() => readCanvasDocument({ ...migrated, version: 6 })).toThrow()
    expect(() => readCanvasDocument({ ...migrated, pluginApiVersion: 1 })).toThrow()
    expect(() => readCanvasDocument({ ...migrated, environment: undefined })).toThrow('environment')
    expect(() => readCanvasDocument({ ...migrated, environment: { ...migrated.environment, ticksPerSecond: 0 } })).toThrow()
    const unknown = structuredClone(migrated)
    unknown.domain.recipes.r.inputs[0].unit = [{ baseUnitId: 'unknown', exponent: 1 }]
    expect(() => readCanvasDocument(unknown)).toThrow('Unknown unit')
  })
  it('rejects non-finite external amounts before any store can be modified', () => {
    const raw = legacy()
    raw.ui.nodes[1].data.ports = [{ category: 'item', id: 'ore', amount: Infinity }]
    expect(() => readCanvasDocument(raw)).toThrow()
  })
  it('rejects duplicate graph identities before they can alias persistent port addresses', () => {
    const raw = legacy()
    raw.ui.nodes.push(structuredClone(raw.ui.nodes[0]))
    expect(() => readCanvasDocument(raw)).toThrow('Duplicate graph identity')
    raw.ui.nodes.pop()
    raw.ui.edges.push(structuredClone(raw.ui.edges[0]))
    expect(() => readCanvasDocument(raw)).toThrow('Duplicate graph identity')
  })
  it('rejects incompatible endpoint display units while preserving valid rate prefixes', () => {
    const document = readCanvasDocument(legacy()).document
    const port = document.ui.nodes[1].data.ports[0]
    port.displayUnit = [{ baseUnitId: 'item', prefixId: 'k', exponent: 1 }, { baseUnitId: 's', exponent: -1 }]
    expect(() => readCanvasDocument(document)).not.toThrow()
    port.displayUnit = [{ baseUnitId: 'g', exponent: 1 }, { baseUnitId: 's', exponent: -1 }]
    expect(() => readCanvasDocument(document)).toThrow('Incompatible')
  })
})

it('reopens the real browser-exported v4 document with stable handles and physical quantities', () => {
  const raw = JSON.parse(exportedDocumentJson)
  const { document, warnings } = readCanvasDocument(raw)
  expect(warnings.join(' ')).toContain('隐式')
  expect(document.ui.edges).toEqual(raw.ui.edges)
  expect(document.ui.nodes).toHaveLength(6)
  expect(document.domain.recipes['node-1'].base_inputs![0].amount).toBe(1)
  expect(document.domain.recipes['node-1'].base_inputs![0].unit).toEqual([{ baseUnitId: 'mB', prefixId: 'k', exponent: 1 }])
  expect(new UnitSystem(document.environment).toRate(1, document.domain.recipes['node-1'].base_inputs![0].unit!, 'per_cycle', 5)).toBe(200)
  expect(JSON.stringify(raw)).not.toContain('_computed')
})


it('migrates only visible endpoints and round trips explicit v5 policies without hidden supply', () => {
  const { document } = readCanvasDocument(legacy())
  const address = JSON.stringify(['s', document.ui.nodes[1].data.ports[0].portId])
  expect(Object.keys(document.networkConfiguration.ports)).toEqual([address])
  expect(document.networkConfiguration.ports[address].boundary).toEqual({ kind: 'source', capacity: 10 })
  document.networkConfiguration.ports[address].boundary = { kind: 'source', capacity: 3.5 }
  document.networkConfiguration.machines.r = { installed: 2, operatingUpper: 1.2 }
  const restored = readCanvasDocument(JSON.parse(JSON.stringify(document)))
  expect(restored.document.networkConfiguration).toEqual(document.networkConfiguration)
  expect(restored.warnings).toEqual([])
  expect(() => readCanvasDocument({ ...document, networkConfiguration: undefined })).toThrow('Missing network configuration')
})
