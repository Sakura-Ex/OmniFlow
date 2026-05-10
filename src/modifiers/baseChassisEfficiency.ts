import type { IMachineModifier, PipelineContext } from './types'

export const baseChassisEfficiencyModifier: IMachineModifier = {
  id: 'base_chassis_efficiency',
  name: 'Base Chassis Efficiency',
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
    const efficiency = Number(uiState.efficiency) || 1.0
    return {
      statMultipliers: {
        duration: efficiency,
        recipeInput: efficiency,
        recipeOutput: efficiency,
        utility: efficiency,
      },
    }
  },
}
