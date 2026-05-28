import type { ValueOf } from '@/common/types/common'

export type ResourceCategory = string

export const RoutingMode = {
  Global: 'global',
  Wired: 'wired',
} as const satisfies Record<string, string>

export type RoutingMode = ValueOf<typeof RoutingMode>

export const TimeBase = {
  PerCycle: 'per_cycle',
  RatePerTick: 'rate_per_tick',
  RatePerSec: 'rate_per_sec',
} as const satisfies Record<string, string>

export type TimeBase = ValueOf<typeof TimeBase>

export const ResourceIo = {
  Input: 'input',
  Output: 'output',
} as const satisfies Record<string, string>

export type ResourceIo = ValueOf<typeof ResourceIo>

export interface Resource {
  category: ResourceCategory
  id: string
  amount: number
  time_base?: TimeBase
  consumable?: boolean
  probability?: number
  routing_mode?: RoutingMode
  routing_locked?: boolean
  is_utility?: boolean
  is_utility_output?: boolean
  utility_type?: string
  amount_mutable?: boolean
  _uid?: string
  [key: string]: unknown
}

export interface NormalizedResource {
  category: ResourceCategory
  id: string
  amount: number
  time_base?: TimeBase
  consumable?: boolean
  probability?: number
  routing_mode?: RoutingMode
  routing_locked?: boolean
  is_utility: boolean
  utility_type?: string
  amount_mutable?: boolean
  _uid?: string
}

export interface ComputedNodePayload {
  recipe_inputs: NormalizedResource[]
  recipe_outputs: NormalizedResource[]
  utility_inputs: NormalizedResource[]
  utility_outputs: NormalizedResource[]
  duration_seconds: number
}

export interface UtilityDef {
  type: string
  resource_id?: string
  amount_mutable: boolean
  routing_mode: RoutingMode
  routing_locked: boolean
  time_base?: TimeBase
  io?: ResourceIo
}

export interface ArchetypeTrait {
  key: string
  label: string
  default: unknown
}

export interface MachineArchetype {
  id: string
  name: string
  fixed_utilities: Record<string, UtilityDef>
  default_modifiers: string[]
  traits?: Record<string, ArchetypeTrait>
}

export interface ResourceDef {
  fullId: string
  displayName?: string
  description?: string
  tags?: string[]
}
