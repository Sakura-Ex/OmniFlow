import type { IMachineModifier, PipelineContext } from './types'

export const energyMultiplierModifier: IMachineModifier = {
  id: 'energy_multiplier',
  name: 'Energy Multiplier',
  compatible_archetypes: ['gt_electric'],
  ui_schema: [
    {
      key: 'multiplier',
      label: 'Energy Multiplier',
      type: 'number',
      defaultValue: 1.0,
      min: 0.01,
      max: 100,
    },
  ],
  evaluate: (ctx: PipelineContext, uiState: Record<string, unknown>) => {
    const multiplier = Number(uiState.multiplier) || 1.0
    return {
      ...ctx,
      utilityInputs: ctx.utilityInputs.map((r) =>
        r.utility_type === 'energy:gt_eu'
          ? { ...r, amount: r.amount * multiplier }
          : { ...r }
      ),
    }
  },
}
