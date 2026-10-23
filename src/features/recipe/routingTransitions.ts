import type { Edge } from 'reactflow'
import type { RecipeNodeData, SourceNodeData, TargetNodeData } from '@/common/types/recipe'
import type { RoutingMode } from '@/common/types/resource'

/** Editable routing intent retains direction and persistent port identity. */
export interface EditableRoutingPort {
  portId: string
  direction: 'input' | 'output'
  routingMode?: RoutingMode
}

/**
 * Read saved routing intent without evaluating modifiers or repairing invalid ports.
 * @param type - Edited recipe or endpoint role.
 * @param data - Authoritative editable node data.
 * @returns Existing persistent ports and their explicit routing modes.
 */
export function editableRoutingPorts(type: 'recipeNode' | 'sourceNode' | 'targetNode', data: RecipeNodeData | SourceNodeData | TargetNodeData): EditableRoutingPort[] {
  const groups: Array<['input' | 'output', { portId?: string; routing_mode?: RoutingMode }[]]> = type === 'recipeNode'
    ? (() => {
      const recipe = data as RecipeNodeData
      return [['input', [...recipe.base_inputs ?? recipe.inputs, ...recipe.base_utility_inputs ?? []]], ['output', [...recipe.base_outputs ?? recipe.outputs, ...recipe.base_utility_outputs ?? []]]]
    })()
    : [[type === 'sourceNode' ? 'output' : 'input', (data as SourceNodeData | TargetNodeData).ports ?? []]]
  return groups.flatMap(([direction, ports]) => ports.flatMap(port => port.portId ? [{ portId: port.portId, direction, routingMode: port.routing_mode }] : []))
}

/**
 * Disconnect only previously wired ports explicitly switched to global on save.
 * @param nodeId - Persistent edited node identity.
 * @param before - Routing intent before the user's edit.
 * @param after - Routing intent saved by the user.
 * @param edges - Existing physical edges, including unrelated invalid edges.
 * @returns Remaining original edges; unchanged identity when nothing was switched.
 */
export function disconnectNewGlobalPorts(nodeId: string, before: readonly EditableRoutingPort[], after: readonly EditableRoutingPort[], edges: Edge[]): Edge[] {
  const address = (port: EditableRoutingPort) => JSON.stringify([port.direction, port.portId])
  const previous = new Map(before.map(port => [address(port), port]))
  const inputs = new Set<string>(), outputs = new Set<string>()
  for (const port of after) {
    const old = previous.get(address(port))
    if (old && old.routingMode !== 'global' && port.routingMode === 'global') (port.direction === 'input' ? inputs : outputs).add(port.portId)
  }
  if (!inputs.size && !outputs.size) return edges
  return edges.filter(edge => !(edge.source === nodeId && outputs.has(edge.sourceHandle ?? '')) && !(edge.target === nodeId && inputs.has(edge.targetHandle ?? '')))
}
