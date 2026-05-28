import type { Resource } from '@/common/types/resource'
import type { IMachineModifier } from './modifier.types'
import { getModifierById } from './modifier.registry'

/**
 * Build the default UI state object for a given modifier based on its UI schema.
 *
 * Iterates over the modifier's `ui_schema` and assigns each control its `defaultValue`.
 *
 * @param modifierId - The ID of the modifier whose default state should be created.
 * @returns A record mapping control keys to their default values, or an empty object if the modifier is not found.
 */
export function createDefaultModifierState(modifierId: string): Record<string, unknown> {
  const modifier = getModifierById(modifierId)
  if (!modifier) return {}

  return modifier.ui_schema.reduce<Record<string, unknown>>((acc, control) => {
    acc[control.key] = control.defaultValue
    return acc
  }, {})
}

/**
 * Dynamically patch a modifier's UI schema with resource-specific options.
 *
 * Currently scoped to the `chance_output` modifier: replaces the `targetResourceId` select
 * options with the actual output resource IDs from the node.
 *
 * @param modifier - The modifier whose UI schema should be patched.
 * @param outputs - The recipe output resources to derive options from.
 * @returns A new modifier instance with the patched schema, or the original modifier unchanged.
 */
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
