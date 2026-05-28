import { z } from 'zod'

export const ProjectSettingsSchema = z.object({
  tps: z.number(),
  default_system: z.string().optional(),
  default_archetype: z.string().optional(),
})

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

export type ProjectSchemaType = z.infer<typeof ProjectSchema>

export const ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
})

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

export type CanvasSchemaType = z.infer<typeof CanvasSchema>
