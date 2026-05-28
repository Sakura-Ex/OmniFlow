import Dexie, { type Table } from 'dexie'
import type { Node, Edge } from 'reactflow'
import type { Resource } from '@/common/types/resource'
import type { ValueOf } from '@/common/types/common'

interface Project {
  id: string
  name: string
  description: string
  tags: string[]
  settings: {
    tps: number
    default_system?: string
    default_archetype?: string
  }
  resourceRegistry: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

interface Canvas {
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

const ProjectRecipeSource = {
  Import: 'import',
  Manual: 'manual',
} as const satisfies Record<string, string>

type ProjectRecipeSource = ValueOf<typeof ProjectRecipeSource>

interface ProjectRecipe {
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

interface Tag {
  id: string
  projectId: string
  name: string
  color: string
  createdAt: string
}

interface ImportRecord {
  id: string
  projectId: string
  sourceFormat: string
  fileName: string
  fileHash: string
  recipeCount: number
  successCount: number
  errorCount: number
  errors: ImportError[]
  importedAt: string
}

interface ImportError {
  row: number
  message: string
}

class OmniFlowDB extends Dexie {
  projects!: Table<Project, string>
  canvases!: Table<Canvas, string>
  projectRecipes!: Table<ProjectRecipe, string>
  tags!: Table<Tag, string>
  importRecords!: Table<ImportRecord, string>

  constructor() {
    super('OmniFlow')

    this.version(1).stores({
      projects: '&id, name, *tags, updatedAt, createdAt',

      canvases: '&id, projectId, parentId, [projectId+parentId]',

      projectRecipes: [
        '&id, projectId, recipeId, machineName, system, *tags',
        'source, importRecordId',
        '[projectId+recipeId]'
      ].join(','),

      tags: '&id, projectId, [projectId+name]',
      importRecords: '&id, projectId, fileHash'
    })
  }
}

export const db = new OmniFlowDB()
