import type { IMachineModifier } from './types'
import { chanceOutputModifier } from './chanceOutput'
import { gtMultiblockModifier } from './gtMultiblock'

export const modifierRegistry: Record<string, IMachineModifier> = {
  [chanceOutputModifier.id]: chanceOutputModifier,
  [gtMultiblockModifier.id]: gtMultiblockModifier,
}

export function listModifiers(): IMachineModifier[] {
  return Object.values(modifierRegistry)
}

export function getModifierById(modifierId: string): IMachineModifier | null {
  return modifierRegistry[modifierId] ?? null
}
