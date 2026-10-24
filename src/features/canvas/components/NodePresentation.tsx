import { useId, useRef, type ReactNode } from 'react'
import { Icon } from '@/common/components/Icon'
import { t, useTranslation } from '@/common/i18n'
import styles from './NodePresentation.module.css'

/** Explicit temporary inspection in the top layer leaves canvas geometry untouched.
 * @param root0 - Inspection content and trigger label.
 * @param root0.title - Accessible dialog title.
 * @param root0.children - Full node information.
 * @param root0.label - Optional contextual trigger label.
 * @param root0.inline - Fit the glyph into a resource auxiliary row, retaining a larger hit area.
 * @returns A button and modal in the browser's top layer.
 */
export function NodeDetails({ title, children, label, inline = false }: { title: string; children: ReactNode; label?: string; inline?: boolean }) {
  useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  return <>
    <button ref={trigger} type="button" className={`${styles.detailsButton}${inline ? ` ${styles.inlineButton}` : ''} nodrag nopan`} title={label ?? t('canvas.nodeDetails')} aria-label={label ?? t('canvas.nodeDetails')} onClick={event => { event.stopPropagation(); dialog.current?.showModal() }}><Icon name="more" size={15} /></button>
    <dialog ref={dialog} className={`${styles.dialog} nodrag nopan nowheel`} aria-labelledby={titleId} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} onClose={() => trigger.current?.focus({ preventScroll: true })}>
      <header className={styles.detailsHeader}><strong id={titleId}>{title}</strong><button type="button" className={styles.detailsButton} aria-label={t('canvas.close')} onClick={() => dialog.current?.close()}><Icon name="close" /></button></header>
      <div className={styles.detailsBody}>{children}</div>
    </dialog>
  </>
}
