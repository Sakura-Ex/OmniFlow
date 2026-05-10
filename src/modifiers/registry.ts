import type { IMachineModifier } from './types'
import { baseChassisEfficiencyModifier } from './baseChassisEfficiency'
import { chanceOutputModifier } from './chanceOutput'
import { gtOverclockerModifier } from './gtOverclocker'
import { gtParallelModifier } from './gtParallel'
import { energyMultiplierModifier } from './energyMultiplier'
import { timeMultiplierModifier } from './timeMultiplier'

export const modifierRegistry: Record<string, IMachineModifier> = {
  [baseChassisEfficiencyModifier.id]: baseChassisEfficiencyModifier,
  [chanceOutputModifier.id]: chanceOutputModifier,
  [gtOverclockerModifier.id]: gtOverclockerModifier,
  [gtParallelModifier.id]: gtParallelModifier,
  [energyMultiplierModifier.id]: energyMultiplierModifier,
  [timeMultiplierModifier.id]: timeMultiplierModifier,
}

export function listModifiers(): IMachineModifier[] {
  return Object.values(modifierRegistry)
}

export function getModifierById(modifierId: string): IMachineModifier | null {
  return modifierRegistry[modifierId] ?? null
}
