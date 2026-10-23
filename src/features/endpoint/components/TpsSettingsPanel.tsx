import { t, useTranslation } from '@/common/i18n'
import { useState } from 'react'
import { useDocumentEdit } from '@/common/components/DocumentEditContext'
import { useDraftState } from '@/common/components/DraftStateContext'
import { useSettingsStore } from '@/features/settings/settings.store'
import { SettingsDrawerShell } from '@/common/components/SettingsDrawerShell'
import styles from './TpsSettingsPanel.module.css'

/**
 * TPS settings panel for configuring ticks-per-second used in rate calculations.
 * @param root0 - Component props.
 * @param root0.onClose - Callback fired when the panel is dismissed.
 * @param root0.embedded - Render within the full settings page.
 * @returns Rendered JSX element for the TPS settings panel.
 */
export function TpsSettingsPanel({ onClose, embedded }: { onClose: () => void; embedded?: boolean }) {
  useTranslation()
  const tps = useSettingsStore((s) => s.tps)
  const setTps = useSettingsStore((s) => s.setTps)
  const commitEdit = useDocumentEdit()
  const [edit, setEdit] = useState({ base: tps, text: String(tps) })
  const draft = edit.base === tps ? edit.text : String(tps)
  useDraftState(draft !== String(tps))
  const commit = (input: HTMLInputElement) => {
    if (!input.reportValidity() || !draft.trim()) return
    const value = Number(draft)
    if (!Number.isFinite(value) || value <= 0) return
    commitEdit(() => { if (value !== tps) setTps(value) })
    setEdit({ base: value, text: String(value) })
  }

  return (
    <SettingsDrawerShell
      title={t('canvas.tps_settings')}
      eyebrow={t('canvas.globalSettings')}
      onClose={onClose}
      embedded={embedded}
    >
      {!embedded && <p className={styles.hint}>
        <code>TPS</code> {t('canvas.controls_the_conversion_between_game_ticks_and')} <code>20</code>{t('canvas.changes_update_all_instantaneous_rates_and_displays')}
      </p>}

      <div className={styles['list-section']}>
        <div className={styles.table}>
          <div className={`${styles['table-row']} ${styles['table-row--header']}`}>
            <span>{t('canvas.parameter')}</span>
            <span>{t('canvas.current_value')}</span>
          </div>
          <div className={styles['table-row']}>
            <span className={styles.mono}>{t('canvas.ticksPerSecond')}</span>
            <input
              type="number"
              aria-label={t('canvas.ticksPerSecond')}
              min={1}
              max={1200}
              step={1}
              required
              value={draft}
              onChange={(event) => setEdit({ base: tps, text: event.target.value })}
              onBlur={(event) => commit(event.currentTarget)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setEdit({ base: tps, text: String(tps) }) }
              }}
            />
          </div>
        </div>
      </div>
    </SettingsDrawerShell>
  )
}
