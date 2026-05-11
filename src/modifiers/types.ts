import type { Resource } from '../types/types'
import type { ReactNode, FC } from 'react'

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
  hardwareSpecs: Record<string, unknown>
  /** 修饰器执行前的原始快照 — 不可变对照本，供需要原始值的修饰器（如 GT Overclocker）读取 */
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
}

export interface IMachineModifier {
  id: string
  name: string
  ui_schema: ModifierUIConfig[]
  compatible_archetypes?: string[]
  /** 最多可放置几次（默认 1）。> 1 时允许在 active_modifiers 中出现重复条目 */
  max_placements?: number
  evaluate: (
    ctx: PipelineContext,
    uiState: Record<string, unknown>
  ) => PipelineContext
  renderBody?: (props: ModifierCardRenderProps) => ReactNode
}
