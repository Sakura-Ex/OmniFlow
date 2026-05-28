import type { Resource } from '@/common/types/resource'
import type { ValueOf } from '@/common/types/common'
import type { ReactNode, FC } from 'react'

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

/** Mutable context object threaded through the modifier evaluation pipeline.
Each modifier reads and mutates this context to apply its effects. */
export interface PipelineContext {
  /** Recipe material inputs (ingredients) after modifier transformations. */
  recipeInputs: Resource[]
  /** Recipe product outputs after modifier transformations. */
  recipeOutputs: Resource[]
  /** Utility inputs (e.g. energy, fluids) after modifier transformations. */
  utilityInputs: Resource[]
  /** Utility outputs (e.g. byproduct energy, waste) after modifier transformations. */
  utilityOutputs: Resource[]
  /** Current duration in seconds after modifier transformations. */
  durationSeconds: number
  /** Whether the machine should be considered stopped (outputs zeroed). */
  machineStopped: boolean
  /** Machine hardware specifications (e.g. energy hatches, tier data). */
  hardwareSpecs: Record<string, unknown>
  /** Snapshot of the context before any modifiers were applied (untransformed baseline). */
  baseline: {
    recipeInputs: Resource[]
    recipeOutputs: Resource[]
    utilityInputs: Resource[]
    utilityOutputs: Resource[]
    durationSeconds: number
  }
}

/** Props passed to a modifier's custom card render-body component. */
export interface ModifierCardRenderProps {
  /** Current UI state values keyed by control key. */
  state: Record<string, unknown>
  /** Callback invoked when a UI control value changes. */
  onChange: (key: string, value: unknown) => void
  /** Whether the card is rendered in read-only (non-editable) mode. */
  readOnly?: boolean
  /** Injected Field layout wrapper component. */
  Field: FC<{ label: string; children: ReactNode }>
  /** Injected Toggle switch control component. */
  Toggle: FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }>
  /** Injected Select dropdown control component. */
  Select: FC<{ label: string; value: string; options: string[]; onChange: (v: string) => void }>
  /** Injected Slider control component. */
  Slider: FC<{ label: string; value: number; min: number; max: number; onChange: (v: number) => void }>
  /** Injected Number input control component. */
  Input: FC<{ label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }>
  /** Recipe inputs available for context-aware UI rendering. */
  recipeInputs?: Resource[]
  /** Recipe outputs available for context-aware UI rendering. */
  recipeOutputs?: Resource[]
  /** Machine hardware specifications for context-aware UI rendering. */
  hardwareSpecs?: Record<string, unknown>
}

/** Describes a single machine modifier plugin — its identity, UI configuration, and evaluation logic. */
export interface IMachineModifier {
  /** Unique identifier for this modifier (e.g. `gt_overclocker`). */
  id: string
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
    uiState: Record<string, unknown>
  ) => PipelineContext
  /** Optional custom card body renderer for complex modifier UIs. Falls back to auto-generated controls when omitted. */
  renderBody?: (props: ModifierCardRenderProps) => ReactNode
}
