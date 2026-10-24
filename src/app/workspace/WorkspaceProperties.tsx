import { RecipeEditorSurface } from '@/features/recipe/components/RecipeEditorSurface'
import { useId, type ComponentProps, type ReactNode } from 'react'
import type { Edge, Node } from 'reactflow'
import { EditorDraftContext } from '@/common/components/EditorDraftContext'
import { Icon } from '@/common/components/Icon'
import { useTranslation, type UiTranslationKey } from '@/common/i18n'
import { buildResourceId } from '@/common/utils/resourceId'
import type { RecipeEditor } from '@/features/recipe/components/RecipeEditor'
import { EndpointEditor } from '@/features/endpoint/components/EndpointEditor'
import { NetworkConfigurationEditor } from '@/features/calculation/components/NetworkConfigurationEditor'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import type { EditorFailure } from '@/app/editors/editorCommit'
import type { PropertySection, useWorkspace } from './useWorkspace'
import { PanelTabs } from './PanelTabs'
import styles from './Workspace.module.css'

const sectionLabels: Record<PropertySection, UiTranslationKey> = {
  boundaries: 'workspace.boundaries', recipe: 'workspace.recipe', resources: 'workspace.resources',
}
const nodeLabels: Record<string, UiTranslationKey> = {
  recipeNode: 'workspace.recipeNode', sourceNode: 'workspace.sourceNode', targetNode: 'workspace.targetNode', splitterNode: 'workspace.splitterNode',
}
const errorLabels: Record<EditorFailure, UiTranslationKey> = {
  missing: 'workspace.missing', conflict: 'workspace.conflict', invalid: 'workspace.invalid',
}

/** Existing domain editors keep their own public targets and save signatures. */
interface WorkspacePropertiesProps {
  workspace: Pick<ReturnType<typeof useWorkspace>, 'properties' | 'expanded' | 'recipeWindow' | 'setRecipeWindow' | 'target' | 'setExpanded' | 'closeProperties' | 'openProperties' | 'locate'>
  node?: Node
  nodes: Node[]
  edges: Edge[]
  recipe: (NonNullable<ComponentProps<typeof RecipeEditor>['node']> & { sessionId: number }) | null
  endpoint: (NonNullable<ComponentProps<typeof EndpointEditor>['node']> & { sessionId: number }) | null
  onSaveRecipe: ComponentProps<typeof RecipeEditor>['onSave']
  onSaveEndpoint: ComponentProps<typeof EndpointEditor>['onSave']
  registerDraft: ComponentProps<typeof EditorDraftContext.Provider>['value']
  error: EditorFailure | null
}

/** Present one contextual editor or an explicit selection overview in the right sidebar.
 * @param props - Current workspace target and the existing domain editor contracts.
 * @returns A named property panel whose navigation remains guarded by the application.
 */
