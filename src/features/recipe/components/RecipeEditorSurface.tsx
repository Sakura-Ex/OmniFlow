import { useEffect, useId, useRef, type ComponentProps } from 'react'
import { Icon } from '@/common/components/Icon'
import { useTranslation } from '@/common/i18n'
import { RecipeEditor } from './RecipeEditor'
import styles from './RecipeEditorSurface.module.css'

/** Change the editor container without replacing its form or draft registration. */
type RecipeEditorSurfaceProps = ComponentProps<typeof RecipeEditor> & {
  floating: boolean
  onDock: () => void
}

/** Keep one recipe form mounted when moving between the sidebar and a dialog.
 * @param props - Recipe editor and presentation properties.
 * @param props.floating - Whether the native dialog is in the modal top layer.
 * @param props.onDock - Return the existing editing session to the sidebar.
 * @returns A stable dialog element containing one persistent recipe editor.
 */
export function RecipeEditorSurface({ floating, onDock, ...editorProps }: RecipeEditorSurfaceProps) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const headingId = useId()

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (floating && !element.open) element.showModal()
    else if (!floating && element.open) element.close()
  }, [floating])

  return <dialog ref={dialog} className={`${styles.surface} ${floating ? styles.floating : styles.docked}`}
    role={floating ? 'dialog' : 'region'} aria-modal={floating ? true : undefined}
    aria-labelledby={floating ? headingId : undefined} aria-label={floating ? undefined : t('editor.editRecipe')}
    onKeyDown={event => { event.stopPropagation() }}
    onCancel={event => { event.preventDefault(); onDock() }}>
    <header className={styles.header} hidden={!floating}>
      <h2 id={headingId} title={editorProps.node?.data.machine_name}>{t('editor.editRecipe')}</h2>
      <div className={styles.actions}><button type="button" className={styles.dockButton} onClick={onDock}>
        <Icon name="chevronRight" size={16} />{t('workspace.returnToSidebar')}
      </button><button type="button" className={styles.closeButton} aria-label={t('editor.close')} onClick={editorProps.onClose}><Icon name="close" /></button></div>
    </header>
    <div className={styles.content}><RecipeEditor {...editorProps} presentation={floating ? 'window' : 'sidebar'} /></div>
  </dialog>
}
