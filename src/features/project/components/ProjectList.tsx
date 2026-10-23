import { useTranslation } from '@/common/i18n'
import { translateDiagnostic } from '@/common/i18n/translateDiagnostic'
import { useProjectStore } from '../project.store'
import { useProjects } from '../useProjects'

/**
 * Simple project list component displaying all projects with create/delete/switch actions.
 * @returns Rendered JSX element for the project list.
 */
export function ProjectList() {
  const { t } = useTranslation()
  const notice = useProjectStore((s) => s.environmentNotice)
  const { projectList, isLoading, currentProjectId, createProject, deleteProject, switchProject } = useProjects()

  if (isLoading) return <div>{t('editor.loading')}</div>

  return (
    <div>
      <h2>{t('editor.projects')}</h2>
      {notice && <p role="status">{translateDiagnostic(notice)}</p>}
      <button onClick={() => createProject(t('editor.newProjectName'))}>{t('editor.newProject')}</button>
      <ul>
        {projectList.map(p => (
          <li key={p.id} style={{ fontWeight: p.id === currentProjectId ? 'bold' : 'normal' }}>
            <span onClick={() => switchProject(p.id)} style={{ cursor: 'pointer' }}>
              {p.name}
            </span>
            <button onClick={() => deleteProject(p.id)}>{t('editor.delete')}</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
