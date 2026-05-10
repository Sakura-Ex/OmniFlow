import type { IMachineModifier, PipelineContext } from './types'

export const chanceOutputModifier: IMachineModifier = {
  id: 'chance_output',
  name: 'Chance Output',
  max_placements: 4,
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

    const scaleOutputs = (arr: typeof ctx.recipeOutputs) =>
      arr.map((r) => {
        if (targetId && r.id !== targetId) return { ...r }
        return { ...r, amount: r.amount * normalizedProb }
      })

    return {
      ...ctx,
      recipeOutputs: scaleOutputs(ctx.recipeOutputs),
      utilityOutputs: scaleOutputs(ctx.utilityOutputs),
    }
  },
}
