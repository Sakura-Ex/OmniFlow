import { create } from 'zustand'
import type { Project } from './project.types'
import { projectService } from './project.service'

interface ProjectState {
  currentProjectId: string | null
  projectList: Project[]
  isLoading: boolean

  loadProjectList: () => Promise<void>
  createProject: (name: string, description?: string) => Promise<string>
  deleteProject: (id: string) => Promise<void>
  switchProject: (id: string) => void
}

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
