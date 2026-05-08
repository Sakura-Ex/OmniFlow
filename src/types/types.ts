export type ResourceCategory = string

export type RoutingMode = 'global' | 'wired'

export type TimeBase = 'per_cycle' | 'rate_per_tick' | 'rate_per_sec'

export interface Resource {
  category: ResourceCategory
  id: string
  amount: number
  time_base?: TimeBase
  consumable?: boolean
  consumable_probability?: number
  probability?: number
  routing_mode?: RoutingMode
  routing_locked?: boolean
  is_utility?: boolean
  utility_type?: string
  amount_mutable?: boolean
  _uid?: string
}

/** 管线归一化后的资源：amount 字段 = 纯每秒速率 (Rate/s) */
export interface NormalizedResource {
  category: ResourceCategory
  id: string
  amount: number
  time_base?: TimeBase
  consumable?: boolean
  consumable_probability?: number
  probability?: number
  routing_mode?: RoutingMode
  routing_locked?: boolean
  is_utility: boolean
  utility_type?: string
  amount_mutable?: boolean
  _uid?: string
}

/** 修饰器管线最终输出：四维独立，供 UI 精准渲染上下半区 */
export interface ComputedNodePayload {
  nodeId: string
  recipe_inputs: NormalizedResource[]
  recipe_outputs: NormalizedResource[]
  utility_inputs: NormalizedResource[]
  utility_outputs: NormalizedResource[]
  duration_seconds: number
  is_instant: boolean
}

export interface UtilityDef {
  type: string
  resource_id?: string
  amount_mutable: boolean
  routing_mode: RoutingMode
  routing_locked: boolean
  time_base?: TimeBase
  io?: 'input' | 'output'
}

export interface MachineArchetype {
  id: string
  name: string
  fixed_utilities: Record<string, UtilityDef>
  default_modifiers: string[]
}

export interface ResourceDef {
  fullId: string
  displayName?: string
  description?: string
  tags?: string[]
}
