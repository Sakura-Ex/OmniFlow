import type { NetworkCompileInput } from '@/features/calculation/networkCompiler'
import { compileNetwork } from '@/features/calculation/networkCompiler'
import { emptyNetworkConfiguration } from '@/common/schemas/network.schema'
import { portKey } from '@/features/calculation/topology'

/**
 * Construct a deterministic 40:60 shared-source allocation graph.
 * @returns Complete compiler inputs with explicit source and delivery boundaries.
 */
export function splitterFixture(): NetworkCompileInput {
  const configuration = emptyNetworkConfiguration()
  const resource = { category: 'item', id: 'ore', amount: 1 }
  configuration.ports[portKey('s', 's')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: { kind: 'source', capacity: 10 } }
  for (const target of ['t', 'u']) configuration.ports[portKey(target, target)] = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: { kind: 'delivery', mode: 'maximize', amount: 0, capacity: null, objective: { priority: 0, weight: 1, scale: 1 } } }
  return {
    nodes: [
      { id: 'f', type: 'splitterNode', position: { x: 0, y: 0 }, data: { input: { ...resource, portId: 'in' }, outputs: [{ ...resource, portId: 'a', ratio: 0.4 }, { ...resource, portId: 'b', ratio: 0.6 }], capacity: null } },
      { id: 's', type: 'sourceNode', position: { x: 0, y: 0 }, data: { ports: [{ ...resource, portId: 's' }] } },
      ...['t', 'u'].map(id => ({ id, type: 'targetNode', position: { x: 0, y: 0 }, data: { ports: [{ ...resource, portId: id }] } })),
    ],
    edges: [{ id: 'in', source: 's', target: 'f', sourceHandle: 's', targetHandle: 'in' }, { id: 'a', source: 'f', target: 't', sourceHandle: 'a', targetHandle: 't' }, { id: 'b', source: 'f', target: 'u', sourceHandle: 'b', targetHandle: 'u' }],
    recipes: {}, configuration, requestId: 'splitter-test', documentRevision: 1,
  }
}

/**
 * Compile release fixtures for fixed allocation and blocked branch semantics.
 * @returns Real solver requests with expected continuous throughput vectors.
 */
export function splitterCases() {
  const cases: Array<{ id: string; request: ReturnType<typeof compileNetwork>['request']; expected: { status: string; values: number[] } }> = []
  const add = (id: string, mutate: (input: NetworkCompileInput) => void, values: number[]) => {
    const input = splitterFixture()
    mutate(input)
    cases.push({ id, request: compileNetwork(input).request, expected: { status: 'success', values } })
  }
  const closeSecondBranch = (input: NetworkCompileInput) => {
    input.nodes = input.nodes.filter(node => node.id !== 'u')
    input.edges = input.edges.filter(edge => edge.target !== 'u')
    delete input.configuration!.ports[portKey('u', 'u')]
  }
  add('T13-fixed-40-60', () => {}, [10, 10, 4, 6])
  add('T13-blocked-branch-blocks-allocation', closeSecondBranch, [0, 0, 0])
  add('T13-explicit-spill-enables-branch', input => {
    closeSecondBranch(input)
    input.configuration!.ports[portKey('f', 'b')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: { kind: 'spill', capacity: null } }
  }, [10, 10, 4, 6])
  add('T13-fractional-capacity', input => { input.nodes[0].data.capacity = 2.5 }, [2.5, 2.5, 1, 1.5])
  add('T13-branch-delivery-bottleneck', input => {
    input.configuration!.ports[portKey('t', 't')].boundary = { kind: 'delivery', mode: 'maximize', amount: 0, capacity: 1, objective: { priority: 0, weight: 1, scale: 1 } }
  }, [2.5, 2.5, 1, 1.5])
  add('T13-spill-capacity-bottleneck', input => {
    closeSecondBranch(input)
    input.configuration!.ports[portKey('f', 'b')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: { kind: 'spill', capacity: 3 } }
  }, [5, 5, 2, 3])
  add('T13-zero-branch-does-not-block', input => {
    closeSecondBranch(input)
    input.nodes[0].data.outputs[0].ratio = 1
    input.nodes[0].data.outputs[1].ratio = 0
  }, [10, 10, 10])
  return cases
}
