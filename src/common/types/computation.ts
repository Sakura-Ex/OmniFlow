import type { NormalizedResource, Resource } from '@/common/types/resource'

/** Explainable modifier step with stable port-level changes. */
export interface ModifierTrace {
  instanceId: string
  definitionId: string
  version: number
  durationBefore: number
  durationAfter: number
  addedPorts: string[]
  removedPorts: string[]
  reason?: string
}

/** Final calculation inputs from a deterministic recipe/environment snapshot. */
export interface ComputationDetails {
  final_ports: { port: NormalizedResource; direction: 'input' | 'output' }[]
  eligibility: { eligible: boolean; reasons: string[] }
  actual_parallel: number
  bom_occupancy: { resource: Resource; basis: 'per_parallel_slot' | 'per_running_machine' | 'per_installed_machine'; amount: number }[]
  trace: ModifierTrace[]
  cache_key: string
}
