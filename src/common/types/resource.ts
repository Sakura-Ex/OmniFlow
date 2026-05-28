import type { ValueOf } from '@/common/types/common'

/**
 * A string identifier for a resource category (e.g. "item", "fluid", "energy").
 */
export type ResourceCategory = string

/**
 * Defines how resources are routed in the network.
 * - `Global`: resources are pooled globally across the entire network.
 * - `Wired`: resources travel through explicit connections.
 */
export const RoutingMode = {
  Global: 'global',
  Wired: 'wired',
} as const satisfies Record<string, string>

/** Union type of all {@link RoutingMode} values. */
export type RoutingMode = ValueOf<typeof RoutingMode>

/**
 * Defines the time base for resource amounts.
 * - `PerCycle`: amount is per recipe cycle.
 * - `RatePerTick`: amount is per game tick.
 * - `RatePerSec`: amount is per second.
 */
export const TimeBase = {
  PerCycle: 'per_cycle',
  RatePerTick: 'rate_per_tick',
  RatePerSec: 'rate_per_sec',
} as const satisfies Record<string, string>

/** Union type of all {@link TimeBase} values. */
export type TimeBase = ValueOf<typeof TimeBase>

/**
 * Defines the direction of resource flow.
 * - `Input`: resource flows into a node.
 * - `Output`: resource flows out of a node.
 */
export const ResourceIo = {
  Input: 'input',
  Output: 'output',
} as const satisfies Record<string, string>

/** Union type of all {@link ResourceIo} values. */
export type ResourceIo = ValueOf<typeof ResourceIo>

/**
 * A generic resource descriptor used in recipe ports and node definitions.
 */
export interface Resource {
  /** Resource category (e.g. "item", "fluid"). */
  category: ResourceCategory
  /** Unique identifier for the resource within its category. */
  id: string
  /** Quantity of the resource. */
  amount: number
  /** Time base the amount is expressed in. Defaults to rate-per-sec. */
  time_base?: TimeBase
  /** Whether the resource is consumed on use. */
  consumable?: boolean
  /** Probability (0.0 to 1.0) of this resource being produced/consumed. */
  probability?: number
  /** Routing mode override for this resource. */
  routing_mode?: RoutingMode
  /** Whether the routing mode is locked and cannot be changed. */
  routing_locked?: boolean
  /** Whether this resource is a utility (e.g. power, steam). */
  is_utility?: boolean
  /** Whether this resource is a utility output. */
  is_utility_output?: boolean
  /** discriminator for utility subtypes. */
  utility_type?: string
  /** Whether the amount can be mutated by modifiers. */
  amount_mutable?: boolean
  /** Internal unique ID for tracking. */
  _uid?: string
  [key: string]: unknown
}

/**
 * A normalized version of {@link Resource} where `is_utility` is required
 * and extra unknown keys have been stripped.
 */
export interface NormalizedResource {
  /** Resource category (e.g. "item", "fluid"). */
  category: ResourceCategory
  /** Unique identifier for the resource within its category. */
  id: string
  /** Quantity of the resource. */
  amount: number
  /** Time base the amount is expressed in. */
  time_base?: TimeBase
  /** Whether the resource is consumed on use. */
  consumable?: boolean
  /** Probability (0.0 to 1.0) of this resource being produced/consumed. */
  probability?: number
  /** Routing mode override for this resource. */
  routing_mode?: RoutingMode
  /** Whether the routing mode is locked. */
  routing_locked?: boolean
  /** Whether this resource is a utility. */
  is_utility: boolean
  /** discriminator for utility subtypes. */
  utility_type?: string
  /** Whether the amount can be mutated by modifiers. */
  amount_mutable?: boolean
  /** Internal unique ID for tracking. */
  _uid?: string
}

/**
 * The computed payload attached to a recipe node after solver execution.
 * Resources are split into recipe vs. utility groups for both inputs and outputs.
 */
export interface ComputedNodePayload {
  /** Non-utility resource inputs required by the recipe. */
  recipe_inputs: NormalizedResource[]
  /** Non-utility resource outputs produced by the recipe. */
  recipe_outputs: NormalizedResource[]
  /** Utility resource inputs (e.g. power, steam) required by the recipe. */
  utility_inputs: NormalizedResource[]
  /** Utility resource outputs produced by the recipe. */
  utility_outputs: NormalizedResource[]
  /** Duration of one recipe cycle in seconds. */
  duration_seconds: number
}

/**
 * Defines a utility resource type that a machine archetype can produce or consume.
 */
export interface UtilityDef {
  /** discriminator for the utility (e.g. "energy", "steam"). */
  type: string
  /** Optional resource ID to map this utility to a known resource. */
  resource_id?: string
  /** Whether the amount can be mutated by modifiers. */
  amount_mutable: boolean
  /** Default routing mode for this utility. */
  routing_mode: RoutingMode
  /** Whether the routing mode is locked. */
  routing_locked: boolean
  /** Default time base for this utility's amounts. */
  time_base?: TimeBase
  /** Direction of flow: input or output. */
  io?: ResourceIo
}

/**
 * A single configurable trait on a machine archetype.
 */
export interface ArchetypeTrait {
  /** Programmatic key used to identify the trait. */
  key: string
  /** Human-readable label shown in the UI. */
  label: string
  /** Default value for the trait. */
  default: unknown
}

/**
 * Defines a machine archetype — a template for a machine that can run recipes.
 */
export interface MachineArchetype {
  /** Unique identifier for the archetype. */
  id: string
  /** Human-readable display name. */
  name: string
  /** Fixed utility definitions the machine always has (e.g. power input). */
  fixed_utilities: Record<string, UtilityDef>
  /** Default modifier IDs applied to this archetype. */
  default_modifiers: string[]
  /** Optional custom traits for this archetype. */
  traits?: Record<string, ArchetypeTrait>
}

/**
 * A resolved resource definition with optional display metadata.
 */
export interface ResourceDef {
  /** Fully qualified resource ID (e.g. "item:iron_ingot"). */
  fullId: string
  /** Optional human-readable display name. */
  displayName?: string
  /** Optional description of the resource. */
  description?: string
  /** Optional tags for categorization. */
  tags?: string[]
}
