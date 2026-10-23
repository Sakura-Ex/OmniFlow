import { z } from 'zod'

const nonnegative = z.number().finite().nonnegative()
const identifier = z.string().trim().min(1)
const portAddress = z.string().refine(value => {
  try {
    const address: unknown = JSON.parse(value)
    return Array.isArray(address) && address.length === 2 && address.every(part => typeof part === 'string' && part.trim().length > 0)
  } catch { return false }
}, 'Port address must be a JSON pair of nonblank node and port identities')
const objective = z.object({
  priority: z.number().int().nonnegative(),
  weight: z.number().finite().positive(),
  scale: z.number().finite().positive(),
  ratioGroup: identifier.optional(),
  ratio: z.number().finite().positive().optional(),
}).strict().refine(value => Boolean(value.ratioGroup) === (value.ratio !== undefined), 'A fixed ratio requires a group and positive ratio')

/** Explicit external assumptions; absent configuration never creates a boundary. */
export const BoundarySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('source'), capacity: nonnegative.nullable(), cost: objective.optional() }).strict(),
  z.object({ kind: z.literal('delivery'), mode: z.enum(['at_least', 'exact', 'maximize', 'export']), amount: nonnegative, capacity: nonnegative.nullable(), objective: objective.optional() }).strict(),
  z.object({ kind: z.literal('spill'), capacity: nonnegative.nullable(), cost: objective.optional() }).strict(),
  z.object({ kind: z.literal('forbid_spill') }).strict(),
])

/** One serializable document field, indexed by persistent JSON node/port addresses. */
export const NetworkConfigurationSchema = z.object({
  version: z.literal(1),
  ports: z.record(portAddress, z.object({
    scopeId: identifier.default('document'),
    busId: identifier.default('default'),
    semantics: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('flow') }).strict(),
      z.object({ kind: z.literal('capacity'), available: nonnegative }).strict(),
      z.object({ kind: z.literal('state'), actual: z.number().finite(), minimum: z.number().finite().optional(), maximum: z.number().finite().optional() }).strict(),
    ]).default({ kind: 'flow' }),
    boundary: BoundarySchema.optional(),
  }).strict()),
  machines: z.record(identifier, z.object({ installed: nonnegative.int().nullable(), existing: nonnegative.int().optional(), operatingUpper: nonnegative.nullable() }).strict()),
  minimizeMachines: z.object({ priority: z.number().int().nonnegative(), weight: z.number().finite().positive(), scale: z.number().finite().positive() }).strict().optional(),
}).strict()

/** Validated boundary policy. */
export type Boundary = z.infer<typeof BoundarySchema>
/** Serializable network assumptions owned by the document. */
export type NetworkConfiguration = z.infer<typeof NetworkConfigurationSchema>
/** A port policy with default scope, bus and flow semantics resolved. */
export type NetworkPortConfiguration = NetworkConfiguration['ports'][string]

/**
 * Return a closed network with no implicit external supply or disposal.
 * @returns A serializable empty set of explicit assumptions.
 */
export function emptyNetworkConfiguration(): NetworkConfiguration {
  return { version: 1, ports: {}, machines: {} }
}
