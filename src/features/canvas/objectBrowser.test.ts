import { expect, it } from 'vitest'
import type { Node } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import { DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'
import { deriveBrowserObjects, filterBrowserObjects } from './objectBrowser'

const recipe: RecipeNodeData = {
  recipe_id: 'press-plate', machine_name: '精密压板机', system: 'custom', duration_seconds: 2,
  inputs: [{ portId: 'ore-in', category: 'item', id: 'mod:ore', amount: 2 }],
  outputs: [{ portId: 'plate-out', category: 'item', id: 'plate', amount: 1 }], metadata: {},
}

const nodes: Node[] = [
  { id: 'press-42', type: 'recipeNode', position: { x: 10, y: 20 }, selected: true, data: { label: 'stale label' } },
  { id: 'source-17', type: 'sourceNode', position: { x: -300, y: 40 }, data: { ports: [{ portId: 'source-out', category: 'item', id: 'mod:ore', amount: 3 }] } },
]

const input = () => ({ nodes: structuredClone(nodes), recipes: { 'press-42': structuredClone(recipe) },
  edges: [{ id: 'wire', source: 'source-17', sourceHandle: 'source-out', target: 'press-42', targetHandle: 'ore-in' }],
  environment: structuredClone(DEFAULT_UNIT_SNAPSHOT), entries: { 'item:mod:ore': { displayName: 'Rich Iron Ore' } }, issues: [] })

it('finds authoritative names, identities and registered resource names without changing the model', () => {
  const data = input()
  const before = structuredClone(data)
  const objects = deriveBrowserObjects(data)
  expect(filterBrowserObjects(objects, '精密').map(row => row.id)).toEqual(['press-42'])
  expect(filterBrowserObjects(objects, 'PRESS-42').map(row => row.id)).toEqual(['press-42'])
  expect(filterBrowserObjects(objects, 'rich ore').map(row => row.id)).toEqual(['press-42', 'source-17'])
  expect(filterBrowserObjects(objects, 'item:mod:ore')).toHaveLength(2)
  expect(filterBrowserObjects(objects, 'absent')).toEqual([])
  expect(filterBrowserObjects(objects, '   ')).toEqual(objects)
  expect(objects.every(row => !row.hasIssue)).toBe(true)
  expect(objects[0].name).toBe(recipe.machine_name)
  expect(data).toEqual(before)
})

it('keeps broken recipes searchable and marks only affected nodes with actual issue evidence', () => {
  const data = input()
  data.nodes.push({ id: 'unrelated', type: 'sourceNode', position: { x: 3, y: 4 }, data: { ports: [] } })
  data.recipes['press-42'].active_modifiers = [{ instance_id: 'bad', definition_id: 'missing-definition', uiState: {} }]
  const objects = deriveBrowserObjects(data)
  expect(filterBrowserObjects(objects, 'plate')).toHaveLength(1)
  expect(objects.find(row => row.id === 'press-42')?.hasIssue).toBe(true)
  expect(objects.find(row => row.id === 'source-17')?.hasIssue).toBe(true)
  expect(objects.find(row => row.id === 'unrelated')?.hasIssue).toBe(false)
})

it('uses explicit error locations and excludes stale diagnostic evidence', () => {
  const data = input()
  const diagnostics = { status: 'stale' as const, message: '', assumptions: [], issues: [{ rowId: 'net:old', kind: 'missing_supply' as const, amount: 1, scale: 1, nodeIds: ['source-17'], portKeys: [] }] }
  const objects = deriveBrowserObjects({ ...data, diagnostics, issues: [{ path: ['ports', JSON.stringify(['press-42', 'ore-in'])], code: 'invalid', message: 'Invalid value' }] })
  expect(objects.find(row => row.id === 'press-42')?.hasIssue).toBe(true)
  expect(objects.find(row => row.id === 'source-17')?.hasIssue).toBe(false)
  expect(deriveBrowserObjects({ ...data, diagnostics: { ...diagnostics, status: 'explained' } }).find(row => row.id === 'source-17')?.hasIssue).toBe(true)
})
