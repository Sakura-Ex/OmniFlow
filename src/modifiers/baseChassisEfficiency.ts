import type { IMachineModifier, PipelineContext } from './types'

function deepCloneResources(arr: typeof import('./types').PipelineContext.prototype.recipeInputs) {
  return arr.map((r) => ({ ...r }))
}

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
      recipeInputs: deepCloneResources(ctx.recipeInputs).map((r) => ({ ...r, amount: r.amount * efficiency })),
      recipeOutputs: deepCloneResources(ctx.recipeOutputs).map((r) => ({ ...r, amount: r.amount * efficiency })),
      utilityInputs: deepCloneResources(ctx.utilityInputs).map((r) => ({ ...r, amount: r.amount * efficiency })),
      utilityOutputs: deepCloneResources(ctx.utilityOutputs).map((r) => ({ ...r, amount: r.amount * efficiency })),
      durationSeconds: ctx.durationSeconds * efficiency,
      machineStopped: ctx.machineStopped,
    }
  },
}
