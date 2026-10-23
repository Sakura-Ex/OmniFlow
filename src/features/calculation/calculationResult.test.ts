import { describe, expect, it } from 'vitest'
import type { LPResponse } from '@/common/types/lp'
import { DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'
import { compileNetwork } from './networkCompiler'
import { emptyNetworkConfiguration } from './networkConfig'
import { configureEndpointPorts } from './endpointConfiguration'
import { mapCalculationResult } from './calculationResult'
import { CalculationSession, calculationDocumentKey } from './calculationSession'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { useRecipeStore } from '@/features/recipe/recipe.store'

const nodes = [
  { id: 's', type: 'sourceNode', position: { x: 0, y: 0 }, data: { mode: 'limit', ports: [{ category: 'item', id: 'water', portId: 'out', amount: 10 }] } },
  { id: 't', type: 'targetNode', position: { x: 300, y: 0 }, data: { mode: 'demand', ports: [{ category: 'item', id: 'water', portId: 'in', amount: 10 }] } },
]
const edges = [{ id: 'edge', source: 's', target: 't', sourceHandle: 'out', targetHandle: 'in' }]
const configuration = () => nodes.reduce((config, node) => configureEndpointPorts(config, node, DEFAULT_UNIT_SNAPSHOT), emptyNetworkConfiguration())

describe('compiled result presentation', () => {
  it('keeps 10/s input and delivery gross totals and endpoint identities on one Net', () => {
    const model = compileNetwork({ nodes, edges, recipes: {}, configuration: configuration(), requestId: 'test', documentRevision: 1 })
    const response = { status: 'limit_reached', solution: { values: [10, 10] }, diagnostics: [] } as unknown as LPResponse
    const mapped = mapCalculationResult(model, response)
    expect(mapped.system_inputs).toEqual({ 'item:water': 10 })
    expect(mapped.system_outputs).toEqual({ 'item:water': 10 })
    expect(mapped.net_summaries![0]).toMatchObject({ source: 10, delivery: 10, spill: 0 })
    expect(mapped.node_results).toEqual({ s: { actual_amounts: { out: 10 }, port_throughputs: { out: 10 } }, t: { actual_amounts: { in: 10 }, port_throughputs: { in: 10 } } })
    useRecipeStore.setState({ recipes: {} })
    useCanvasStore.setState({ nodes, edges })
    useCanvasStore.getState().setCalculationResult(mapped)
    expect(useCanvasStore.getState().calculationStatus).toBe('feasible')
    expect(useCanvasStore.getState().nodes[1].data.actual_amounts).toEqual({ in: 10 })
    useCanvasStore.getState().invalidateCalculation()
    expect(useCanvasStore.getState().calculationStatus).toBe('stale')
    expect(useCanvasStore.getState().nodes[1].data.actual_amounts).toEqual({ in: 10 })
    expect(useCanvasStore.getState().systemInputs).toEqual({ 'item:water': 10 })
  })
  it('cleans removed node configuration and clears all policies on reset', () => {
    useCanvasStore.setState({ nodes, edges, networkConfiguration: configuration() })
    useCanvasStore.getState().setNodes([nodes[0]])
    expect(Object.keys(useCanvasStore.getState().networkConfiguration.ports)).toEqual(['["s","out"]'])
    useCanvasStore.getState().clearAll()
    expect(useCanvasStore.getState().networkConfiguration).toEqual(emptyNetworkConfiguration())
  })
})

describe('calculation lifecycle', () => {
  it('aborts the old request and rejects late results after editing or another run', () => {
    const session = new CalculationSession()
    const first = session.begin()
    const second = session.begin()
    expect(first.signal.aborted).toBe(true)
    expect(first.isCurrent()).toBe(false)
    expect(second.isCurrent()).toBe(true)
    session.invalidate()
    expect(second.isCurrent()).toBe(false)
    expect(second.signal.aborted).toBe(true)
  })
  it('ignores result and selection changes but detects port, topology and environment edits', () => {
    const key = calculationDocumentKey(nodes, edges, {}, configuration(), DEFAULT_UNIT_SNAPSHOT)
    expect(calculationDocumentKey(nodes.map(node => ({ ...node, selected: true, data: { ...node.data, actual_amounts: { out: 10 } } })), edges, {}, configuration(), DEFAULT_UNIT_SNAPSHOT)).toBe(key)
    expect(calculationDocumentKey(nodes, [], {}, configuration(), DEFAULT_UNIT_SNAPSHOT)).not.toBe(key)
    expect(calculationDocumentKey(nodes, edges, {}, configuration(), { ...DEFAULT_UNIT_SNAPSHOT, ticksPerSecond: 40 })).not.toBe(key)
  })
  it('retains physical identity after dragging or display-unit changes and invalidates input and target changes', () => {
    const recipe = { recipe_id: 'r', machine_name: 'Machine', system: 'vanilla', duration_seconds: 1, inputs: [{ portId: 'in', category: 'item', id: 'ore', amount: 1 }], outputs: [], metadata: {} }
    const recipes = { r: recipe }
    const key = calculationDocumentKey(nodes, edges, recipes, configuration(), DEFAULT_UNIT_SNAPSHOT)
    expect(calculationDocumentKey(nodes, edges, { r: { ...recipe, is_implemented: true } }, configuration(), DEFAULT_UNIT_SNAPSHOT)).toBe(key)
    const displayNodes = nodes.map(node => ({ ...node, position: { x: node.position.x + 400, y: -100 }, data: { ...node.data, ports: node.data.ports.map(port => ({ ...port, displayUnit: [{ baseUnitId: 'count', prefixId: 'kilo', exponent: 1 }] })) } }))
    const displayRecipes = { r: { ...recipe, inputs: recipe.inputs.map(port => ({ ...port, displayUnit: [{ baseUnitId: 'count', prefixId: 'kilo', exponent: 1 }] })) } }
    expect(calculationDocumentKey(displayNodes, edges.map(edge => ({ ...edge, selected: true, style: { stroke: 'red' } })), displayRecipes, configuration(), DEFAULT_UNIT_SNAPSHOT)).toBe(key)
    const changedInput = { r: { ...recipe, inputs: [{ ...recipe.inputs[0], amount: 2 }] } }
    expect(calculationDocumentKey(displayNodes, edges, changedInput, configuration(), DEFAULT_UNIT_SNAPSHOT)).not.toBe(key)
    const target = configuration()
    target.ports['["t","in"]'].boundary = { kind: 'delivery', mode: 'exact', amount: 11, capacity: null }
    expect(calculationDocumentKey(nodes, edges, recipes, target, DEFAULT_UNIT_SNAPSHOT)).not.toBe(key)
    expect(calculationDocumentKey(nodes, [{ ...edges[0], targetHandle: 'other' }], recipes, configuration(), DEFAULT_UNIT_SNAPSHOT)).not.toBe(key)
  })
})
