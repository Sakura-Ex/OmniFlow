import type { IMachineModifier } from './types'
import { baseChassisEfficiencyModifier } from './baseChassisEfficiency'
import { chanceOutputModifier } from './chanceOutput'
import { gtOverclockerModifier } from './Gregtech/gtOverclocker'
import { gtParallelModifier } from './Gregtech/gtParallel'
import { gtProbabilityOutputModifier } from './Gregtech/gtProbabilityOutput'
import { energyMultiplierModifier } from './energyMultiplier'
import { timeMultiplierModifier } from './timeMultiplier'

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
