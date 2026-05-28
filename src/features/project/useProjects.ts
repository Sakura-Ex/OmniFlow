import { useEffect } from 'react'
import { useProjectStore } from './project.store'

export function useProjects() {
  const projectList = useProjectStore(s => s.projectList)
  const isLoading = useProjectStore(s => s.isLoading)
  const currentProjectId = useProjectStore(s => s.currentProjectId)
  const loadProjectList = useProjectStore(s => s.loadProjectList)
  const createProject = useProjectStore(s => s.createProject)
  const deleteProject = useProjectStore(s => s.deleteProject)
  const switchProject = useProjectStore(s => s.switchProject)

  useEffect(() => {
    loadProjectList()
  }, [loadProjectList])

  return { projectList, isLoading, currentProjectId, createProject, deleteProject, switchProject, refreshProjects: loadProjectList }
}
