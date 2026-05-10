import type { IMachineModifier, PipelineContext } from './types'
import { GT_VOLTAGE_TIERS, toGtHatches, toFiniteNumber } from './gtOverclocker'
import { ParallelCardBody } from './gtParallelCard'

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
    const euInput = ctx.utilityInputs.find((r) => r.utility_type === 'energy:gt_eu')
    const baseEuPerTick = euInput ? euInput.amount : 0
    if (baseEuPerTick <= 0) return { ...ctx }

    const hatches = toGtHatches(ctx.hardwareSpecs.energyHatches)
    let totalEuPerTick = 0
    for (const hatch of hatches) {
      const tier = GT_VOLTAGE_TIERS.find((item) => item.id === hatch.tier)
      if (!tier) continue
      totalEuPerTick += tier.euPerAmp * hatch.amps
    }

    const parallelLimit = Math.max(1, Math.min(1048576, Math.floor(toFiniteNumber(uiState.parallelLimit, 4))))
    const theoreticalParallel = totalEuPerTick > 0 ? Math.floor(totalEuPerTick / baseEuPerTick) : 0
    const actualParallel = Math.min(theoreticalParallel, parallelLimit)

    if (actualParallel <= 0) return { ...ctx, machineStopped: true, recipeOutputs: ctx.recipeOutputs.map((r) => ({ ...r, amount: 0 })) }

    const p = actualParallel
    return {
      ...ctx,
      recipeInputs: ctx.recipeInputs.map((r) => (r.consumable === false || r.consumable_probability === 0) ? { ...r } : { ...r, amount: r.amount * p }),
      recipeOutputs: ctx.recipeOutputs.map((r) => (r.consumable === false || r.consumable_probability === 0) ? { ...r } : { ...r, amount: r.amount * p }),
      utilityInputs: ctx.utilityInputs.map((r) => (r.consumable === false || r.consumable_probability === 0) ? { ...r } : { ...r, amount: r.amount * p }),
      utilityOutputs: ctx.utilityOutputs.map((r) => (r.consumable === false || r.consumable_probability === 0) ? { ...r } : { ...r, amount: r.amount * p }),
    }
  },
}
