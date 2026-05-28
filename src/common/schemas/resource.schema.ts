import { z } from 'zod'

export const ResourceSchema = z.object({
  category: z.string(),
  id: z.string(),
  amount: z.number(),
  time_base: z.string().optional(),
  consumable: z.boolean().optional(),
  probability: z.number().optional(),
  routing_mode: z.enum(['global', 'wired']).optional(),
  routing_locked: z.boolean().optional(),
  is_utility: z.boolean().optional(),
  is_utility_output: z.boolean().optional(),
  utility_type: z.string().optional(),
  amount_mutable: z.boolean().optional(),
  _uid: z.string().optional(),
}).passthrough()

export type ResourceSchemaType = z.infer<typeof ResourceSchema>
