import type { IMachineModifier, PipelineContext } from './types'
import type { Resource } from '../types/types'

export const baseChassisEfficiencyModifier: IMachineModifier = {
  id: 'base_chassis_efficiency',
  name: 'Base Chassis Efficiency',
  max_placements: 4,
  ui_schema: [
    {
      key: 'efficiency',
      label: 'Efficiency Multiplier',
      type: 'number',
      defaultValue: 1.0,
      min: 0.01,
      max: 100,
    },
  ],
  evaluate: (ctx: PipelineContext, uiState: Record<string, unknown>) => {
    const m = Number(uiState.efficiency) || 1.0
    const mul = (r: Resource) => ({ ...r, amount: r.amount * m })
    return {
      ...ctx,
      recipeInputs: ctx.recipeInputs.map(mul),
      recipeOutputs: ctx.recipeOutputs.map(mul),
      utilityInputs: ctx.utilityInputs.map(mul),
      utilityOutputs: ctx.utilityOutputs.map(mul),
      durationSeconds: ctx.durationSeconds * m,
    }
  },
}