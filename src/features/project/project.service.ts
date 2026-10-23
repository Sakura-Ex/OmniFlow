import { emptyNetworkConfiguration } from '@/common/schemas/network.schema'
import type { UnitSnapshot } from '@/common/types/units'
import { UnitSystem } from '@/common/units/UnitSystem'
import { DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'
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
        settings: { tps: 20, units: new UnitSystem(DEFAULT_UNIT_SNAPSHOT).snapshot }, resourceRegistry: {},
        createdAt: now, updatedAt: now
      })
      await db.canvases.add({
        id: generateId(), projectId, parentId: null, name: '主画板',
        nodes: [], edges: [], networkConfiguration: emptyNetworkConfiguration(), viewport: { x: 0, y: 0, zoom: 1 },
        createdAt: now, updatedAt: now
      })
    })
    return projectId
  }

  /**
   * Persist the project environment alongside its legacy TPS field.
   * @param projectId - Persistent project identity.
   * @param snapshot - Serializable environment and unit registry snapshot.
   */
  async saveEnvironment(projectId: string, snapshot: UnitSnapshot): Promise<void> {
    const units = new UnitSystem(snapshot).snapshot
    const project = await db.projects.get(projectId)
    if (!project) throw new Error(`Unknown project: ${projectId}`)
    await db.projects.update(projectId, { settings: { ...project.settings, tps: units.ticksPerSecond, units }, updatedAt: toISO() })
  }

  /**
   * Restore explicit definitions or migrate legacy TPS into the default registry.
   * @returns Restored environment and whether legacy definitions were supplied.
   * @param projectId - Persistent project identity.
   */
  async readEnvironment(projectId: string): Promise<{ units: UnitSnapshot; migrated: boolean }> {
    const project = await db.projects.get(projectId)
    if (!project) throw new Error(`Unknown project: ${projectId}`)
    return { units: new UnitSystem(project.settings.units ?? { ...DEFAULT_UNIT_SNAPSHOT, ticksPerSecond: project.settings.tps }).snapshot, migrated: !project.settings.units }
  }

  /**
   * Delete a project and its dependent records.
   * @param projectId - Persistent project identity.
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
