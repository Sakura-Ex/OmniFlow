import type { IMachineModifier } from './modifier.types'
import { baseChassisEfficiencyModifier } from './modifiers/baseChassisEfficiency'
import { chanceOutputModifier } from './modifiers/chanceOutput'
import { gtOverclockerModifier } from './modifiers/gregtech/gtOverclocker'
import { gtParallelModifier } from './modifiers/gregtech/gtParallel'
import { gtProbabilityOutputModifier } from './modifiers/gregtech/gtProbabilityOutput'
import { energyMultiplierModifier } from './modifiers/energyMultiplier'
import { timeMultiplierModifier } from './modifiers/timeMultiplier'

/**
 * Central registry mapping modifier IDs to their {@link IMachineModifier} definitions.
 * All built-in modifiers are registered here at import time.
 */
export const modifierRegistry: Record<string, IMachineModifier> = {
  [baseChassisEfficiencyModifier.id]: baseChassisEfficiencyModifier,
  [chanceOutputModifier.id]: chanceOutputModifier,
  [gtOverclockerModifier.id]: gtOverclockerModifier,
  [gtParallelModifier.id]: gtParallelModifier,
  [gtProbabilityOutputModifier.id]: gtProbabilityOutputModifier,
  [energyMultiplierModifier.id]: energyMultiplierModifier,
  [timeMultiplierModifier.id]: timeMultiplierModifier,
}

/**
 * Get all registered modifiers as an array.
 *
 * @returns An array of all {@link IMachineModifier} instances in the registry.
 */
export function listModifiers(): IMachineModifier[] {
  return Object.values(modifierRegistry)
}

/**
 * Look up a modifier by its unique ID.
 *
 * @param modifierId - The unique identifier of the modifier to find.
 * @returns The matching {@link IMachineModifier} or `null` if not found.
 */
export function getModifierById(modifierId: string): IMachineModifier | null {
  return modifierRegistry[modifierId] ?? null
}
