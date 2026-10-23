import type { ModifierUI } from './modifier.ui.types'
import { OverclockerCardBody } from './modifiers/gregtech/gtOverclockerCard'
import { ParallelCardBody } from './modifiers/gregtech/gtParallelCard'
import { GtProbabilityOutputCardBody } from './modifiers/gregtech/gtProbabilityOutputCard'

/** Presentation components keyed by their calculation definition ID. */
export const modifierUIRegistry: Readonly<Record<string, ModifierUI>> = {
  gt_overclocker: { renderBody: OverclockerCardBody },
  gt_parallel: { renderBody: ParallelCardBody },
  gt_probability_output: { renderBody: GtProbabilityOutputCardBody },
}
