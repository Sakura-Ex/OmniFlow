import type { Resource, ComputedNodePayload } from './types'

export type RecipePort = Resource

export interface EndpointPort {
  id: string
  amount: number
  category: string
  routing_mode?: 'wired' | 'global'
  routing_locked?: boolean
  _uid?: string
  [key: string]: unknown
}

/** 供应源模式：limit=设定上限 | infinite=无限供应 */
export type SourceNodeMode = 'limit' | 'infinite'
/** 配方机器模式：limit=产能上限 | auto=按需运转 */
export type RecipeNodeMode = 'limit' | 'auto'
/** 目标产出模式：demand=固定需求 | maximize=最大化产出 | overflow=溢出排放 */
export type TargetNodeMode = 'demand' | 'maximize' | 'overflow'

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

export type MachineSystem = 'gregtech' | 'enderio' | 'thermal' | 'vanilla' | string

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
