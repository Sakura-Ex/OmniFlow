import { stripCalculationResults } from '@/common/utils/calculationState'
import { SplitterNodeDataSchema, type SplitterNodeData } from '@/common/schemas/splitter.schema'
import { generateId } from '@/common/utils/id'
import type { GraphPort } from './graphPorts'
import { buildResourceId } from '@/common/utils/resourceId'

/**
 * Create a visible 40:60 splitter draft with independent persistent ports.
 * @param resource - Initial resource category and identity.
 * @returns A fixed-ratio splitter ready for canvas editing.
 */
export function createSplitterData(resource = { category: 'item', id: '' }): SplitterNodeData {
  const input = { ...resource, portId: generateId(), amount: 1, routing_mode: 'wired' as const }
  return { input, outputs: [0.4, 0.6].map(ratio => ({ ...input, portId: generateId(), ratio })), capacity: null }
}

/**
 * Project validated allocation ports into the common final-port topology.
 * @param nodeId - Persistent splitter identity.
 * @param raw - Serializable splitter node data.
 * @returns Independent gross input/output allocation coefficients.
 */
export function splitterPorts(nodeId: string, raw: unknown): GraphPort[] {
  const data = SplitterNodeDataSchema.parse(raw && typeof raw === 'object' && !Array.isArray(raw) ? stripCalculationResults(raw as Record<string, unknown>) : raw)
  const resourceId = buildResourceId(data.input.category, data.input.id)
  return [
    { nodeId, portId: data.input.portId, direction: 'input', resourceId, port: { ...data.input, amount: 1 } },
    ...data.outputs.map(output => ({ nodeId, portId: output.portId, direction: 'output' as const, resourceId, port: { ...output, amount: output.ratio } })),
  ]
}
