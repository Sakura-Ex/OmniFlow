import type { Resource } from '../types/types'

export type ModifierUIControlType = 'toggle' | 'select' | 'number' | 'slider'

export interface ModifierUIConfig {
  key: string
  label: string
  type: ModifierUIControlType
  options?: string[]
  defaultValue: unknown
  min?: number
  max?: number
  step?: number
}

export interface PipelineContext {
  recipeInputs: Resource[]
  recipeOutputs: Resource[]
  utilityInputs: Resource[]
  utilityOutputs: Resource[]
  durationSeconds: number
  machineStopped: boolean
}

export interface ModifierEffect {
  statMultipliers?: {
    duration?: number
    recipeInput?: number
    recipeOutput?: number
    utility?: number
  }
  parallelMultiplier?: number
  durationMultiplier?: number
  utilityMultipliers?: Record<string, number>
  outputMultipliers?: Record<string, number>
  machineStopped?: boolean
  addedInputs?: Resource[]
  addedOutputs?: Resource[]
  removedInputs?: string[]
  removedOutputs?: string[]
}

export interface IMachineModifier {
  id: string
  name: string
  ui_schema: ModifierUIConfig[]
  compatible_archetypes?: string[]
  evaluate: (
    ctx: PipelineContext,
    uiState: Record<string, unknown>
  ) => ModifierEffect
}
