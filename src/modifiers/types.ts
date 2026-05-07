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
  /** Phase 0 — Linear stat multipliers (machine chassis bonuses, unconditional) */
  statMultipliers?: {
    duration?: number
    recipeInput?: number
    recipeOutput?: number
    utility?: number
  }
  /** Phase 1 — Parallel: multiply ALL amounts uniformly (with consumable guard) */
  parallelMultiplier?: number
  /** Phase 2 — Duration override from overclock */
  durationMultiplier?: number
  /** Phase 2 — Targeted overclock: per-utility-type multipliers */
  utilityMultipliers?: Record<string, number>
  /** Phase 2 — Per-resource output multipliers (e.g. probability) */
  outputMultipliers?: Record<string, number>
  /** @deprecated Absolute override of energy. Prefer utilityMultipliers. */
  energyAmount?: number
  /** If true, all recipe outputs become zero regardless of other effects */
  machineStopped?: boolean
}

export interface IMachineModifier {
  id: string
  name: string
  ui_schema: ModifierUIConfig[]
  compatible_archetypes?: string[]
  evaluate: (
    baseInputs: Resource[],
    baseOutputs: Resource[],
    baseDuration: number,
    uiState: Record<string, unknown>
  ) => ModifierEffect
}
