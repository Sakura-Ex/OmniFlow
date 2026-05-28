import { useEffect } from 'react'
import { useProjectStore } from './project.store'

/**
 * Convenience hook that subscribes to the project store and exposes
 * the project list, loading state, current project ID, and CRUD actions.
 * Automatically triggers a project list refresh on mount.
 *
 * @returns An object with `projectList`, `isLoading`, `currentProjectId`,
 *          `createProject`, `deleteProject`, `switchProject` and `refreshProjects`.
 */
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
