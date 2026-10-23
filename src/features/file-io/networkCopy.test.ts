import { expect, it } from 'vitest'
import type { Node } from 'reactflow'
import { cloneSubgraph } from '@/features/canvas/cloneSubgraph'
import { remapNetworkConfiguration } from '@/features/calculation/networkConfig'
import type { NetworkConfiguration } from '@/common/schemas/network.schema'

it('copies endpoint assumptions to new identities without retaining references to the original graph', () => {
  const node: Node = { id: 's', type: 'sourceNode', position: { x: 0, y: 0 }, data: { ports: [{ portId: 'p', category: 'item', id: 'ore', amount: 1 }] } }
  const policy = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' as const }, boundary: { kind: 'source' as const, capacity: 7 } }
  const configuration: NetworkConfiguration = { version: 1, ports: { '["s","p"]': policy, '["outside","p"]': policy }, machines: { outside: { installed: 3, operatingUpper: null } } }
  const copied = cloneSubgraph([node], [])
  const remapped = remapNetworkConfiguration(configuration, copied.nodeIds, copied.portAddresses)
  const address = JSON.stringify([copied.nodes[0].id, copied.nodes[0].data.ports[0].portId])
  expect(remapped.ports).toEqual({ [address]: policy })
  expect(remapped.machines).toEqual({})
  expect(configuration.ports['["s","p"]']).toEqual(policy)
})
