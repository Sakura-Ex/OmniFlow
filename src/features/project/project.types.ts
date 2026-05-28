import type { Node, Edge } from 'reactflow'
import type { Resource } from '@/common/types/resource'
import type { ValueOf } from '@/common/types/common'

export const ProjectRecipeSource = {
  Import: 'import',
  Manual: 'manual',
} as const satisfies Record<string, string>

export type ProjectRecipeSource = ValueOf<typeof ProjectRecipeSource>

export interface Project {
  id: string
  name: string
  description: string
  tags: string[]
  settings: { tps: number; defaultSystem?: string; defaultArchetype?: string }
  resourceRegistry: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface CanvasDB {
  id: string
  projectId: string
  parentId: string | null
  name: string
  nodes: Node[]
  edges: Edge[]
  viewport: { x: number; y: number; zoom: number }
  createdAt: string
  updatedAt: string
}

export interface ProjectRecipeDB {
  id: string
  projectId: string
  recipeId: string
  machineName: string
  system: string
  archetypeId: string
  durationSeconds: number
  inputs: Resource[]
  outputs: Resource[]
  sourceLibraryId: string | null
  metadata: Record<string, unknown>
  source: ProjectRecipeSource
  importRecordId?: string
  createdAt: string
  updatedAt: string
}

export interface Tag {
  id: string
  projectId: string
  name: string
  color: string
  createdAt: string
}

export interface ImportRecord {
  id: string
  projectId: string
  sourceFormat: string
  fileName: string
  fileHash: string
  recipeCount: number
  successCount: number
  errorCount: number
  errors: { row: number; message: string }[]
  importedAt: string
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}
