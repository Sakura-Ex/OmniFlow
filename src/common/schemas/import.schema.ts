import { z } from 'zod'
import { ResourceSchema } from './resource.schema'

export const ImportRecipeSchema = z.object({
  recipe_id: z.string(),
  system: z.string(),
  machine_name: z.string(),
  duration_seconds: z.number(),
  inputs: z.array(ResourceSchema),
  outputs: z.array(ResourceSchema),
  tags: z.array(z.string()).optional(),
})

export const ImportFileSchema = z.object({
  format: z.string(),
  recipes: z.array(ImportRecipeSchema),
})

export type ImportRecipeSchemaType = z.infer<typeof ImportRecipeSchema>
export type ImportFileSchemaType = z.infer<typeof ImportFileSchema>
