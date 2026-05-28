import { z } from 'zod'

/** Zod schema for project-level settings such as ticks-per-second and default system/archetype. */
export const ProjectSettingsSchema = z.object({
  tps: z.number(),
  default_system: z.string().optional(),
  default_archetype: z.string().optional(),
})

/** Zod schema for a full project record including settings and resource registry. */
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  settings: ProjectSettingsSchema,
  resourceRegistry: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/** Inferred TypeScript type for a project record. */
export type ProjectSchemaType = z.infer<typeof ProjectSchema>

/** Zod schema for a viewport state (pan/zoom coordinates). */
export const ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
})

/** Zod schema for a canvas (nested diagram page) with nodes, edges and viewport. */
export const CanvasSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  parentId: z.string().nullable(),
  name: z.string(),
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
  viewport: ViewportSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

/**
 *
 */
export type CanvasSchemaType = z.infer<typeof CanvasSchema>
