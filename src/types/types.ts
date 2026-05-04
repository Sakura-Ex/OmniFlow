export type ResourceCategory = string

export type RoutingMode = 'global' | 'wired'

export type MeasureMode = 'per_cycle' | 'rate_per_tick' | 'rate_per_sec'

export interface Resource {
  category: ResourceCategory
  id: string
  amount: number
  measure_mode?: MeasureMode
  consumable?: boolean
  probability?: number
  routing_mode?: RoutingMode
  routing_locked?: boolean
  is_utility?: boolean
  utility_type?: string
  amount_mutable?: boolean
  _uid?: string
}

export interface UtilityDef {
  type: string
  amount_mutable: boolean
  routing_mode: RoutingMode
  routing_locked: boolean
  measure_mode?: MeasureMode
}

export interface MachineArchetype {
  id: string
  name: string
  fixed_utilities: Record<string, UtilityDef>
  default_modifiers: string[]
}
