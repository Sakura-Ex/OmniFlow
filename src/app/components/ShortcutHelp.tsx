import { useEffect, useRef } from 'react'
import { Icon } from '@/common/components/Icon'
import { useTranslation, type UiTranslationKey } from '@/common/i18n'
import styles from './ShortcutHelp.module.css'

const shortcuts: Array<[UiTranslationKey, string]> = [
  ['action.undo', 'Ctrl + Z'], ['action.redo', 'Ctrl + Shift + Z / Ctrl + Y'],
  ['action.copy', 'Ctrl + C'], ['action.cut', 'Ctrl + X'], ['action.paste', 'Ctrl + V'],
  ['action.duplicate', 'Ctrl + D'], ['action.selectAll', 'Ctrl + A'],
  ['action.clearSelection', 'Escape'], ['action.delete', 'Delete / Backspace'],
]

/** Show only shortcuts supported by the canvas command handler.
 * @param props - Dialog close action.
 * @param props.onClose - Return to the canvas.
 * @returns A focus-contained native dialog.
 */
export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="shortcut-help-title" onCancel={onClose}>
    <header><h2 id="shortcut-help-title">{t('action.shortcuts')}</h2><button type="button" autoFocus onClick={onClose} aria-label={t('common.close')}><Icon name="close" /></button></header>
    <p>{t('help.shortcutsHint')}</p>
    <dl>{shortcuts.map(([key, chord]) => <div key={key}><dt>{t(key)}</dt><dd><kbd>{chord}</kbd></dd></div>)}</dl>
  </dialog>
}
