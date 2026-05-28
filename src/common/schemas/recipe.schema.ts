import { z } from 'zod'
import { ResourceSchema } from './resource.schema'

export const ProjectRecipeSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  recipeId: z.string(),
  machineName: z.string(),
  system: z.string(),
  archetypeId: z.string(),
  durationSeconds: z.number(),
  inputs: z.array(ResourceSchema),
  outputs: z.array(ResourceSchema),
  sourceLibraryId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  source: z.enum(['import', 'manual']),
  importRecordId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/** Inferred TypeScript type for a project-scoped recipe. */
export type ProjectRecipeSchemaType = z.infer<typeof ProjectRecipeSchema>

/** Zod schema for the data payload of a recipe node on the flow canvas, including modifiers and machine settings. */
export const RecipeNodeDataSchema = z.object({
  recipe_id: z.string(),
  machine_name: z.string(),
  system: z.string(),
  archetype_id: z.string().optional(),
  duration_seconds: z.number(),
  inputs: z.array(ResourceSchema),
  outputs: z.array(ResourceSchema),
  base_inputs: z.array(ResourceSchema).optional(),
  base_outputs: z.array(ResourceSchema).optional(),
  base_utility_inputs: z.array(ResourceSchema).optional(),
  base_utility_outputs: z.array(ResourceSchema).optional(),
  base_duration_seconds: z.number().optional(),
  active_modifiers: z.array(z.object({
    instance_id: z.string(),
    definition_id: z.string(),
    uiState: z.record(z.string(), z.unknown()),
  })).optional(),
  modifier_states: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  hardware_specs: z.record(z.string(), z.unknown()).optional(),
  mode: z.enum(['limit', 'auto']).optional(),
  manual_machines: z.number().optional(),
  machines_exact: z.number().optional(),
  machines_actual: z.number().optional(),
  utilization: z.number().optional(),
  is_implemented: z.boolean().optional(),
  metadata: z.object({
    eu_per_tick: z.number().optional(),
    rf_per_tick: z.number().optional(),
    base_voltage: z.string().optional(),
    can_overclock: z.boolean().optional(),
  }).passthrough(),
})

/** Inferred TypeScript type for a recipe node's data payload. */
export type RecipeNodeDataSchemaType = z.infer<typeof RecipeNodeDataSchema>
