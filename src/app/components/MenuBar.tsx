import { useRef } from 'react'
import type { ComponentProps, KeyboardEvent, RefObject } from 'react'
import { Icon } from '@/common/components/Icon'
import { useTranslation } from '@/common/i18n'
import styles from './MenuBar.module.css'

/** Optional capabilities stay visibly unavailable until a real handler is supplied. */
export type MenuBarProps = {
  isDirty?: boolean
  menuRef: RefObject<HTMLDivElement | null>
  openMenu: string | null
  setOpenMenu: (menu: string | null) => void
  handleMenuAction: (action: () => void) => void
  handleSaveCanvas: () => void
  handleLoadCanvas: () => void
  handleExportJson: () => void
  handleImportClick: () => void
  undo: () => void
  redo: () => void
  handleCopy: () => Promise<void>
  handleCut: () => Promise<void>
  handlePaste: () => Promise<void>
  handleDuplicate: () => void
  handleSelectAll: () => void
  handleClearSelection: () => void
  handleDeleteSelected: () => void
  handleDeleteSelectedNodes: () => void
  handleDeleteSelectedEdges: () => void
  handleClear: () => void
  handleAddSplitter: () => void
  handleAddSource: () => void
  handleAddFurnace: () => void
  handleAddTarget: () => void
  handleAddCustomRecipe: () => void
  handleAutoFillSelected: () => void
  handleFitView: () => void
  handleCalculate: () => Promise<void>
  onOpenSettings: () => void
  onNewCanvas?: () => void
  onSaveAs?: () => void
  onOpenRecent?: () => void
  onOpenExample?: () => void
  handleInvertSelection?: () => void
  handleFocusSelection?: () => void
  handleZoom100?: () => void
  onToggleResults?: () => void
  onToggleEdgeLabels?: () => void
  onOpenShortcuts?: () => void
  showResults?: boolean
  showEdgeLabels?: boolean
  canUndo?: boolean
  canRedo?: boolean
  hasSelection?: boolean
  hasSelectedNodes?: boolean
  hasSelectedEdges?: boolean
  hasSelectedRecipes?: boolean
  hasCanvasContent?: boolean
  isCalculating?: boolean
  status?: {
    kind: 'idle' | 'running' | 'success' | 'feasible' | 'stale' | 'error' | 'retained'
    message?: string
  }
}

/** One flat action row; missing actions are distinct from context-disabled actions. */
type MenuAction = {
  label: string
  icon: ComponentProps<typeof Icon>['name']
  action?: () => void | Promise<void>
  shortcut?: string
  disabled?: boolean
  checked?: boolean
  danger?: boolean
}

const mainMenuIds = ['file', 'edit', 'select', 'add', 'arrange', 'view'] as const
const utilityMenuIds = ['settings', 'help'] as const
const menuIds = [...mainMenuIds, ...utilityMenuIds] as const

/** Render the document menus and the single primary calculation action.
 * @param props - Existing canvas commands and explicitly supported optional capabilities.
 * @returns Accessible menu bar with flat command groups.
 */
