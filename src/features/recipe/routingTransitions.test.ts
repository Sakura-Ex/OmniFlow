import { describe, expect, it } from 'vitest'
import type { Edge } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import { disconnectNewGlobalPorts, editableRoutingPorts } from './routingTransitions'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { captureSnapshot, restoreSnapshot } from '@/features/canvas/hooks/useUndoRedo'

/**
 * Create all four editable recipe port groups with independent routing identities.
 * @returns Recipe with ordinary input/output and utility input/output ports.
 */
function recipe(): RecipeNodeData {
  const port = (portId: string) => ({ portId, category: 'item', id: 'resource', amount: 1, routing_mode: 'wired' as const })
  return { recipe_id: 'r', machine_name: 'r', system: 'vanilla', duration_seconds: 1, inputs: [], outputs: [], base_inputs: [port('in')], base_outputs: [port('out')], base_utility_inputs: [port('utility-in')], base_utility_outputs: [port('utility-out')], metadata: {} }
}

const edges: Edge[] = [
  { id: 'in', source: 'source', sourceHandle: 's', target: 'r', targetHandle: 'in' },
  { id: 'in-second-provider', source: 'source-2', sourceHandle: 's2', target: 'r', targetHandle: 'in' },
  { id: 'out', source: 'r', sourceHandle: 'out', target: 'target', targetHandle: 't' },
  { id: 'utility-in', source: 'power', sourceHandle: 'p', target: 'r', targetHandle: 'utility-in' },
  { id: 'utility-out', source: 'r', sourceHandle: 'utility-out', target: 'power-sink', targetHandle: 'p' },
  { id: 'other-node-same-handle', source: 'another', sourceHandle: 'out', target: 'elsewhere', targetHandle: 'in' },
  { id: 'unrelated-invalid', source: 'r', sourceHandle: 'missing', target: 'deleted', targetHandle: 'gone' },
]

describe('explicit Wired to Global save transitions', () => {
  it.each([
    ['base_inputs', ['in', 'in-second-provider']],
    ['base_outputs', ['out']],
    ['base_utility_inputs', ['utility-in']],
    ['base_utility_outputs', ['utility-out']],
  ] as const)('disconnects only changed %s port wires', (group, removed) => {
    const before = recipe(), after = structuredClone(before)
    after[group]![0].routing_mode = 'global'
    const result = disconnectNewGlobalPorts('r', editableRoutingPorts('recipeNode', before), editableRoutingPorts('recipeNode', after), edges)
    expect(result.map(edge => edge.id)).toEqual(edges.filter(edge => !(removed as readonly string[]).includes(edge.id)).map(edge => edge.id))
    expect(edges).toHaveLength(7)
    expect(before[group]![0].routing_mode).toBe('wired')
  })
  it.each(['sourceNode', 'targetNode'] as const)('uses the endpoint direction for %s', type => {
    const before = { ports: [{ portId: 'port', category: 'item', id: 'resource', amount: 1 }] }
    const after = { ports: [{ ...before.ports[0], routing_mode: 'global' as const }] }
    const endpointEdges: Edge[] = [{ id: 'output', source: 'endpoint', sourceHandle: 'port', target: 'target' }, { id: 'input', source: 'source', target: 'endpoint', targetHandle: 'port' }, { id: 'unrelated', source: 'another', sourceHandle: 'port', target: 'target' }]
    const result = disconnectNewGlobalPorts('endpoint', editableRoutingPorts(type, before), editableRoutingPorts(type, after), endpointEdges)
    expect(result.map(edge => edge.id)).toEqual(type === 'sourceNode' ? ['input', 'unrelated'] : ['output', 'unrelated'])
  })
  it('does not repair unchanged global errors, deleted ports, new ports or global-to-wired transitions', () => {
    const before = [{ portId: 'unchanged', direction: 'input' as const, routingMode: 'global' as const }, { portId: 'return', direction: 'output' as const, routingMode: 'global' as const }, { portId: 'deleted', direction: 'input' as const }]
    const after = [{ ...before[0] }, { ...before[1], routingMode: 'wired' as const }, { portId: 'new', direction: 'input' as const, routingMode: 'global' as const }]
    expect(disconnectNewGlobalPorts('r', before, after, edges)).toBe(edges)
    expect(disconnectNewGlobalPorts('r', before, after, [])).toEqual([])
  })
  it('restores disconnected wires and routing intent together on undo and redo', () => {
    const canvas = useCanvasStore.getState()
    const original = captureSnapshot(canvas.nodes, canvas.edges)
    try {
      const before = recipe(), after = structuredClone(before)
      after.base_inputs![0].routing_mode = 'global'
      useRecipeStore.getState().setRecipe('r', before)
      canvas.setNodes([{ id: 'r', type: 'recipeNode', position: { x: 0, y: 0 }, data: {} }])
      canvas.setEdges(edges)
      const snapshot = captureSnapshot(useCanvasStore.getState().nodes, edges)
      useRecipeStore.getState().setRecipe('r', after)
      canvas.setEdges(disconnectNewGlobalPorts('r', editableRoutingPorts('recipeNode', before), editableRoutingPorts('recipeNode', after), edges))
      const saved = captureSnapshot(useCanvasStore.getState().nodes, useCanvasStore.getState().edges)
      restoreSnapshot(snapshot); canvas.setNodes(snapshot.nodes); canvas.setEdges(snapshot.edges)
      expect(useCanvasStore.getState().edges.map(edge => edge.id)).toContain('in')
      expect(useRecipeStore.getState().recipes.r.base_inputs![0].routing_mode).toBe('wired')
      restoreSnapshot(saved); canvas.setNodes(saved.nodes); canvas.setEdges(saved.edges)
      expect(useCanvasStore.getState().edges.map(edge => edge.id)).not.toContain('in')
      expect(useRecipeStore.getState().recipes.r.base_inputs![0].routing_mode).toBe('global')
    } finally { restoreSnapshot(original); canvas.setNodes(original.nodes); canvas.setEdges(original.edges) }
  })
})
