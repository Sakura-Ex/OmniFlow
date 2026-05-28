import type { ValueOf } from '@/common/types/common'
import type { Resource, ComputedNodePayload, RoutingMode } from '@/common/types/resource'

export type RecipePort = Resource

export const EndpointRole = {
  Source: 'source',
  Target: 'target',
} as const satisfies Record<string, string>

export type EndpointRole = ValueOf<typeof EndpointRole>

export interface EndpointPort {
  id: string
  amount: number
  category: string
  routing_mode?: RoutingMode
  routing_locked?: boolean
  _uid?: string
  [key: string]: unknown
}

export const SourceNodeMode = {
  Limit: 'limit',
  Infinite: 'infinite',
} as const satisfies Record<string, string>

export type SourceNodeMode = ValueOf<typeof SourceNodeMode>

export const RecipeNodeMode = {
  Limit: 'limit',
  Auto: 'auto',
} as const satisfies Record<string, string>

export type RecipeNodeMode = ValueOf<typeof RecipeNodeMode>

export const TargetNodeMode = {
  Demand: 'demand',
  Maximize: 'maximize',
  Overflow: 'overflow',
} as const satisfies Record<string, string>

export type TargetNodeMode = ValueOf<typeof TargetNodeMode>

export interface SourceNodeData {
  ports?: EndpointPort[]
  mode?: SourceNodeMode
  actual_amounts?: Record<string, number>
  is_virtual?: boolean
}

export interface TargetNodeData {
  ports?: EndpointPort[]
  mode?: TargetNodeMode
  actual_amounts?: Record<string, number>
  is_virtual?: boolean
}

export const MachineSystem = {
  GregTech: 'gregtech',
  EnderIO: 'enderio',
  Thermal: 'thermal',
  Vanilla: 'vanilla',
} as const satisfies Record<string, string>

export type KnownMachineSystem = ValueOf<typeof MachineSystem>
export type MachineSystem = KnownMachineSystem | (string & {})

export interface ActiveModifier {
  instance_id: string
  definition_id: string
  uiState: Record<string, unknown>
}

export interface RecipeNodeData {
  recipe_id: string
  machine_name: string
  system: MachineSystem
  archetype_id?: string
  duration_seconds: number
  _computed?: ComputedNodePayload
  inputs: RecipePort[]
  outputs: RecipePort[]
  base_inputs?: Resource[]
  base_outputs?: Resource[]
  base_utility_inputs?: Resource[]
  base_utility_outputs?: Resource[]
  base_duration_seconds?: number
  active_modifiers?: ActiveModifier[]
  modifier_states?: Record<string, Record<string, unknown>>
  hardware_specs?: Record<string, unknown>
  mode?: RecipeNodeMode
  manual_machines?: number
  machines_exact?: number
  machines_actual?: number
  utilization?: number
  is_implemented?: boolean
  metadata: {
    eu_per_tick?: number
    rf_per_tick?: number
    base_voltage?: string
    can_overclock?: boolean
    [key: string]: unknown
  }
}
