import type { Resource } from '../types/types'
import type { IMachineModifier } from './types'
import { getModifierById } from './registry'

export function createDefaultModifierState(modifierId: string): Record<string, unknown> {
  const modifier = getModifierById(modifierId)
  if (!modifier) return {}

  return modifier.ui_schema.reduce<Record<string, unknown>>((acc, control) => {
    acc[control.key] = control.defaultValue
    return acc
  }, {})
}

export function patchModifierSchemaWithNodeResources(
  modifier: IMachineModifier,
  outputs: Resource[]
): IMachineModifier {
  if (modifier.id !== 'chance_output') return modifier

  const dynamicOptions = outputs.map((o) => o.id)
  const ui_schema = modifier.ui_schema.map((item) => {
    if (item.key !== 'targetResourceId') return item
    return {
      ...item,
      options: dynamicOptions,
      defaultValue: dynamicOptions[0] ?? '',
    }
  })

  return {
    ...modifier,
    ui_schema,
  }
}
