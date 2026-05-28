import type { IMachineModifier, PipelineContext } from '../../modifier.types'
import type { Resource } from '@/common/types/resource'
import { computePowerPool, toGtHatches, toFiniteNumber } from './gtOverclocker'
import { ParallelCardBody } from './gtParallelCard'

/**
 * Evaluate how many parallel operations are possible given the machine's energy pool.
 *
 * The actual parallel count is the minimum of `floor(totalEuPerTick / baseEuPerTick)` and the
 * user-configured `parallelLimit`. Returns `canStart: false` when the machine lacks sufficient
 * energy or the calculated parallel count is zero.
 *
 * @param uiState - The parallel modifier UI state, expected to contain `energyHatches` and `parallelLimit`.
 * @param baseEuPerTick - The recipe's baseline EU-per-tick consumption for a single operation.
 * @returns An object indicating whether the machine can start, the actual parallel count, total EU/t, and the highest voltage tier.
 */
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

/**
 * GT Parallel modifier plugin.
 *
 * Scales all resource inputs and outputs by the number of parallel operations the machine's
 * energy pool can sustain. When insufficient energy is available, the machine is stopped.
 */
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
      r.consumable === false || r.probability === 0 ? { ...r } : { ...r, amount: r.amount * p }

    return {
      ...ctx,
      recipeInputs: ctx.recipeInputs.map(mul),
      recipeOutputs: ctx.recipeOutputs.map(mul),
      utilityInputs: ctx.utilityInputs.map(mul),
      utilityOutputs: ctx.utilityOutputs.map(mul),
    }
  },
}
