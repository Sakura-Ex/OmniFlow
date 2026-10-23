import { expect, it } from 'vitest'
import { computeAutoFillEndpoints } from './autoFillEndpoints'
import type { RecipeNodeData } from '@/common/types/recipe'

it('creates independently identified endpoints for repeated resources with preserved input units', () => {
  const recipe: RecipeNodeData = {
    recipe_id: 'r', machine_name: 'Mass', system: 'custom', duration_seconds: 1,
    inputs: ['process', 'cooling'].map((portId) => ({ portId, category: 'item', id: 'powder', amount: 1, unit: [{ baseUnitId: 'g', prefixId: 'k', exponent: 1 }] })),
    outputs: [], metadata: {},
  }
  let nextId = 0
  const result = computeAutoFillEndpoints({ nodeId: 'r', recipeNodeData: recipe, allNodes: [], allEdges: [], lastSystemInputs: { 'item:powder': 500 }, lastSystemOutputs: {}, makeId: () => `node-${nextId++}` })
  expect(result.nodesToAdd).toHaveLength(2)
  expect(result.edgesToAdd.map((edge) => edge.targetHandle)).toEqual(['process', 'cooling'])
  expect(new Set(result.edgesToAdd.map((edge) => edge.sourceHandle)).size).toBe(2)
  expect(result.nodesToAdd[0].data.ports[0].unit).toEqual([{ baseUnitId: 'g', prefixId: 'k', exponent: 1 }])
  expect(result.nodesToAdd[0].data.ports[0].amount).toBe(0.5)
  expect(result.edgesToAdd[0].sourceHandle).toBe(result.nodesToAdd[0].data.ports[0].portId)
})
