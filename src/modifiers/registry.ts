import type { IMachineModifier } from './types'
import { baseChassisEfficiencyModifier } from './baseChassisEfficiency'
import { chanceOutputModifier } from './chanceOutput'
import { gtMultiblockModifier } from './gtMultiblock'

export const modifierRegistry: Record<string, IMachineModifier> = {
  [baseChassisEfficiencyModifier.id]: baseChassisEfficiencyModifier,
  [chanceOutputModifier.id]: chanceOutputModifier,
  [gtMultiblockModifier.id]: gtMultiblockModifier,
}

export function listModifiers(): IMachineModifier[] {
  return Object.values(modifierRegistry)
}

export function getModifierById(modifierId: string): IMachineModifier | null {
  return modifierRegistry[modifierId] ?? null
}
