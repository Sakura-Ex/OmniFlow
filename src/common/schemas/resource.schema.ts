import { z } from 'zod'
import { UnitExpressionSchema } from './units.schema'

/** Zod schema for a resource definition (category, id, amount, time base, routing, probability, etc.). */
export const ResourceSchema = z.object({
  portId: z.string().min(1).optional(),
  unit: UnitExpressionSchema.optional(),
  displayUnit: UnitExpressionSchema.optional(),
  occupancy_basis: z.enum(['per_machine', 'per_parallel_slot', 'global']).optional(),
  scaling: z.enum(['per_cycle', 'per_parallel_slot', 'per_running_machine', 'per_installed_machine']).optional(),
  category: z.string(),
  id: z.string(),
  amount: z.number().finite().nonnegative(),
  time_base: z.enum(['per_cycle', 'rate_per_tick', 'rate_per_sec']).optional(),
  consumable: z.boolean().optional(),
  probability: z.number().min(0).max(1).optional(),
  routing_mode: z.enum(['global', 'wired']).optional(),
  routing_locked: z.boolean().optional(),
  is_utility: z.boolean().optional(),
  is_utility_output: z.boolean().optional(),
  utility_type: z.string().optional(),
  amount_mutable: z.boolean().optional(),
  _uid: z.string().optional(),
}).passthrough()

/** Inferred TypeScript type for a resource definition. */
export type ResourceSchemaType = z.infer<typeof ResourceSchema>
