import { stripCalculationResults } from '@/common/utils/calculationState'
import { portKey } from '@/features/calculation/topology'
import type { Node, Edge } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import { generateId } from '@/common/utils/id'
import { normalizeGraph } from './graphDocument'

/**
 * Clone node, port and modifier identities and remap only internal edges.
 * @returns Copied nodes, internal edges and remapped recipes.
 * @param nodes - Canvas nodes.
 * @param edges - Canvas edges with persistent port handles.
 * @param offset - Position offset applied to copied nodes.
 */
export function cloneSubgraph(nodes: Node[], edges: Edge[], offset = 30) {
  const graph = normalizeGraph(structuredClone(nodes).map(node => ({ ...node, data: stripCalculationResults(node.data) })), structuredClone(edges))
  const nodeIds = new Map(nodes.map((node) => [node.id, generateId()]))
  const handleMaps = new Map<string, Map<string, string>>()
  const instanceMaps = new Map<string, Map<string, string>>()
  const nextNodes = graph.nodes.map((node) => {
    const handles = new Map<string, string>()
    const instances = new Map<string, string>()
    handleMaps.set(node.id, handles)
    instanceMaps.set(node.id, instances)
    const data = structuredClone(node.data)
    if (node.type === 'splitterNode') {
      for (const port of [data.input, ...data.outputs]) handles.set(port.portId, generateId())
      data.input = { ...data.input, portId: handles.get(data.input.portId) }
      data.outputs = data.outputs.map((port: { portId: string }) => ({ ...port, portId: handles.get(port.portId) }))
      delete data.port_throughputs
    }
    for (const field of node.type === 'recipeNode' ? ['base_inputs', 'base_outputs', 'base_utility_inputs', 'base_utility_outputs', 'inputs', 'outputs'] : node.type === 'splitterNode' ? [] : ['ports']) {
      data[field] = (data[field] ?? []).map((port: { portId?: string; _uid?: string }) => {
        if (port.portId && !handles.has(port.portId)) handles.set(port.portId, generateId())
        return { ...port, portId: port.portId ? handles.get(port.portId) : generateId(), _uid: port._uid?.startsWith('utility-') ? port._uid : generateId() }
      })
    }
    if (node.type === 'recipeNode') {
      data.active_modifiers = (data.active_modifiers ?? []).map((inst: { instance_id: string }) => {
        const instance_id = generateId()
        instances.set(inst.instance_id, instance_id)
        return { ...inst, instance_id }
      })
      data.recipe_id = `${data.recipe_id}:${nodeIds.get(node.id)}`
      delete data._computed
    }
    delete data.actual_amounts
    delete data.machines_exact
    delete data.machines_actual
    delete data.utilization
    return { ...node, id: nodeIds.get(node.id)!, data, position: { x: node.position.x + offset, y: node.position.y + offset }, selected: true }
  })
  const remap = (nodeId: string, handle: string | null | undefined) => {
    if (!handle) return handle
    const base = handleMaps.get(nodeId)?.get(handle)
    if (base) return base
    for (const [before, after] of instanceMaps.get(nodeId) ?? []) {
      if (handle.startsWith(`dynamic:${before}:`)) return `dynamic:${after}:${handle.slice(`dynamic:${before}:`.length)}`
    }
    return handle
  }
  const nextEdges = graph.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)).map((edge) => ({ ...edge, id: generateId(), source: nodeIds.get(edge.source)!, target: nodeIds.get(edge.target)!, sourceHandle: remap(edge.source, edge.sourceHandle), targetHandle: remap(edge.target, edge.targetHandle), selected: true }))
  const portAddresses: Record<string, string> = {}
  for (const node of graph.nodes) {
    for (const port of node.type === 'recipeNode' ? [...node.data.base_inputs ?? [], ...node.data.base_outputs ?? [], ...node.data.base_utility_inputs ?? [], ...node.data.base_utility_outputs ?? []] : node.type === 'splitterNode' ? [node.data.input, ...node.data.outputs] : node.data.ports ?? []) {
      portAddresses[portKey(node.id, port.portId)] = portKey(nodeIds.get(node.id)!, remap(node.id, port.portId)!)
    }
  }
  return { nodeIds: Object.fromEntries(nodeIds), portAddresses, remapPort: remap, nodes: nextNodes, edges: nextEdges, recipes: Object.fromEntries(nextNodes.filter((n) => n.type === 'recipeNode').map((n) => [n.id, n.data as RecipeNodeData])) }
}