export function MenuBar(props: MenuBarProps) {
  const { t } = useTranslation()
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({})
  const {
    openMenu, setOpenMenu, menuRef, handleMenuAction,
    hasSelection = true, hasSelectedNodes = true, hasSelectedEdges = true,
    hasSelectedRecipes = true, hasCanvasContent = true,
  } = props
  const shortcutModifier = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'
  const shortcut = (key: string) => `${shortcutModifier}+${key}`
  const menus: Record<typeof menuIds[number], (MenuAction | null)[]> = {
    file: [
      { label: t('action.new'), icon: 'plus', action: props.onNewCanvas },
      { label: t('action.open'), icon: 'folder', action: props.handleLoadCanvas },
      { label: t('action.recent'), icon: 'clock', action: props.onOpenRecent },
      null,
      { label: t('action.save'), icon: 'save', action: props.handleSaveCanvas },
      { label: t('action.saveAs'), icon: 'save', action: props.onSaveAs },
      null,
      { label: t('action.import'), icon: 'upload', action: props.handleImportClick },
      { label: t('action.export'), icon: 'download', action: props.handleExportJson },
      { label: t('action.extractSelection'), icon: 'duplicate' },
      null,
      { label: t('action.example'), icon: 'folder', action: props.onOpenExample },
    ],
    edit: [
      { label: t('action.undo'), icon: 'undo', action: props.undo, shortcut: shortcut('Z'), disabled: props.canUndo === false },
      { label: t('action.redo'), icon: 'redo', action: props.redo, shortcut: shortcut('Shift+Z / Y'), disabled: props.canRedo === false },
      null,
      { label: t('action.cut'), icon: 'cut', action: props.handleCut, shortcut: shortcut('X'), disabled: !hasSelectedNodes },
      { label: t('action.copy'), icon: 'copy', action: props.handleCopy, shortcut: shortcut('C'), disabled: !hasSelectedNodes },
      { label: t('action.paste'), icon: 'paste', action: props.handlePaste, shortcut: shortcut('V') },
      { label: t('action.duplicate'), icon: 'duplicate', action: props.handleDuplicate, shortcut: shortcut('D'), disabled: !hasSelectedNodes },
      null,
      { label: t('action.delete'), icon: 'trash', action: props.handleDeleteSelected, shortcut: 'Del / ⌫', disabled: !hasSelection, danger: true },
      { label: t('action.deleteNodes'), icon: 'trash', action: props.handleDeleteSelectedNodes, disabled: !hasSelectedNodes, danger: true },
      { label: t('action.deleteEdges'), icon: 'unlink', action: props.handleDeleteSelectedEdges, disabled: !hasSelectedEdges, danger: true },
      null,
      { label: t('action.autofill'), icon: 'wand', action: props.handleAutoFillSelected, disabled: !hasSelectedRecipes },
      { label: t('action.clear'), icon: 'clear', action: props.handleClear, disabled: !hasCanvasContent, danger: true },
    ],
    select: [
      { label: t('action.selectAll'), icon: 'selectAll', action: props.handleSelectAll, shortcut: shortcut('A'), disabled: !hasCanvasContent },
      { label: t('action.clearSelection'), icon: 'clearSelection', action: props.handleClearSelection, shortcut: 'Esc', disabled: !hasSelection },
      { label: t('action.invertSelection'), icon: 'selectAll', action: props.handleInvertSelection, disabled: !hasCanvasContent },
      null,
      { label: t('action.selectUpstream'), icon: 'undo' },
      { label: t('action.selectDownstream'), icon: 'redo' },
      { label: t('action.selectDirectUpstream'), icon: 'undo' },
      { label: t('action.selectDirectDownstream'), icon: 'redo' },
      { label: t('action.selectConnectedLine'), icon: 'link' },
      { label: t('action.selectBetweenNodes'), icon: 'link' },
      null,
      { label: t('action.includeGlobalBus'), icon: 'link' },
    ],
    arrange: [
      { label: t('action.arrangeSelection'), icon: 'wand' },
      null,
      { label: t('action.alignLeft'), icon: 'selectAll' },
      { label: t('action.alignCenter'), icon: 'selectAll' },
      { label: t('action.alignRight'), icon: 'selectAll' },
      { label: t('action.alignTop'), icon: 'selectAll' },
      { label: t('action.alignMiddle'), icon: 'selectAll' },
      { label: t('action.alignBottom'), icon: 'selectAll' },
      null,
      { label: t('action.distributeHorizontally'), icon: 'selectAll' },
      { label: t('action.distributeVertically'), icon: 'selectAll' },
      null,
      { label: t('action.groupSelection'), icon: 'folder' },
      { label: t('action.renameGroup'), icon: 'folder' },
      { label: t('action.ungroup'), icon: 'unlink' },
    ],
    add: [
      { label: t('action.recipe'), icon: 'plus', action: props.handleAddFurnace },
      { label: t('action.source'), icon: 'plus', action: props.handleAddSource },
      { label: t('action.target'), icon: 'plus', action: props.handleAddTarget },
      { label: t('action.splitter'), icon: 'plus', action: props.handleAddSplitter },
      null,
      { label: t('action.customRecipe'), icon: 'plus', action: props.handleAddCustomRecipe },
    ],
    view: [
      { label: t('action.fitView'), icon: 'fitView', action: props.handleFitView, disabled: !hasCanvasContent },
      { label: t('action.focusSelection'), icon: 'fitView', action: props.handleFocusSelection, disabled: !hasSelection },
      { label: t('action.zoom100'), icon: 'fitView', action: props.handleZoom100 },
      { label: t('action.locateProblemNodes'), icon: 'warning' },
      null,
      { label: t('action.results'), icon: 'check', action: props.onToggleResults, checked: props.showResults },
      { label: t('action.edgeLabels'), icon: 'link', action: props.onToggleEdgeLabels, checked: props.showEdgeLabels },
    ],
    settings: [],
    help: [
      { label: t('action.shortcuts'), icon: 'selectAll', action: props.onOpenShortcuts },
      { label: t('action.guide'), icon: 'folder' },
      { label: t('action.about'), icon: 'settings' },
    ],
  }
  const focusItems = (id: string, last = false) => {
    requestAnimationFrame(() => {
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>(`[data-menu="${id}"] button:not(:disabled)`)
      items?.[last ? items.length - 1 : 0]?.focus()
    })
  }
  const switchMenu = (id: string, focus = false, last = false) => {
    setOpenMenu(id === 'settings' ? null : id)
    if (focus && id !== 'settings') focusItems(id, last)
  }
  const closeMenu = () => {
    if (openMenu) triggers.current[openMenu]?.focus()
    setOpenMenu(null)
  }
  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: typeof menuIds[number]) => {
    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') closeMenu()
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { if (id !== 'settings') switchMenu(id, true, event.key === 'ArrowUp') }
      else {
        const index = menuIds.indexOf(id)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? menuIds.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + menuIds.length) % menuIds.length
        triggers.current[menuIds[next]]?.focus()
        if (openMenu) switchMenu(menuIds[next])
      }
    }
  }
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>, id: typeof menuIds[number]) => {
    if (event.key === 'Tab') {
      setOpenMenu(null)
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Escape') closeMenu()
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const index = (menuIds.indexOf(id) + (event.key === 'ArrowRight' ? 1 : -1) + menuIds.length) % menuIds.length
      triggers.current[menuIds[index]]?.focus()
      switchMenu(menuIds[index], true)
    } else {
      const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
      const current = items.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next]?.focus()
    }
  }
  const renderMenu = (id: typeof menuIds[number]) => (
    <div className={styles.group} key={id}>
      <button
        ref={element => { triggers.current[id] = element }}
        className={styles.trigger}
        type="button"
        role="menuitem"
        aria-haspopup={id === 'settings' ? 'dialog' : 'menu'}
        aria-expanded={id === 'settings' ? undefined : openMenu === id}
        aria-controls={id === 'settings' ? 'application-settings' : `canvas-menu-${id}`}
        id={`canvas-menu-trigger-${id}`}
        onClick={() => { if (id === 'settings') handleMenuAction(props.onOpenSettings); else setOpenMenu(openMenu === id ? null : id) }}
        onPointerEnter={() => { if (openMenu && openMenu !== id) switchMenu(id) }}
        onKeyDown={event => onTriggerKeyDown(event, id)}
      >
        {t(`menu.${id}`)}
        {id !== 'settings' && <Icon name="chevronDown" size={12} />}
      </button>
      {openMenu === id && (
        <div
          className={`${styles.dropdown} ${id === 'help' || id === 'settings' ? styles.alignEnd : ''}`}
          role="menu"
          aria-labelledby={`canvas-menu-trigger-${id}`}
          id={`canvas-menu-${id}`}
          data-menu={id}
          onKeyDown={event => onMenuKeyDown(event, id)}
        >
          {menus[id].map((item, index) => item === null
            ? <div key={`divider-${index}`} role="separator" className={styles.divider} />
            : <button
                key={item.label}
                className={`${styles.item} ${item.danger ? styles.danger : ''}`}
                type="button"
                role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                aria-checked={item.checked}
                disabled={!item.action || item.disabled}
                onClick={item.action && !item.disabled ? () => {
                  triggers.current[id]?.focus()
                  handleMenuAction(() => { void item.action?.() })
                } : undefined}
              >
                <span className={styles.itemIcon}><Icon name={item.checked ? 'check' : item.icon} /></span>
                <span className={styles.label}>{item.label}</span>
                <span className={styles.hint}>{!item.action ? t('common.unavailable') : item.shortcut}</span>
              </button>)}
        </div>
      )}
    </div>
  )
  const status = props.isCalculating ? 'running' : props.status?.kind ?? 'idle'
  return (
    <div className={styles.bar} ref={menuRef}>
      <div className={styles.menus} role="menubar" aria-label="OmniFlow">
        {mainMenuIds.map(renderMenu)}
      </div>
      <button className={styles.calculate} type="button" disabled={props.isCalculating} onClick={() => { setOpenMenu(null); void props.handleCalculate() }}>
        <Icon name="bolt" />{t(props.isCalculating ? 'calculation.running' : 'calculation.calculate')}
      </button>
      <div className={`${styles.status} ${styles[status]}`} role="status" title={props.status?.message || t(`calculation.${status}`)}>
        <span className={styles.statusDot} aria-hidden="true" />
        <span className={styles.statusText}>{t(`calculation.${status}`)}</span>
      </div>
      <div className={styles.utilities} role="menubar" aria-label={t('menu.settings')}>
        {utilityMenuIds.map(renderMenu)}
      </div>
      {props.isDirty && <span className={styles.status} role="status">{t('shell.unsaved')}</span>}
    </div>
  )
}
