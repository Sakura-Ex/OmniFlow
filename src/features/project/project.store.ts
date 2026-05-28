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

  /** Fetch the full project list from the database. */
  loadProjectList: () => Promise<void>
  /** Create a new project and refresh the list. Returns the new project ID. */
  createProject: (name: string, description?: string) => Promise<string>
  /** Delete a project by ID (cascades to canvases, recipes, tags, records). */
  deleteProject: (id: string) => Promise<void>
  /** Set the current project ID without any server/db round-trip. */
  switchProject: (id: string) => void
}

/**
 * Zustand store that manages the project list and the currently active project.
 * All mutations that affect the database cascade through {@link projectService}.
 */
export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProjectId: null,
  projectList: [],
  isLoading: false,

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

  switchProject: (id) => set({ currentProjectId: id }),
}))
