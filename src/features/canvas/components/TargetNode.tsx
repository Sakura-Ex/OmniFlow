import type { NodeProps } from 'reactflow'
import type { TargetNodeData } from '@/common/types/recipe'
import { EndpointNode } from './EndpointNode'

/**
 * Explicit product delivery boundary with persistent resource ports.
 * @param root0 - Node props.
 * @param root0.id - Persistent node identity.
 * @param root0.data - Endpoint data.
 * @returns Delivery card.
 */
export function TargetNode({ id, data }: NodeProps<TargetNodeData>) {
  return <EndpointNode id={id} data={data} role="target" />
}
