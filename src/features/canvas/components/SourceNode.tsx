import type { NodeProps } from 'reactflow'
import type { SourceNodeData } from '@/common/types/recipe'
import { EndpointNode } from './EndpointNode'

/**
 * Explicit source boundary with persistent resource ports.
 * @param root0 - Node props.
 * @param root0.id - Persistent node identity.
 * @param root0.data - Endpoint data.
 * @returns Source card.
 */
export function SourceNode({ id, data }: NodeProps<SourceNodeData>) {
  return <EndpointNode id={id} data={data} role="source" />
}
