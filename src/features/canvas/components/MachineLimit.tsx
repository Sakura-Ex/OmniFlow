import { useRef, useState } from 'react'
import { useDocumentEdit } from '@/common/components/DocumentEditContext'
import { useTranslation } from '@/common/i18n'
import { useCanvasStore } from '../canvas.store'
import styles from './RecipeNode.module.css'

/** Edit the operating bound independently of installation results, through the document transaction.
 * @param props - Machine identity.
 * @param props.id - Persistent recipe node identity.
 * @returns A fixed-size labelled inline upper-bound field.
 */
export function MachineLimit({ id }: { id: string }) {
  const { t } = useTranslation()
  const commit = useDocumentEdit()
  const value = useCanvasStore(state => state.networkConfiguration.machines[id]?.operatingUpper ?? null)
  const [draft, setDraft] = useState<string | null>(null)
  const cancel = useRef(false)
  const invalid = draft !== null && draft.trim() !== '' && (!Number.isFinite(Number(draft)) || Number(draft) < 0)
  const confirm = () => {
    if (cancel.current) { cancel.current = false; return }
    if (draft === null || invalid) return
    const next = draft.trim() === '' ? null : Number(draft)
    if (next !== value) commit(() => {
      const canvas = useCanvasStore.getState()
      const configuration = canvas.networkConfiguration
      canvas.setNetworkConfiguration({ ...configuration, machines: { ...configuration.machines, [id]: { ...(configuration.machines[id] ?? { installed: null }), operatingUpper: next } } })
    })
    setDraft(null)
  }
  return <label className={`${styles.machineLimit} nodrag nopan`} title={invalid ? t('recipeDisplay.invalid') : t('recipeDisplay.upper')}>
    <span>{t('recipeDisplay.upper')}</span><input type="text" inputMode="decimal" aria-label={t('recipeDisplay.upper')} aria-invalid={invalid} placeholder="∞" value={draft ?? (value === null ? '' : String(value))} onChange={event => { cancel.current = false; setDraft(event.target.value) }} onBlur={confirm} onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel.current = true; setDraft(null); event.currentTarget.blur() }
    }} />
  </label>
}
