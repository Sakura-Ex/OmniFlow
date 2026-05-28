import { z } from 'zod'
import { ResourceSchema } from './resource.schema'

/** Zod schema for a single recipe entry within an imported file. */
export const ImportRecipeSchema = z.object({
  recipe_id: z.string(),
  system: z.string(),
  machine_name: z.string(),
  duration_seconds: z.number(),
  inputs: z.array(ResourceSchema),
  outputs: z.array(ResourceSchema),
  tags: z.array(z.string()).optional(),
})

/** Zod schema for a full import file containing a format label and an array of recipes. */
export const ImportFileSchema = z.object({
  format: z.string(),
  recipes: z.array(ImportRecipeSchema),
})

/** Inferred TypeScript type for an imported single recipe. */
export type ImportRecipeSchemaType = z.infer<typeof ImportRecipeSchema>
/** Inferred TypeScript type for a complete import file. */
export type ImportFileSchemaType = z.infer<typeof ImportFileSchema>
