import type { Resource, ResourceCategory } from './types'

export type RecipePortKind = ResourceCategory

export interface RecipePort extends Resource {
  /** @deprecated legacy field, mapped from category for old payloads */
  type?: 'item' | 'fluid'
}

/** 供应源模式：limit=设定上限 | infinite=无限供应 */
export type SourceNodeMode = 'limit' | 'infinite'
/** 配方机器模式：limit=产能上限 | auto=按需运转 */
export type RecipeNodeMode = 'limit' | 'auto'
/** 目标产出模式：demand=固定需求 | maximize=最大化产出 | overflow=溢出排放 */
export type TargetNodeMode = 'demand' | 'maximize' | 'overflow'

export interface SourceNodeData {
  id: string
  label: string
  amount: number
  item_type?: 'item' | 'fluid'
  mode?: SourceNodeMode
  /** @deprecated 由 mode 替代，保留以兼容旧存档 */
  is_auto?: boolean
  actual_amount?: number
  is_virtual?: boolean
}

export interface TargetNodeData {
  id: string
  label: string
  amount: number
  item_type?: 'item' | 'fluid'
  mode?: TargetNodeMode
  /** @deprecated 由 mode 替代，保留以兼容旧存档 */
  is_auto?: boolean
  actual_amount?: number
  is_virtual?: boolean
}

export type MachineSystem = 'gregtech' | 'enderio' | 'thermal' | 'vanilla' | string

export interface RecipeNodeData {
  recipe_id: string
  machine_name: string
  system: MachineSystem
  archetype_id?: string
  duration_seconds: number
  /** @deprecated legacy tick field retained only for backward compatibility */
  duration_ticks?: number
  inputs: RecipePort[]
  outputs: RecipePort[]
  base_inputs?: Resource[]
  base_outputs?: Resource[]
  base_duration_seconds?: number
  /** @deprecated legacy tick field retained only for backward compatibility */
  base_duration?: number
  active_modifiers?: string[]
  modifier_states?: Record<string, Record<string, unknown>>
  mode?: RecipeNodeMode
  /** @deprecated 由 mode 替代，保留以兼容旧存档 */
  is_auto?: boolean
  manual_machines?: number
  machines_exact?: number
  machines_actual?: number
  utilization?: number
  metadata: {
    eu_per_tick?: number
    rf_per_tick?: number
    base_voltage?: string
    can_overclock?: boolean
    [key: string]: unknown
  }
}