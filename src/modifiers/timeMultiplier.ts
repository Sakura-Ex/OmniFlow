import type { IMachineModifier, PipelineContext } from './types'

export const timeMultiplierModifier: IMachineModifier = {
  id: 'time_multiplier',
  name: 'Time Multiplier',
  max_placements: Number.MAX_SAFE_INTEGER,
  ui_schema: [
    {
      key: 'multiplier',
      label: 'Time Multiplier',
      type: 'number',
      defaultValue: 1.0,
      min: 0.01,
      max: 1000,
    },
  ],
  evaluate: (ctx: PipelineContext, uiState: Record<string, unknown>) => {
    const m = Number(uiState.multiplier) || 1.0
    return { ...ctx, durationSeconds: ctx.durationSeconds * m }
  },
}