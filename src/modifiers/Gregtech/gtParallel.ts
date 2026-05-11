import type { IMachineModifier, PipelineContext } from '../types'
import type { Resource } from '../../types/types'
import { computePowerPool, toGtHatches, toFiniteNumber } from './gtOverclocker'
import { ParallelCardBody } from './gtParallelCard'

export function evaluateGtParallel(
  uiState: Record<string, unknown>,
  baseEuPerTick: number
): { canStart: boolean; actualParallel: number; totalEuPerTick: number; highestTier: string } {
  const hatches = toGtHatches(uiState.energyHatches)
  const { totalEuPerTick, highestTier } = computePowerPool(hatches)

  if (baseEuPerTick <= 0 || totalEuPerTick <= 0) {
    return { canStart: false, actualParallel: 0, totalEuPerTick, highestTier }
  }

  const parallelLimit = Math.max(1, Math.min(1048576, Math.floor(toFiniteNumber(uiState.parallelLimit, 4))))
  const actualParallel = Math.min(Math.floor(totalEuPerTick / baseEuPerTick), parallelLimit)

  if (actualParallel <= 0) {
    return { canStart: false, actualParallel: 0, totalEuPerTick, highestTier }
  }

  return { canStart: true, actualParallel, totalEuPerTick, highestTier }
}

export const gtParallelModifier: IMachineModifier = {
  id: 'gt_parallel',
  name: 'GT Parallel',
  compatible_archetypes: ['gt_electric'],
  ui_schema: [
    {
      key: 'parallelLimit',
      label: 'Parallel Limit',
      type: 'select',
      options: ['4', '16', '64', '256'],
      defaultValue: '4',
    },
  ],
  renderBody: ParallelCardBody,
  evaluate: (ctx: PipelineContext, uiState: Record<string, unknown>) => {
    const baseEu = ctx.baseline.utilityInputs.find((r) => r.utility_type === 'energy:gt_eu')?.amount ?? 0
    const result = evaluateGtParallel({ ...uiState, energyHatches: ctx.hardwareSpecs.energyHatches }, baseEu)

    if (!result.canStart) {
      return { ...ctx, machineStopped: true, recipeOutputs: ctx.recipeOutputs.map((r) => ({ ...r, amount: 0 })) }
    }

    if (result.actualParallel <= 1) return { ...ctx }

    const p = result.actualParallel
    const mul = (r: Resource) =>
      r.consumable === false || r.consumable_probability === 0 ? { ...r } : { ...r, amount: r.amount * p }

    return {
      ...ctx,
      recipeInputs: ctx.recipeInputs.map(mul),
      recipeOutputs: ctx.recipeOutputs.map(mul),
      utilityInputs: ctx.utilityInputs.map(mul),
      utilityOutputs: ctx.utilityOutputs.map(mul),
    }
  },
}
