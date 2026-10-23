import type { UnitSystem } from '@/common/units/UnitSystem'
import type { Resource } from '@/common/types/resource'
import type { ValueOf } from '@/common/types/common'

/** Supported UI control types for modifier configuration fields. */
export const ModifierUIControlType = {
  Toggle: 'toggle',
  Select: 'select',
  Number: 'number',
  Slider: 'slider',
} as const satisfies Record<string, string>

/** Union type of all modifier UI control type values. */
export type ModifierUIControlType = ValueOf<typeof ModifierUIControlType>

/** Configuration definition for a single UI control in a modifier's settings form. */
export interface ModifierUIConfig {
  /** Unique key used to store and retrieve the control's value in state. */
  key: string
  /** Human-readable label displayed next to the control. */
  label: string
  /** The type of UI control to render. */
  type: ModifierUIControlType
  /** Available options for a `select` control. */
  options?: string[]
  /** Default value assigned when the modifier is first created. */
  defaultValue: unknown
  /** Minimum allowed value for `number` or `slider` controls. */
  min?: number
  /** Maximum allowed value for `number` or `slider` controls. */
  max?: number
  /** Step increment for `number` or `slider` controls. */
  step?: number
}

/** Read-only snapshot. Plugins return effects; only the pipeline applies changes. */
export interface PipelineContext {
  readonly instanceId: string
  readonly units: UnitSystem
  readonly actualParallel: number
  /** Recipe material inputs (ingredients) after modifier transformations. */
  readonly recipeInputs: readonly Readonly<Resource>[]
  /** Recipe product outputs after modifier transformations. */
  readonly recipeOutputs: readonly Readonly<Resource>[]
  /** Utility inputs (e.g. energy, fluids) after modifier transformations. */
  readonly utilityInputs: readonly Readonly<Resource>[]
  /** Utility outputs (e.g. byproduct energy, waste) after modifier transformations. */
  readonly utilityOutputs: readonly Readonly<Resource>[]
  /** Current duration in seconds after modifier transformations. */
  readonly durationSeconds: number
  /** Explicit eligibility state; port evidence remains available when stopped. */
  readonly machineStopped: boolean
  /** Machine hardware specifications (e.g. energy hatches, tier data). */
  readonly hardwareSpecs: Readonly<Record<string, unknown>>
  /** Snapshot of the context before any modifiers were applied (untransformed baseline). */
  readonly baseline: {
    readonly recipeInputs: readonly Readonly<Resource>[]
    readonly recipeOutputs: readonly Readonly<Resource>[]
    readonly utilityInputs: readonly Readonly<Resource>[]
    readonly utilityOutputs: readonly Readonly<Resource>[]
    readonly durationSeconds: number
  }
}

/** Describes a single machine modifier plugin — its identity, serializable configuration, and evaluation logic. */
export interface IMachineModifier {
  /** Unique identifier for this modifier (e.g. `gt_overclocker`). */
  id: string
  apiVersion: 2
  version: number
  after?: string[]
  requires?: string[]
  /** Human-readable display name. */
  name: string
  /** UI schema describing the controls shown in the modifier card. */
  ui_schema: ModifierUIConfig[]
  /** Machine archetypes this modifier is compatible with. Empty / undefined means universally compatible. */
  compatible_archetypes?: string[]
  /** Maximum number of times this modifier can be placed on a single machine node. */
  max_placements?: number
  /** Core evaluation function that transforms the pipeline context given the current UI state. */
  evaluate: (
    ctx: PipelineContext,
    uiState: Readonly<Record<string, unknown>>
  ) => ModifierEffect
}

/** Declarative replacement effects; only the pipeline applies them. */
export interface ModifierEffect {
  recipeInputs?: readonly Readonly<Resource>[]
  recipeOutputs?: readonly Readonly<Resource>[]
  utilityInputs?: readonly Readonly<Resource>[]
  utilityOutputs?: readonly Readonly<Resource>[]
  durationSeconds?: number
  actualParallel?: number
  machineStopped?: boolean
  reason?: string
}
