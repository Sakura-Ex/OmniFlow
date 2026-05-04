export type ResourceCategory = 'item' | 'fluid' | 'energy' | 'stress' | 'heat'
export type RoutingMode = 'global' | 'wired'

export interface Resource {
  category: ResourceCategory
  id: string
  amount: number
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
}

export interface MachineArchetype {
  id: string
  name: string
  fixed_utilities: Record<string, UtilityDef>
  default_modifiers: string[]
}
