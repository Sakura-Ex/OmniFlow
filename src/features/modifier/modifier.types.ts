import type { Resource } from '@/common/types/resource'
import type { ValueOf } from '@/common/types/common'
import type { ReactNode, FC } from 'react'

export const ModifierUIControlType = {
  Toggle: 'toggle',
  Select: 'select',
  Number: 'number',
  Slider: 'slider',
} as const satisfies Record<string, string>

export type ModifierUIControlType = ValueOf<typeof ModifierUIControlType>

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
  hardwareSpecs: Record<string, unknown>
  baseline: {
    recipeInputs: Resource[]
    recipeOutputs: Resource[]
    utilityInputs: Resource[]
    utilityOutputs: Resource[]
    durationSeconds: number
  }
}

export interface ModifierCardRenderProps {
  state: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  readOnly?: boolean
  Field: FC<{ label: string; children: ReactNode }>
  Toggle: FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }>
  Select: FC<{ label: string; value: string; options: string[]; onChange: (v: string) => void }>
  Slider: FC<{ label: string; value: number; min: number; max: number; onChange: (v: number) => void }>
  Input: FC<{ label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }>
  recipeInputs?: Resource[]
  recipeOutputs?: Resource[]
  hardwareSpecs?: Record<string, unknown>
}

export interface IMachineModifier {
  id: string
  name: string
  ui_schema: ModifierUIConfig[]
  compatible_archetypes?: string[]
  max_placements?: number
  evaluate: (
    ctx: PipelineContext,
    uiState: Record<string, unknown>
  ) => PipelineContext
  renderBody?: (props: ModifierCardRenderProps) => ReactNode
}
