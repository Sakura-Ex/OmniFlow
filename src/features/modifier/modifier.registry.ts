import type { IMachineModifier } from './modifier.types'
import { baseChassisEfficiencyModifier } from './modifiers/baseChassisEfficiency'
import { chanceOutputModifier } from './modifiers/chanceOutput'
import { gtOverclockerModifier } from './modifiers/gregtech/gtOverclocker'
import { gtParallelModifier } from './modifiers/gregtech/gtParallel'
import { gtProbabilityOutputModifier } from './modifiers/gregtech/gtProbabilityOutput'
import { energyMultiplierModifier } from './modifiers/energyMultiplier'
import { timeMultiplierModifier } from './modifiers/timeMultiplier'

export const modifierRegistry: Record<string, IMachineModifier> = {
  [baseChassisEfficiencyModifier.id]: baseChassisEfficiencyModifier,
  [chanceOutputModifier.id]: chanceOutputModifier,
  [gtOverclockerModifier.id]: gtOverclockerModifier,
  [gtParallelModifier.id]: gtParallelModifier,
  [gtProbabilityOutputModifier.id]: gtProbabilityOutputModifier,
  [energyMultiplierModifier.id]: energyMultiplierModifier,
  [timeMultiplierModifier.id]: timeMultiplierModifier,
}

export function listModifiers(): IMachineModifier[] {
  return Object.values(modifierRegistry)
}

export function getModifierById(modifierId: string): IMachineModifier | null {
  return modifierRegistry[modifierId] ?? null
}
