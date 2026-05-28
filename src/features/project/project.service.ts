import { db } from '@/common/db/omniflowDb'
import { generateId } from '@/common/utils/id'
import type { Project } from './project.types'

const toISO = () => new Date().toISOString()

export class ProjectService {
  async list(): Promise<Project[]> {
    return db.projects.orderBy('updatedAt').reverse().toArray()
  }

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

export const projectService = new ProjectService()
