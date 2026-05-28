import type { IMachineModifier, PipelineContext } from '../../modifier.types'
import type { Resource } from '@/common/types/resource'
import { GtProbabilityOutputCardBody } from './gtProbabilityOutputCard'
import { GT_VOLTAGE_TIERS, computePowerPool, toGtHatches } from './gtOverclocker'

const BOOST_KEY_PREFIX = 'boost:'

function tierIndex(tierId: string): number {
  return GT_VOLTAGE_TIERS.findIndex((t) => t.id === tierId)
}

export const gtProbabilityOutputModifier: IMachineModifier = {
  id: 'gt_probability_output',
  name: 'GT Probability Output',
  compatible_archetypes: ['gt_electric'],
  max_placements: 1,
  ui_schema: [],
  renderBody: GtProbabilityOutputCardBody,
  evaluate: (ctx: PipelineContext, uiState: Record<string, unknown>) => {
    const baseEu = ctx.baseline.utilityInputs.find((r) => r.utility_type === 'energy:gt_eu')?.amount ?? 0
    if (baseEu <= 0) return { ...ctx }

    const recipeTierEntry = GT_VOLTAGE_TIERS.find((t) => t.euPerAmp >= baseEu)
    const recipeTierIdx = recipeTierEntry ? tierIndex(recipeTierEntry.id) : -1

    const hatches = toGtHatches(ctx.hardwareSpecs.energyHatches)
    const { highestTier } = computePowerPool(hatches)
    const machineTierIdx = tierIndex(highestTier)

    if (recipeTierIdx < 0 || machineTierIdx < 0) return { ...ctx }

    const tierDiff = Math.max(0, machineTierIdx - recipeTierIdx)
    if (tierDiff === 0) return { ...ctx }

    const applyBoost = (resources: Resource[]): Resource[] =>
      resources.map((r) => {
        const p = r.probability
        if (typeof p !== 'number' || p <= 0 || p >= 1) return { ...r }

        const boostKey = `${BOOST_KEY_PREFIX}${r.category}:${r.id}`
        const boost = Number(uiState[boostKey] ?? 0)
        if (!Number.isFinite(boost) || boost <= 0) return { ...r }

        const newProb = Math.min(1, p + boost * tierDiff)
        return { ...r, probability: newProb }
      })

    return {
      ...ctx,
      recipeOutputs: applyBoost(ctx.recipeOutputs),
      utilityOutputs: applyBoost(ctx.utilityOutputs),
    }
  },
}
