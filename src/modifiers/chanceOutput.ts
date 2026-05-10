import type { IMachineModifier, PipelineContext } from './types'

export const chanceOutputModifier: IMachineModifier = {
  id: 'chance_output',
  name: 'Chance Output',
  ui_schema: [
    {
      key: 'targetResourceId',
      label: 'Target Output ID',
      type: 'select',
      options: [],
      defaultValue: '',
    },
    {
      key: 'probability',
      label: 'Probability (0-1)',
      type: 'number',
      defaultValue: 1,
    },
  ],
  evaluate: (ctx: PipelineContext, uiState: Record<string, unknown>) => {
    const prob = Number(uiState.probability)
    const normalizedProb = Number.isFinite(prob) ? Math.max(0, Math.min(1, prob)) : 1
    const targetId = String(uiState.targetResourceId || '')
    const allOutputs = [...ctx.recipeOutputs, ...ctx.utilityOutputs]

    const outputMultipliers: Record<string, number> = {}
    if (targetId) {
      outputMultipliers[targetId] = normalizedProb
    } else {
      for (const out of allOutputs) {
        outputMultipliers[out.id] = normalizedProb
      }
    }

    return { outputMultipliers }
  },
}
