import { useProjects } from '../useProjects'

export function ProjectList() {
  const { projectList, isLoading, currentProjectId, createProject, deleteProject, switchProject } = useProjects()

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <h2>项目列表</h2>
      <button onClick={() => createProject('新项目')}>+ 新建项目</button>
      <ul>
        {projectList.map(p => (
          <li key={p.id} style={{ fontWeight: p.id === currentProjectId ? 'bold' : 'normal' }}>
            <span onClick={() => switchProject(p.id)} style={{ cursor: 'pointer' }}>
              {p.name}
            </span>
            <button onClick={() => deleteProject(p.id)}>删除</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
