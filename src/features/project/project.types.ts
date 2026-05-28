import type { Node, Edge } from 'reactflow'
import type { Resource } from '@/common/types/resource'
import type { ValueOf } from '@/common/types/common'

/** Describes how a recipe was associated with a project. */
export const ProjectRecipeSource = {
  Import: 'import',
  Manual: 'manual',
} as const satisfies Record<string, string>

/** Union type of all {@link ProjectRecipeSource} values. */
export type ProjectRecipeSource = ValueOf<typeof ProjectRecipeSource>

/** A project entity stored in the local database. */
export interface Project {
  /** Unique project ID. */
  id: string
  /** Human-readable project name. */
  name: string
  /** Optional project description. */
  description: string
  /** Tags attached to the project. */
  tags: string[]
  /** Project-level settings (ticks-per-second, default archetype, etc.). */
  settings: { tps: number; defaultSystem?: string; defaultArchetype?: string }
  /** Free-form resource-registry overrides scoped to this project. */
  resourceRegistry: Record<string, unknown>
  /** ISO-8601 creation timestamp. */
  createdAt: string
  /** ISO-8601 last-update timestamp. */
  updatedAt: string
}

/** A canvas (diagram page) belonging to a project. */
export interface CanvasDB {
  /** Unique canvas ID. */
  id: string
  /** Owning project ID. */
  projectId: string
  /** Parent canvas ID for nested canvases, or `null` for a root canvas. */
  parentId: string | null
  /** Display name of the canvas. */
  name: string
  /** React Flow nodes on the canvas. */
  nodes: Node[]
  /** React Flow edges on the canvas. */
  edges: Edge[]
  /** Viewport state (pan & zoom). */
  viewport: { x: number; y: number; zoom: number }
  /** ISO-8601 creation timestamp. */
  createdAt: string
  /** ISO-8601 last-update timestamp. */
  updatedAt: string
}

/** A recipe that has been added to a project (either manually or via import). */
export interface ProjectRecipeDB {
  /** Unique record ID. */
  id: string
  /** Owning project ID. */
  projectId: string
  /** Reference to the source recipe's ID. */
  recipeId: string
  /** Machine name from the recipe definition. */
  machineName: string
  /** Processing system (e.g. `gtceu`, `create`). */
  system: string
  /** Archetype applied to this recipe. */
  archetypeId: string
  /** Base processing duration in seconds. */
  durationSeconds: number
  /** Recipe input resources. */
  inputs: Resource[]
  /** Recipe output resources. */
  outputs: Resource[]
  /** ID of the library the recipe was imported from, or `null`. */
  sourceLibraryId: string | null
  /** Arbitrary metadata attached to the recipe. */
  metadata: Record<string, unknown>
  /** How the recipe was associated with the project. */
  source: ProjectRecipeSource
  /** ID of the import record if this recipe was imported from a file. */
  importRecordId?: string
  /** ISO-8601 creation timestamp. */
  createdAt: string
  /** ISO-8601 last-update timestamp. */
  updatedAt: string
}

/** A tag that can be attached to a project. */
export interface Tag {
  /** Unique tag ID. */
  id: string
  /** Owning project ID. */
  projectId: string
  /** Tag display name. */
  name: string
  /** Tag colour (CSS colour value). */
  color: string
  /** ISO-8601 creation timestamp. */
  createdAt: string
}

/** Record of a file-import operation for a project. */
export interface ImportRecord {
  /** Unique record ID. */
  id: string
  /** Owning project ID. */
  projectId: string
  /** Source format identifier (e.g. `csv`, `json`). */
  sourceFormat: string
  /** Original file name. */
  fileName: string
  /** Hash of the imported file contents. */
  fileHash: string
  /** Total number of recipes found in the file. */
  recipeCount: number
  /** Number of recipes successfully imported. */
  successCount: number
  /** Number of recipes that failed to import. */
  errorCount: number
  /** Per-row error details for failed imports. */
  errors: { row: number; message: string }[]
  /** ISO-8601 timestamp of when the import occurred. */
  importedAt: string
}

/** A 2-D viewport state (pan offset and zoom level). */
export interface Viewport {
  /** Horizontal pan offset. */
  x: number
  /** Vertical pan offset. */
  y: number
  /** Zoom factor (1 = 100 %). */
  zoom: number
}
