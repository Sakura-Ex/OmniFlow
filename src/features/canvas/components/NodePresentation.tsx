import { useId, useRef, type ReactNode } from 'react'
import { Icon } from '@/common/components/Icon'
import { t, useTranslation } from '@/common/i18n'
import { useCanvasStore } from '../canvas.store'
import styles from './NodePresentation.module.css'

/** Explicit temporary inspection in the top layer leaves canvas geometry untouched.
 * @param root0 - Inspection content and trigger label.
 * @param root0.title - Accessible dialog title.
 * @param root0.children - Full node information.
 * @param root0.label - Optional contextual trigger label.
 * @returns A button and modal in the browser's top layer.
 */
export function NodeDetails({ title, children, label }: { title: string; children: ReactNode; label?: string }) {
  useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  return <>
    <button ref={trigger} type="button" className={`${styles.detailsButton} nodrag nopan`} title={label ?? t('canvas.nodeDetails')} aria-label={label ?? t('canvas.nodeDetails')} onClick={event => { event.stopPropagation(); dialog.current?.showModal() }}><Icon name="more" size={15} /></button>
    <dialog ref={dialog} className={`${styles.dialog} nodrag nopan nowheel`} aria-labelledby={titleId} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} onClose={() => trigger.current?.focus({ preventScroll: true })}>
      <header className={styles.detailsHeader}><strong id={titleId}>{title}</strong><button type="button" className={styles.detailsButton} aria-label={t('canvas.close')} onClick={() => dialog.current?.close()}><Icon name="close" /></button></header>
      <div className={styles.detailsBody}>{children}</div>
    </dialog>
  </>
}

/** Fixed status slot distinguishes retained results from the current calculation.
 * @returns A single-line status that cannot expand the card.
 */
export function NodeCalculationStatus() {
  useTranslation()
  const status = useCanvasStore(state => state.calculationStatus)
  const retained = useCanvasStore(state => state.lastCalculationResult !== null)
  // Keep the fixed slot so accepting an optimal result never resizes the node.
  if (status === 'success') return <div className={styles.status} aria-hidden="true" />
  const labels = { idle: t('shell.idle'), running: retained ? t('shell.runningRetained') : t('shell.running'), success: t('shell.success'), feasible: t('shell.feasible'), stale: t('shell.stale'), error: retained ? t('shell.errorRetained') : t('shell.error') }
  return <div className={styles.status} data-status={status} title={labels[status]}><Icon name={status === 'error' || status === 'stale' ? 'warning' : 'clock'} size={12} /><span>{labels[status]}</span></div>
}
