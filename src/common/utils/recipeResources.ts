import type { Resource } from '@/common/types/resource'

/**
 * Collect all resources (inputs, outputs, utilities) from a recipe into a flat array.
 * @param recipe - An object with optional resource arrays on four port categories.
 * @param recipe.base_inputs
 * @param recipe.base_outputs
 * @param recipe.base_utility_inputs
 * @param recipe.base_utility_outputs
 * @returns A flat array of all resources referenced by the recipe.
 */
export function flattenRecipeResources(recipe: {
  base_inputs?: Resource[]
  base_outputs?: Resource[]
  base_utility_inputs?: Resource[]
  base_utility_outputs?: Resource[]
}): Resource[] {
  return [
    ...(recipe.base_inputs ?? []),
    ...(recipe.base_outputs ?? []),
    ...(recipe.base_utility_inputs ?? []),
    ...(recipe.base_utility_outputs ?? []),
  ]
}
