import { describe, expect, it } from 'vitest'
import { splitterFixture } from '../../../fixtures/compiler/splitterCases'
import { SplitterNodeDataSchema } from '@/common/schemas/splitter.schema'
import { DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'
import { compileNetwork } from '@/features/calculation/networkCompiler'
import { cloneSubgraph } from '@/features/canvas/cloneSubgraph'
import { captureSnapshot, restoreSnapshot } from '@/features/canvas/hooks/useUndoRedo'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { readCanvasDocument } from './canvasDocument'
import { LPResponseSchema } from '@/common/types/lp'
import { mapCalculationResult } from '@/features/calculation/calculationResult'
import { portKey } from '@/features/calculation/topology'
import { stripCalculationResults } from '@/common/utils/calculationState'
import solverResponses from '../../../fixtures/compiler/installation-responses.json'

describe('fixed allocation splitter document semantics', () => {
  it('applies a real spill solution, recompiles and persists/clones only editable splitter configuration', () => {
    const input = splitterFixture()
    input.nodes = input.nodes.filter(node => node.id !== 'u')
    input.edges = input.edges.filter(edge => edge.target !== 'u')
    delete input.configuration!.ports[portKey('u', 'u')]
    input.configuration!.ports[portKey('f', 'b')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: { kind: 'spill', capacity: null } }
    const model = compileNetwork(input)
    const response = LPResponseSchema.parse(solverResponses.find(item => item.id === 'T13-explicit-spill-enables-branch')!.response)
    expect(response.compiler_fingerprint).toBe(model.fingerprint)
    const before = captureSnapshot(useCanvasStore.getState().nodes, useCanvasStore.getState().edges)
    try {
      useCanvasStore.getState().setNodes(input.nodes)
      useCanvasStore.getState().setEdges(input.edges)
      useCanvasStore.getState().setNetworkConfiguration(input.configuration!)
      useCanvasStore.getState().setCalculationResult(mapCalculationResult(model, response))
      const solved = useCanvasStore.getState().nodes
      const splitter = solved.find(node => node.id === 'f')!
      expect(splitter.data.port_throughputs).toEqual({ in: 10, a: 4, b: 6 })
      expect(splitter.data.actual_amounts).toBeUndefined()
      expect(compileNetwork({ ...input, nodes: solved }).fingerprint).toBe(model.fingerprint)
      const copied = cloneSubgraph(solved, input.edges)
      expect(copied.nodes.find(node => node.type === 'splitterNode')!.data.port_throughputs).toBeUndefined()
      const saved = { version: 5, pluginApiVersion: 2, environment: DEFAULT_UNIT_SNAPSHOT, networkConfiguration: input.configuration, ui: { nodes: solved.map(node => ({ ...node, data: stripCalculationResults(node.data) })), edges: input.edges }, domain: { recipes: {} } }
      const restored = readCanvasDocument(JSON.parse(JSON.stringify(saved))).document
      expect(restored.ui.nodes.find(node => node.id === 'f')!.data.port_throughputs).toBeUndefined()
      expect(captureSnapshot(solved, input.edges).nodes.find(node => node.id === 'f')!.data.port_throughputs).toBeUndefined()
    } finally {
      restoreSnapshot(before)
      useCanvasStore.getState().setNodes(before.nodes)
      useCanvasStore.getState().setEdges(before.edges)
    }
  })
  it('rejects negative, non-finite and incorrect ratio sums, and normalizes roundoff', () => {
    const data = splitterFixture().nodes[0].data
    for (const ratio of [-0.1, NaN, Infinity, 0.7]) {
      expect(SplitterNodeDataSchema.safeParse({ ...data, outputs: [{ ...data.outputs[0], ratio }, data.outputs[1]] }).success).toBe(false)
    }
    const normalized = SplitterNodeDataSchema.parse({ ...data, outputs: [{ ...data.outputs[0], ratio: 0.400000001 }, data.outputs[1]] })
    expect(normalized.outputs.reduce((sum, output) => sum + output.ratio, 0)).toBeCloseTo(1, 14)
  })
  it('rejects input/output reuse and merged output pools even if ratios are zero', () => {
    const input = splitterFixture()
    input.edges.push({ id: 'loop', source: 'f', target: 'f', sourceHandle: 'a', targetHandle: 'in' })
    expect(() => compileNetwork(input)).toThrow('input and output cannot share')
    input.edges.pop()
    input.edges.push({ id: 'merge', source: 'f', target: 't', sourceHandle: 'b', targetHandle: 't' })
    expect(() => compileNetwork(input)).toThrow('outputs cannot merge')
  })
  it('retains ratios while cloning every port identity and internal edge', () => {
    const input = splitterFixture()
    const copied = cloneSubgraph(input.nodes, input.edges)
    const splitter = copied.nodes.find(node => node.type === 'splitterNode')!
    expect(splitter.data.outputs.map((output: { ratio: number }) => output.ratio)).toEqual([0.4, 0.6])
    expect(splitter.data.input.portId).not.toBe('in')
    expect(splitter.data.outputs.map((output: { portId: string }) => output.portId)).not.toContain('a')
    expect(copied.edges.find(edge => edge.source === splitter.id)?.sourceHandle).toBe(splitter.data.outputs[0].portId)
    expect(Object.keys(copied.portAddresses)).toHaveLength(6)
  })
  it('roundtrips persistent ports and ratios through versioned save/import', () => {
    const input = splitterFixture()
    const { document } = readCanvasDocument(JSON.parse(JSON.stringify({ version: 5, pluginApiVersion: 2, environment: DEFAULT_UNIT_SNAPSHOT, networkConfiguration: input.configuration, ui: { nodes: input.nodes, edges: input.edges }, domain: { recipes: {} } })))
    const splitter = document.ui.nodes.find(node => node.type === 'splitterNode')!
    expect(splitter.data.input.portId).toBe('in')
    expect(splitter.data.outputs.map((output: { ratio: number }) => output.ratio)).toEqual([0.4, 0.6])
    const compiled = compileNetwork({ ...input, nodes: document.ui.nodes, edges: document.ui.edges })
    expect(compiled.request.variables.map(variable => variable.id.split(':')[0])).toEqual(['splitter', 'source', 'delivery', 'delivery'])
    expect(compiled.provenance.variables.some(origin => origin.kind === 'operation')).toBe(false)
  })
  it('restores splitter data and connections through undo and redo snapshots', () => {
    const input = splitterFixture()
    const original = captureSnapshot([], [])
    try {
      useCanvasStore.getState().setNetworkConfiguration(input.configuration!)
      const before = captureSnapshot(input.nodes, input.edges)
      input.nodes[0].data.outputs[0].ratio = 0.25
      input.nodes[0].data.outputs[1].ratio = 0.75
      const after = captureSnapshot(input.nodes, input.edges)
      restoreSnapshot(before)
      useCanvasStore.getState().setNodes(before.nodes)
      useCanvasStore.getState().setEdges(before.edges)
      expect(useCanvasStore.getState().nodes.find(node => node.id === 'f')!.data.outputs[0].ratio).toBe(0.4)
      restoreSnapshot(after)
      useCanvasStore.getState().setNodes(after.nodes)
      useCanvasStore.getState().setEdges(after.edges)
      expect(useCanvasStore.getState().nodes.find(node => node.id === 'f')!.data.outputs[0].ratio).toBe(0.25)
      expect(useCanvasStore.getState().edges).toHaveLength(3)
    } finally { restoreSnapshot(original); useCanvasStore.getState().setNodes(original.nodes); useCanvasStore.getState().setEdges(original.edges) }
  })
})
