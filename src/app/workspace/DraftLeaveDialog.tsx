import { useEffect, useRef } from 'react'
import { useTranslation } from '@/common/i18n'
import styles from './Workspace.module.css'

/** Keep the pending navigation reversible until the active draft is resolved.
 * @param props - Validated save, discard and cancellation actions.
 * @param props.saving - Whether a save is already in progress.
 * @param props.onSave - Save and continue only after validation succeeds.
 * @param props.onDiscard - Discard the active editor draft and continue.
 * @param props.onCancel - Restore the original selection and editor.
 * @returns A native modal dialog with focus containment and restoration.
 */
export function DraftLeaveDialog({ saving, onSave, onDiscard, onCancel }: { saving: boolean; onSave: () => Promise<void>; onDiscard: () => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const focus = document.activeElement
    ref.current?.showModal()
    return () => { if (focus instanceof HTMLElement && focus.isConnected) focus.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={ref} className={styles.leaveDialog} aria-labelledby="workspace-leave-title" onCancel={event => { event.preventDefault(); if (!saving) onCancel() }}>
    <h3 id="workspace-leave-title">{t('workspace.unsavedTitle')}</h3><p>{t('workspace.unsavedDescription')}</p>
    <footer><button disabled={saving} onClick={onCancel} autoFocus>{t('workspace.keepEditing')}</button><button disabled={saving} onClick={onDiscard}>{t('workspace.discard')}</button><button disabled={saving} onClick={() => { void onSave() }}>{t('workspace.saveContinue')}</button></footer>
  </dialog>
}