export function WorkspaceProperties(props: WorkspacePropertiesProps) {
  const { workspace, node, nodes, edges, recipe, endpoint, onSaveRecipe, onSaveEndpoint, registerDraft, error } = props
  const { t } = useTranslation()
  const panelId = useId()
  const recipes = useRecipeStore(state => state.recipes)
  const entries = useGlobalResourceTable(state => state.entries)
  const typeName = (item: Node) => t(nodeLabels[item.type ?? ''] ?? 'workspace.otherNode')
  const resourceName = (value: unknown): string => {
    if (!value || typeof value !== 'object') return ''
    const resource = value as Record<string, unknown>
    if (typeof resource.category !== 'string' || typeof resource.id !== 'string') return ''
    return entries[buildResourceId(resource.category, resource.id)]?.displayName || resource.id
  }
  const nodeName = (item: Node): string => {
    if (item.type === 'recipeNode' && recipes[item.id]?.machine_name) return recipes[item.id].machine_name
    if (typeof item.data.label === 'string' && item.data.label.trim()) return item.data.label
    const resources: unknown[] = item.type === 'splitterNode' ? [item.data.input] : Array.isArray(item.data.ports) ? item.data.ports : []
    const names = [...new Set(resources.map(resourceName).filter(Boolean))]
    return names.length ? names.join(' · ') : typeName(item)
  }
  const selectedNodes = nodes.filter(item => item.selected)
  const selectedEdges = edges.filter(item => item.selected)
  const edge = !node && selectedNodes.length === 0 && selectedEdges.length === 1 ? selectedEdges[0] : null
  const hasSelection = selectedNodes.length + selectedEdges.length > 0
  let title = t('workspace.properties')
  let identity = ''
  if (node) { title = nodeName(node); identity = `${typeName(node)} · ${node.id}` }
  else if (edge) { title = t('workspace.edge'); identity = edge.id }
  else if (recipe) { title = recipe.data.machine_name; identity = recipe.id }
  else if (endpoint) { title = t(endpoint.role === 'source' ? 'workspace.sourceNode' : 'workspace.targetNode'); identity = endpoint.id }
  else if (hasSelection) title = t('workspace.selection')

  const sections: PropertySection[] = []
  if (node?.type === 'recipeNode') sections.push('boundaries', 'recipe')
  else if (node?.type === 'sourceNode' || node?.type === 'targetNode') sections.push('boundaries', 'resources')
  const activeTab = sections.length ? workspace.target.section : 'properties'
  const tabs = sections.length
    ? sections.map(section => ({ value: section, label: t(sectionLabels[section]) }))
    : [{ value: 'properties', label: t('workspace.properties') }]

  let content: ReactNode = null
  if (workspace.properties) {
    if (recipe) {
      content = <RecipeEditorSurface floating={workspace.recipeWindow} onDock={() => workspace.setRecipeWindow(false)} key={`${recipe.id}:${recipe.sessionId}`} node={recipe} onClose={workspace.closeProperties} onSave={onSaveRecipe} />
    } else if (endpoint) {
      content = <EndpointEditor key={`${endpoint.id}:${endpoint.sessionId}`} node={endpoint} onClose={workspace.closeProperties} onSave={onSaveEndpoint} />
    } else if (node && sections.length) {
      content = <NetworkConfigurationEditor key={node.id} nodeId={node.id} sidebar onClose={workspace.closeProperties} />
    } else if (node) {
      content = <div className={styles.empty}><p>{t('workspace.inlineOnly')}</p><button className={styles.overviewAction} onClick={() => workspace.locate(node.id)}><Icon name="fitView" />{t('workspace.locateObject', { name: nodeName(node) })}</button></div>
    } else if (edge) {
      content = <dl className={styles.selectionOverview}>{(['source', 'target'] as const).map(side => {
        const connected = nodes.find(item => item.id === edge[side])
        const handle = side === 'source' ? edge.sourceHandle : edge.targetHandle
        return <div key={side}><dt>{t(side === 'source' ? 'workspace.source' : 'workspace.target')}</dt><dd><span>{connected ? nodeName(connected) : edge[side]}</span><small>{edge[side]}{handle ? ` / ${handle}` : ''}</small></dd></div>
      })}</dl>
    } else if (hasSelection) {
      const counts = new Map<string, number>()
      selectedNodes.forEach(item => { const label = typeName(item); counts.set(label, (counts.get(label) ?? 0) + 1) })
      if (selectedEdges.length) counts.set(t('workspace.edge'), selectedEdges.length)
      content = <div className={styles.empty}><p>{t('workspace.selectedCount', { nodes: selectedNodes.length, edges: selectedEdges.length })}</p><dl className={styles.selectionOverview}>{[...counts].map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl><p>{t('workspace.noBatchEditing')}</p></div>
    } else {
      content = <p className={styles.empty}>{t('workspace.selectObject')}</p>
    }
  }

  return <aside className={`${styles.sidebar} ${styles.properties} ${workspace.expanded ? styles.expanded : ''}`} hidden={!workspace.properties} aria-label={t('workspace.properties')} data-workspace-properties tabIndex={-1} onKeyDown={event => {
    if (event.key === 'Escape' && !event.defaultPrevented) { event.stopPropagation(); workspace.closeProperties() }
    if (event.key === 'Delete' || event.key === 'Backspace' || event.ctrlKey || event.metaKey) event.stopPropagation()
  }}>
    <PanelTabs id={panelId} label={t('workspace.properties')} items={tabs} value={activeTab} onChange={section => {
      const target = sections.find(item => item === section)
      if (node && target) workspace.openProperties(node.id, target)
    }} trailing={<>
      {recipe && <button aria-label={t('workspace.openRecipeWindow')} title={t('workspace.openRecipeWindow')} onClick={() => workspace.setRecipeWindow(true)}><Icon name="duplicate" /></button>}
      <button aria-label={t(workspace.expanded ? 'workspace.shrinkEditor' : 'workspace.expandEditor')} onClick={() => workspace.setExpanded(!workspace.expanded)}><Icon name="fitView" /></button>
      <button aria-label={t('canvas.close')} onClick={workspace.closeProperties}><Icon name="close" /></button>
    </>} />
    <header className={styles.header}>
      <div className={styles.propertyHeading}><strong title={title}>{title}</strong>{identity && <small title={identity}>{identity}</small>}</div>
    </header>
    <div className={styles.body} role="tabpanel" id={`${panelId}-panel-${activeTab}`} aria-labelledby={`${panelId}-tab-${activeTab}`}>
      {error && <div role="alert" className={styles.empty}>{t(errorLabels[error])} <button className={styles.overviewAction} onClick={() => workspace.openProperties(workspace.target.id, workspace.target.section)}>{t('workspace.reload')}</button></div>}
      <EditorDraftContext.Provider value={registerDraft}>{content}</EditorDraftContext.Provider>
    </div>
  </aside>
}
