import { db } from '@/common/db/omniflowDb'
import { generateId } from '@/common/utils/id'
import type { Project } from './project.types'

const toISO = () => new Date().toISOString()

/** Service layer for project CRUD operations against the local IndexedDB. */
export class ProjectService {
  /**
   * List all projects ordered by most-recently updated.
   * @returns A promise that resolves to the project array.
   */
  async list(): Promise<Project[]> {
    return db.projects.orderBy('updatedAt').reverse().toArray()
  }

  /**
   * Create a new project with an initial canvas.
   * @param name - Display name of the project.
   * @param description - Optional description.
   * @returns The generated project ID.
   */
  async create(name: string, description?: string): Promise<string> {
    const projectId = generateId()
    const now = toISO()

    await db.transaction('rw', [db.projects, db.canvases], async () => {
      await db.projects.add({
        id: projectId, name, description: description || '', tags: [],
        settings: { tps: 20 }, resourceRegistry: {},
        createdAt: now, updatedAt: now
      })
      await db.canvases.add({
        id: generateId(), projectId, parentId: null, name: '主画板',
        nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 },
        createdAt: now, updatedAt: now
      })
    })
    return projectId
  }

  /**
   * Delete a project and all its related data (canvases, recipes, tags, import records).
   * @param projectId - The ID of the project to delete.
   */
  async delete(projectId: string): Promise<void> {
    await db.transaction('rw', [db.projects, db.canvases, db.projectRecipes, db.tags, db.importRecords], async () => {
      await db.projects.delete(projectId)
      await db.canvases.where('projectId').equals(projectId).delete()
      await db.projectRecipes.where('projectId').equals(projectId).delete()
      await db.tags.where('projectId').equals(projectId).delete()
      await db.importRecords.where('projectId').equals(projectId).delete()
    })
  }
}

/** Singleton project service instance. */
export const projectService = new ProjectService()
