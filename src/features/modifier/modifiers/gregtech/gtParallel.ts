import { gtEuPerTick } from './gtUnits'
import type { IMachineModifier, PipelineContext } from '../../modifier.types'
import type { Resource } from '@/common/types/resource'
import { computePowerPool, toGtHatches, toFiniteNumber } from './gtPower'

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
  apiVersion: 2,
  version: 2,
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
  evaluate: (ctx: PipelineContext, uiState: Record<string, unknown>) => {
    const baseEu = gtEuPerTick(ctx.baseline.utilityInputs, ctx.baseline.durationSeconds, ctx.units)
    const result = evaluateGtParallel({ ...uiState, energyHatches: ctx.hardwareSpecs.energyHatches }, baseEu)

    if (!result.canStart) {
      return { machineStopped: true, reason: '供电不足，请提高能源仓电压或数量。' }
    }

    if (result.actualParallel <= 1) return { actualParallel: 1 }

    const p = result.actualParallel
    const mul = (r: Resource) =>
      r.scaling === 'per_running_machine' || r.scaling === 'per_installed_machine' || (r.consumable === false && r.occupancy_basis !== 'per_parallel_slot' && r.scaling !== 'per_parallel_slot') ? { ...r } : { ...r, amount: r.amount * p }

    return {
      actualParallel: p,
      recipeInputs: ctx.recipeInputs.map(mul),
      recipeOutputs: ctx.recipeOutputs.map(mul),
      utilityInputs: ctx.utilityInputs.map(mul),
      utilityOutputs: ctx.utilityOutputs.map(mul),
    }
  },
}
