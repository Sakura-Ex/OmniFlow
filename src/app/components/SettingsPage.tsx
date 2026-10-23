import { useCallback, useEffect, useRef, useState } from 'react'
import { DraftStateContext } from '@/common/components/DraftStateContext'
import { Icon } from '@/common/components/Icon'
import { useTranslation } from '@/common/i18n'
import type { UiTranslationKey } from '@/common/i18n'
import type { ThemeMode } from '@/hooks/useTheme'
import { NetworkConfigurationEditor } from '@/features/calculation/components/NetworkConfigurationEditor'
import { ResourceRegistryPanel } from '@/features/resource-registry/components/ResourceRegistryPanel'
import { TpsSettingsPanel } from '@/features/endpoint/components/TpsSettingsPanel'
import styles from './SettingsPage.module.css'

const sections = [
  { id: 'general', key: 'settings.general', icon: 'sun' },
  { id: 'production', key: 'settings.production', icon: 'settings' },
  { id: 'resources', key: 'settings.resources', icon: 'folder' },
  { id: 'units', key: 'settings.units', icon: 'clock' },
] as const satisfies ReadonlyArray<{ id: string; key: UiTranslationKey; icon: Parameters<typeof Icon>[0]['name'] }>

/** Application settings share existing staged document editors and immediate UI preferences. */
type SettingsPageProps = {
  theme: ThemeMode
  toggleTheme: () => void
  takeSnapshot: () => void
  onClose: () => void
}

/** Show a full settings page without losing document drafts when categories change.
 * @param props - Canvas return, history and appearance controls.
 * @param props.theme - Current UI theme.
 * @param props.toggleTheme - Switch the current UI theme.
 * @param props.takeSnapshot - Record history before saving network settings.
 * @param props.onClose - Return to the canvas.
 * @returns A native modal page that contains focus while open.
 */
export function SettingsPage({ theme, toggleTheme, takeSnapshot, onClose }: SettingsPageProps) {
  const { t, locale, setLocale } = useTranslation()
  const [drafts, setDrafts] = useState<Record<string, boolean>>({})
  const reportDraft = useCallback((id: string, dirty: boolean) => {
    setDrafts(previous => previous[id] === dirty ? previous : { ...previous, [id]: dirty })
  }, [])
  const hasDrafts = Object.values(drafts).some(Boolean)
  const close = () => { if (!hasDrafts || window.confirm(t('shell.discardDraft'))) onClose() }
  useEffect(() => {
    if (!hasDrafts) return
    const leave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', leave)
    return () => window.removeEventListener('beforeunload', leave)
  }, [hasDrafts])
  const [activeSection, setActiveSection] = useState<typeof sections[number]['id']>('general')
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  const selected = sections.find(section => section.id === activeSection)!
  return <DraftStateContext.Provider value={reportDraft}><dialog id="application-settings" ref={dialog} className={styles.page} aria-labelledby="settings-page-title" onCancel={event => { event.preventDefault(); close() }}>
    <header className={styles.header}>
      <button type="button" className={styles.back} autoFocus onClick={close}><span className={styles.backIcon}><Icon name="chevronRight" /></span>{t('settings.back')}</button>
      <h1 id="settings-page-title">{t('settings.title')}</h1>
    </header>
    <div className={styles.layout}>
      <nav className={styles.navigation} aria-label={t('settings.categories')}>
        {sections.map(section => <button key={section.id} type="button" className={styles.navItem} aria-current={activeSection === section.id ? 'page' : undefined} onClick={() => setActiveSection(section.id)}><Icon name={section.icon} />{t(section.key)}</button>)}
      </nav>
      <main className={styles.content}>
        <h2>{t(selected.key)}</h2>
        <div className={styles.pane} hidden={activeSection !== 'general'}>
          <section className={styles.preferences}>
            <div className={styles.preference}>
              <h3 id="settings-theme-title">{t('settings.theme')}</h3>
              <div className={styles.options} role="group" aria-labelledby="settings-theme-title">
                {(['light', 'dark'] as const).map(value => <button key={value} type="button" aria-pressed={theme === value} onClick={() => { if (theme !== value) toggleTheme() }}><Icon name={value === 'light' ? 'sun' : 'moon'} />{t(`action.${value}`)}</button>)}
              </div>
            </div>
            <div className={styles.preference}>
              <h3 id="settings-language-title">{t('settings.language')}</h3>
              <div className={styles.options} role="group" aria-labelledby="settings-language-title">
                {(['zh-CN', 'en'] as const).map(value => <button key={value} type="button" aria-pressed={locale === value} onClick={() => setLocale(value)}>{t(`locale.${value}`)}</button>)}
              </div>
            </div>
          </section>
        </div>
        <div className={styles.pane} hidden={activeSection !== 'production'}><NetworkConfigurationEditor embedded onClose={onClose} takeSnapshot={takeSnapshot} /></div>
        <div className={styles.pane} hidden={activeSection !== 'resources'}><ResourceRegistryPanel embedded onClose={onClose} /></div>
        <div className={styles.pane} hidden={activeSection !== 'units'}><TpsSettingsPanel embedded onClose={onClose} /></div>
      </main>
    </div>
  </dialog></DraftStateContext.Provider>
}
