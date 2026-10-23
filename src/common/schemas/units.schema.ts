import { z } from 'zod'

/** Unit expressions and environment are data, never serialized runtime objects. */
export const UnitExpressionSchema = z.array(z.object({
  baseUnitId: z.string().min(1), prefixId: z.string().min(1).optional(), exponent: z.number().int().safe(),
}))

/** Structural validation is followed by registry validation for cycles and unknown references. */
export const UnitSnapshotSchema = z.object({
  ticksPerSecond: z.number().finite().positive(),
  definitions: z.array(z.object({ id: z.string().min(1), symbol: z.string(), scale: z.number().finite().positive().optional(), offset: z.number().finite().optional(), nativeRate: z.boolean().optional(), derived: UnitExpressionSchema.optional() })),
  prefixes: z.array(z.object({ id: z.string().min(1), symbol: z.string(), scale: z.number().finite().positive() })),
})
