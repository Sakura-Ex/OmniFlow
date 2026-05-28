import type { ValueOf } from '@/common/types/common'
import type { Resource, ComputedNodePayload, RoutingMode } from '@/common/types/resource'

/**
 * A recipe port is a type alias for {@link Resource}, representing an input or
 * output slot on a recipe.
 */
export type RecipePort = Resource

/**
 * Defines which side of an endpoint connection a node occupies.
 * - `Source`: the node that produces or supplies resources.
 * - `Target`: the node that receives or consumes resources.
 */
export const EndpointRole = {
  Source: 'source',
  Target: 'target',
} as const satisfies Record<string, string>

/** Union type of all {@link EndpointRole} values. */
export type EndpointRole = ValueOf<typeof EndpointRole>

/**
 * A port definition on a source or target endpoint node.
 */
export interface EndpointPort {
  /** Resource identifier within the port's category. */
  id: string
  /** Amount of the resource flowing through this port. */
  amount: number
  /** Resource category (e.g. "item", "fluid"). */
  category: string
  /** Routing mode for this port. */
  routing_mode?: RoutingMode
  /** Whether the routing mode is locked. */
  routing_locked?: boolean
  /** Internal unique ID for tracking. */
  _uid?: string
  [key: string]: unknown
}

/**
 * Operating modes for a source (producer) node.
 * - `Limit`: the source supplies up to a configured limit.
 * - `Infinite`: the source supplies an unlimited amount.
 */
export const SourceNodeMode = {
  Limit: 'limit',
  Infinite: 'infinite',
} as const satisfies Record<string, string>

/** Union type of all {@link SourceNodeMode} values. */
export type SourceNodeMode = ValueOf<typeof SourceNodeMode>

/**
 * Operating modes for a recipe (processing) node.
 * - `Limit`: the node runs a fixed number of machines.
 * - `Auto`: the node automatically scales machines to meet demand.
 */
export const RecipeNodeMode = {
  Limit: 'limit',
  Auto: 'auto',
} as const satisfies Record<string, string>

/** Union type of all {@link RecipeNodeMode} values. */
export type RecipeNodeMode = ValueOf<typeof RecipeNodeMode>

/**
 * Operating modes for a target (consumer) node.
 * - `Demand`: the target pulls a fixed amount of resources.
 * - `Maximize`: the target consumes as much as available.
 * - `Overflow`: the target sinks excess resources.
 */
export const TargetNodeMode = {
  Demand: 'demand',
  Maximize: 'maximize',
  Overflow: 'overflow',
} as const satisfies Record<string, string>

/** Union type of all {@link TargetNodeMode} values. */
export type TargetNodeMode = ValueOf<typeof TargetNodeMode>

/**
 * Data specific to a source (producer/supplier) node in the flow graph.
 */
export interface SourceNodeData {
  /** Ports defining what resources the source supplies. */
  ports?: EndpointPort[]
  /** Operating mode of the source node. */
  mode?: SourceNodeMode
  /** Actual throughput amounts after solver execution, keyed by resource ID. */
  actual_amounts?: Record<string, number>
  /** Whether this is a virtual node (internal/auto-generated). */
  is_virtual?: boolean
}

/**
 * Data specific to a target (consumer/sink) node in the flow graph.
 */
export interface TargetNodeData {
  /** Ports defining what resources the target demands. */
  ports?: EndpointPort[]
  /** Operating mode of the target node. */
  mode?: TargetNodeMode
  /** Actual throughput amounts after solver execution, keyed by resource ID. */
  actual_amounts?: Record<string, number>
  /** Whether this is a virtual node (internal/auto-generated). */
  is_virtual?: boolean
}

/**
 * Known machine system identifiers for built-in mod support.
 * - `GregTech`: GregTech machine system.
 * - `EnderIO`: Ender IO machine system.
 * - `Thermal`: Thermal Series machine system.
 * - `Vanilla`: Vanilla Minecraft machine system.
 */
export const MachineSystem = {
  GregTech: 'gregtech',
  EnderIO: 'enderio',
  Thermal: 'thermal',
  Vanilla: 'vanilla',
} as const satisfies Record<string, string>

/** Union type of all known {@link MachineSystem} values. */
export type KnownMachineSystem = ValueOf<typeof MachineSystem>
/**
 * Represents any machine system — one of the known values from
 * {@link KnownMachineSystem} or an arbitrary custom string.
 */
export type MachineSystem = KnownMachineSystem | (string & {})

/**
 * An active modifier (overclock, speed upgrade, etc.) applied to a recipe node.
 */
export interface ActiveModifier {
  /** Unique instance identifier for this modifier application. */
  instance_id: string
  /** Definition ID referencing the modifier's template/blueprint. */
  definition_id: string
  /** Arbitrary UI state associated with this modifier instance. */
  uiState: Record<string, unknown>
}

/**
 * Full data payload for a recipe/processing node in the production flow.
 */
export interface RecipeNodeData {
  /** Identifier of the recipe being executed. */
  recipe_id: string
  /** Display name of the machine running the recipe. */
  machine_name: string
  /** Machine system this recipe belongs to (e.g. "gregtech", "vanilla"). */
  system: MachineSystem
  /** Optional archetype ID for the machine. */
  archetype_id?: string
  /** Duration of one recipe cycle in seconds. */
  duration_seconds: number
  /** Computed payload from the solver (populated after calculation). */
  _computed?: ComputedNodePayload
  /** Resources consumed by this recipe. */
  inputs: RecipePort[]
  /** Resources produced by this recipe. */
  outputs: RecipePort[]
  /** Original (unmodified) recipe inputs before any modifier adjustments. */
  base_inputs?: Resource[]
  /** Original (unmodified) recipe outputs before any modifier adjustments. */
  base_outputs?: Resource[]
  /** Original (unmodified) utility inputs before any modifier adjustments. */
  base_utility_inputs?: Resource[]
  /** Original (unmodified) utility outputs before any modifier adjustments. */
  base_utility_outputs?: Resource[]
  /** Original (unmodified) recipe duration before any modifier adjustments. */
  base_duration_seconds?: number
  /** Active modifiers currently applied to this node. */
  active_modifiers?: ActiveModifier[]
  /** Arbitrary state data for each active modifier, keyed by modifier ID. */
  modifier_states?: Record<string, Record<string, unknown>>
  /** Hardware specification overrides (e.g. voltage tier, speed tier). */
  hardware_specs?: Record<string, unknown>
  /** Operating mode of this recipe node. */
  mode?: RecipeNodeMode
  /** Number of machines set manually by the user (overrides auto-scaling). */
  manual_machines?: number
  /** Exact (floating-point) machine count from the solver. */
  machines_exact?: number
  /** Actual integer machine count (ceiling of exact). */
  machines_actual?: number
  /** Machine utilization rate (0.0 to 1.0). */
  utilization?: number
  /** Whether this node is implemented in the current solver. */
  is_implemented?: boolean
  /** Machine-specific metadata (energy, overclocking, etc.). */
  metadata: {
    /** Energy consumption in EU per tick (GregTech). */
    eu_per_tick?: number
    /** Energy consumption in RF per tick (Thermal). */
    rf_per_tick?: number
    /** Base voltage tier identifier. */
    base_voltage?: string
    /** Whether this machine supports overclocking. */
    can_overclock?: boolean
    [key: string]: unknown
  }
}
