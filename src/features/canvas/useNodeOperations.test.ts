import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import * as endpointComputation from '@/features/calculation/autoFillEndpoints'
import { useNodeOperations as createNodeOperations } from '@/features/recipe/hooks/useNodeOperations'

vi.mock('react', async (original) => ({ ...await original<typeof import('react')>(), useCallback: (callback: unknown) => callback }))

beforeEach(() => {
  useCanvasStore.getState().resetCanvas()
  useRecipeStore.setState({ recipes: {} })
})
afterEach(() => vi.restoreAllMocks())

const recipe = (id: string): RecipeNodeData => ({
  recipe_id: id, machine_name: id, system: 'custom', duration_seconds: 1,
  inputs: [{ portId: 'in', category: 'item', id: 'ore', amount: 1 }],
  outputs: [{ portId: 'out', category: 'item', id: 'plate', amount: 1 }], metadata: {},
})

const setup = () => {
  const nodesRef = { current: ['first', 'second', 'unselected'].map((id) => ({
    id, type: 'recipeNode', selected: id !== 'unselected', position: { x: 0, y: 0 }, data: {},
  })) as Node[] }
  const edgesRef = { current: [] as Edge[] }
  for (const node of nodesRef.current) useRecipeStore.getState().setRecipe(node.id, recipe(node.id))
  useCanvasStore.getState().setNodes(nodesRef.current)
  const setNodes = vi.fn((nodes: Node[]) => useCanvasStore.getState().setNodes(nodes))
  const setEdges = vi.fn((edges: Edge[]) => useCanvasStore.getState().setEdges(edges))
  const takeSnapshot = vi.fn(() => {
    expect(nodesRef.current).toHaveLength(3)
    expect(edgesRef.current).toHaveLength(0)
    expect(useCanvasStore.getState().networkConfiguration.ports).toEqual({})
  })
  const operations = createNodeOperations({ nodesRef, edgesRef, setNodes, setEdges, takeSnapshot, lastSystemInputs: {}, lastSystemOutputs: {} })
  return { ...operations, nodesRef, edgesRef, setNodes, setEdges, takeSnapshot }
}

it('fills all selected recipes with one pre-edit snapshot and one graph commit', () => {
  const action = setup()
  action.handleAutoFillSelected()
  expect(action.takeSnapshot).toHaveBeenCalledOnce()
  expect(action.setNodes).toHaveBeenCalledOnce()
  expect(action.setEdges).toHaveBeenCalledOnce()
  expect(action.nodesRef.current).toHaveLength(7)
  expect(action.edgesRef.current).toHaveLength(4)
  expect(action.edgesRef.current.filter(edge => edge.target === 'first' || edge.source === 'first')).toHaveLength(2)
  expect(action.edgesRef.current.filter(edge => edge.target === 'second' || edge.source === 'second')).toHaveLength(2)
  expect(action.edgesRef.current.some(edge => edge.target === 'unselected' || edge.source === 'unselected')).toBe(false)
  expect(Object.keys(useCanvasStore.getState().networkConfiguration.ports)).toHaveLength(4)
  expect(new Set(action.nodesRef.current.map(node => node.id)).size).toBe(7)
})

it('does not create another transaction when selected recipes are already complete', () => {
  const action = setup()
  action.handleAutoFillSelected()
  action.takeSnapshot.mockClear()
  action.setNodes.mockClear()
  action.setEdges.mockClear()
  const before = structuredClone({ nodes: action.nodesRef.current, edges: action.edgesRef.current, configuration: useCanvasStore.getState().networkConfiguration })
  action.handleAutoFillSelected()
  expect(action.takeSnapshot).not.toHaveBeenCalled()
  expect(action.setNodes).not.toHaveBeenCalled()
  expect(action.setEdges).not.toHaveBeenCalled()
  expect({ nodes: action.nodesRef.current, edges: action.edgesRef.current, configuration: useCanvasStore.getState().networkConfiguration }).toEqual(before)
})

it('leaves the whole document and history untouched if a later recipe cannot be prepared', () => {
  const action = setup()
  const compute = endpointComputation.computeAutoFillEndpoints
  vi.spyOn(endpointComputation, 'computeAutoFillEndpoints')
    .mockImplementationOnce(compute)
    .mockImplementationOnce(() => { throw new Error('Cannot prepare second recipe') })
  const before = structuredClone({ nodes: action.nodesRef.current, edges: action.edgesRef.current, configuration: useCanvasStore.getState().networkConfiguration })
  expect(() => action.handleAutoFillSelected()).toThrow('Cannot prepare second recipe')
  expect(action.takeSnapshot).not.toHaveBeenCalled()
  expect(action.setNodes).not.toHaveBeenCalled()
  expect(action.setEdges).not.toHaveBeenCalled()
  expect({ nodes: action.nodesRef.current, edges: action.edgesRef.current, configuration: useCanvasStore.getState().networkConfiguration }).toEqual(before)
})
