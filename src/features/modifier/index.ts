/** Core modifier type definitions. */
export type { ModifierUIConfig, ModifierUIControlType, IMachineModifier, PipelineContext, ModifierCardRenderProps } from './modifier.types'
/** GregTech-specific voltage tier and energy hatch data types. */
export type { GtVoltageTier, GtEnergyHatch } from './modifiers/gregtech/gtOverclocker'
/** Resolved power profile type for GregTech recipes. */
export type { ResolvedPowerProfile } from './modifiers/gregtech/utils'

/** GregTech overclocker: voltage tier constants, evaluation logic, hatch utilities, and the modifier definition. */
export {
  GT_VOLTAGE_TIERS,
  evaluateGtOverclock,
  computePowerPool,
  normalizeGtHatches,
  toGtHatches,
  toFiniteNumber,
  gtOverclockerModifier,
} from './modifiers/gregtech/gtOverclocker'
/** Resolve a recipe's power profile (base EU/t, actual EU/t, highest tier). */
export { resolveRecipePowerProfile } from './modifiers/gregtech/utils'
/** GregTech parallel processing modifier and evaluation function. */
export { gtParallelModifier, evaluateGtParallel } from './modifiers/gregtech/gtParallel'
/** GregTech probability output boost modifier. */
export { gtProbabilityOutputModifier } from './modifiers/gregtech/gtProbabilityOutput'
/** Custom card body components for GregTech modifier UIs. */
export { ParallelCardBody } from './modifiers/gregtech/gtParallelCard'
export { OverclockerCardBody } from './modifiers/gregtech/gtOverclockerCard'
export { GtProbabilityOutputCardBody } from './modifiers/gregtech/gtProbabilityOutputCard'

/** Generic energy multiplier modifier (scales GT EU consumption). */
export { energyMultiplierModifier } from './modifiers/energyMultiplier'
/** Generic time multiplier modifier (scales recipe duration). */
export { timeMultiplierModifier } from './modifiers/timeMultiplier'
/** Base chassis efficiency modifier (scales all resource amounts and duration). */
export { baseChassisEfficiencyModifier } from './modifiers/baseChassisEfficiency'
/** Chance output modifier (applies probability to specific output resources). */
export { chanceOutputModifier } from './modifiers/chanceOutput'

/** Modifier registry and lookup utilities. */
export { modifierRegistry, listModifiers, getModifierById } from './modifier.registry'
/** Modifier state utilities: default state creation and schema patching. */
export { createDefaultModifierState, patchModifierSchemaWithNodeResources } from './modifier.state'
/** Recipe data normalization and pipeline entry point. */
export { ensureRecipeDataShape, toResource } from './modifier.normalize'
/** Modifier pipeline execution, rate normalisation, and backend flattening. */
export { runModifierPipeline, flattenForBackend, normalizeRate } from './modifier.pipeline'
