import { useSettingsStore } from '@/features/settings/settings.store'
import { create } from 'zustand'
import type { Project } from './project.types'
import { projectService } from './project.service'

/** State shape for the project store. */
interface ProjectState {
  /** The currently active project ID, or `null` if none is selected. */
  currentProjectId: string | null
  /** All projects available in the local database. */
  projectList: Project[]
  /** Whether a project list load is in progress. */
  isLoading: boolean
  environmentNotice: string | null

  /** Fetch the full project list from the database. */
  loadProjectList: () => Promise<void>
  /** Create a new project and refresh the list. Returns the new project ID. */
  createProject: (name: string, description?: string) => Promise<string>
  /** Delete a project by ID (cascades to canvases, recipes, tags, records). */
  deleteProject: (id: string) => Promise<void>
  /** Set the current project ID without any server/db round-trip. */
  switchProject: (id: string) => Promise<void>
}

/**
 * Zustand store that manages the project list and the currently active project.
 * All mutations that affect the database cascade through {@link projectService}.
 */
export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProjectId: null,
  projectList: [],
  isLoading: false,
  environmentNotice: null,

  loadProjectList: async () => {
    set({ isLoading: true })
    const list = await projectService.list()
    set({ projectList: list, isLoading: false })
  },

  createProject: async (name, description) => {
    const id = await projectService.create(name, description)
    await get().loadProjectList()
    return id
  },

  deleteProject: async (id) => {
    await projectService.delete(id)
    if (get().currentProjectId === id) {
      set({ currentProjectId: null })
    }
    await get().loadProjectList()
  },

  switchProject: async (id) => {
    try {
      const previousId = get().currentProjectId
      if (previousId) await projectService.saveEnvironment(previousId, useSettingsStore.getState().units)
      const environment = await projectService.readEnvironment(id)
      useSettingsStore.getState().setEnvironment(environment.units)
      set({ currentProjectId: id, environmentNotice: environment.migrated ? `旧项目未保存单位定义，采用默认注册表与 ${environment.units.ticksPerSecond} TPS。` : null })
    } catch (error) {
      set({ environmentNotice: error instanceof Error ? error.message : String(error) })
    }
  },
}))
