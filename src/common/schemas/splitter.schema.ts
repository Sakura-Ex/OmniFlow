import { z } from 'zod'
import { ResourceSchema } from './resource.schema'

const port = ResourceSchema.pick({ portId: true, category: true, id: true, amount: true, unit: true, displayUnit: true, _uid: true }).extend({ portId: z.string().trim().min(1), routing_mode: z.literal('wired').optional() }).strict()

/** Fixed-ratio allocation is independent of machines, operation and installation. */
export const SplitterNodeDataSchema = z.object({
  input: port,
  outputs: z.array(port.extend({ ratio: z.number().finite().nonnegative() })).min(1).max(100),
  capacity: z.number().finite().nonnegative().nullable(),
}).strict().superRefine((data, context) => {
  const sum = data.outputs.reduce((total, output) => total + output.ratio, 0)
  if (Math.abs(sum - 1) > 1e-8) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Splitter ratios must sum to one', path: ['outputs'] })
  const ids = [data.input.portId, ...data.outputs.map(output => output.portId)]
  if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Splitter port identities must be unique' })
  for (const [index, output] of data.outputs.entries()) {
    if (output.id !== data.input.id || output.category !== data.input.category) context.addIssue({ code: z.ZodIssueCode.custom, message: 'All splitter branches must carry the input resource', path: ['outputs', index] })
  }
}).transform(data => {
  const sum = data.outputs.reduce((total, output) => total + output.ratio, 0)
  return { ...data, outputs: data.outputs.map(output => ({ ...output, ratio: output.ratio / sum })) }
})

/** Serializable splitter draft and verified allocation ratios. */
export type SplitterNodeData = z.infer<typeof SplitterNodeDataSchema>
