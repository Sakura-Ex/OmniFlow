import { useMemo, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { useTranslation, type UiTranslationKey } from '@/common/i18n'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { useCanvasStore } from '../canvas.store'
import { deriveBrowserObjects, filterBrowserObjects, type BrowserObject } from '../objectBrowser'
import styles from './ObjectBrowser.module.css'

const typeLabels = {
  recipeNode: 'workspace.recipeNode', sourceNode: 'workspace.sourceNode',
  targetNode: 'workspace.targetNode', splitterNode: 'workspace.splitterNode', otherNode: 'workspace.otherNode',
} satisfies Record<BrowserObject['type'], UiTranslationKey>

/** Selection and view navigation remain owned by the workspace coordinator. */
interface ObjectBrowserProps {
  onSelect: (id: string) => void
  onLocate: (id: string) => void
  onReturn: () => void
  canReturn: boolean
}

/** Browse and find real graph objects while keeping selection and navigation explicit.
 * @param props - Application-owned selection and viewport actions.
 * @param props.onSelect - Select a node without moving the viewport.
 * @param props.onLocate - Explicitly navigate to a node.
 * @param props.onReturn - Restore the view preceding navigation.
 * @param props.canReturn - Whether a return view is available.
 * @returns Searchable flat object list; it does not own the graph or edit commands.
 */
export function ObjectBrowser({ onSelect, onLocate, onReturn, canReturn }: ObjectBrowserProps) {
  const { t } = useTranslation()
  const nodes = useCanvasStore(state => state.nodes)
  const edges = useCanvasStore(state => state.edges)
  const issues = useCanvasStore(state => state.calculationIssues)
  const diagnostics = useCanvasStore(state => state.diagnosticReport)
  const recipes = useRecipeStore(state => state.recipes)
  const environment = useSettingsStore(state => state.units)
  const entries = useGlobalResourceTable(state => state.entries)
  const [query, setQuery] = useState('')
  const objects = useMemo(() => deriveBrowserObjects({ nodes, edges, issues, diagnostics, recipes, environment, entries }), [nodes, edges, issues, diagnostics, recipes, environment, entries])
  const visible = useMemo(() => filterBrowserObjects(objects, query), [objects, query])
  const selected = new Set(nodes.filter(node => node.selected).map(node => node.id))
  return <section className={styles.browser} aria-label={t('workspace.objects')}>
    <div className={styles.toolbar}>
      <input className={styles.search} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('workspace.searchObjects')} aria-label={t('workspace.searchObjects')} />
      <button className={styles.returnButton} type="button" onClick={onReturn} disabled={!canReturn} title={t('workspace.returnView')} aria-label={t('workspace.returnView')}><Icon name="undo" /></button>
    </div>
    <p className={styles.count}>{t('workspace.objectCount', { shown: visible.length, total: objects.length })}</p>
    <ul className={styles.list}>
      {visible.map(object => {
        const typeName = t(typeLabels[object.type])
        const name = object.name || typeName
        return <li className={styles.row} key={object.id} data-selected={selected.has(object.id) || undefined}>
          <button type="button" className={styles.select} aria-pressed={selected.has(object.id)} onClick={() => onSelect(object.id)} title={`${name}\n${object.id}`}>
            <span className={styles.name}>{name}</span>
            <span className={styles.identity}><span className={styles.kind}>{typeName}</span><span className={styles.id}>{object.id}</span></span>
          </button>
          {object.hasIssue && <span className={styles.issue} role="img" title={t('workspace.objectIssue')} aria-label={t('workspace.objectIssue')}><Icon name="warning" size={14} /></span>}
          <button type="button" className={styles.locate} onClick={() => onLocate(object.id)} title={t('workspace.locateObject', { name })} aria-label={t('workspace.locateObject', { name })}><Icon name="fitView" size={15} /></button>
        </li>
      })}
    </ul>
    {!visible.length && <p className={styles.empty}>{t(objects.length ? 'workspace.noMatches' : 'workspace.emptyObjects')}</p>}
  </section>
}
