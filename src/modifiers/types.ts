import type { Resource } from '../types/types'

export type ModifierUIControlType = 'toggle' | 'select' | 'number' | 'slider'

export interface ModifierUIConfig {
  key: string
  label: string
  type: ModifierUIControlType
  options?: string[]
  defaultValue: unknown
}

export interface ModifierEffect {
  /** Phase 1 — Parallel: multiply ALL resources (inputs, outputs, utilities) uniformly */
  parallelMultiplier?: number
  /** Phase 2 — Targeted Overclocking: per-utility-type multipliers.
   *  Only utilities whose utility_type matches a key are multiplied. */
  utilityMultipliers?: Record<string, number>
  /** Phase 3 — Per-resource output multipliers (e.g. probability) */
  outputMultipliers?: Record<string, number>
  /** Phase 4 — Scale recipe duration globally */
  durationMultiplier?: number
  /** @deprecated Absolute override of gt:eu energy. Prefer utilityMultipliers. */
  energyAmount?: number
  /** If true, all outputs become zero regardless of other effects */
  machineStopped?: boolean
}

export interface IMachineModifier {
  id: string
  name: string
  ui_schema: ModifierUIConfig[]
  /** If set, this modifier can only be applied to machines of these archetypes.
   *  Undefined / empty = compatible with all archetypes. */
  compatible_archetypes?: string[]
  /** Evaluate this modifier against base (unmodified) recipe data.
   *  The engine collects all effects first, then applies them in a
   *  deterministic pipeline so multiple modifiers compose correctly. */
  evaluate: (
    baseInputs: Resource[],
    baseOutputs: Resource[],
    baseDuration: number,
    uiState: Record<string, unknown>
  ) => ModifierEffect
}
