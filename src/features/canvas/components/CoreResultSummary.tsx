import { useMemo, useRef, useState } from 'react'
import { useTranslation } from '@/common/i18n'
import { translateDiagnostic } from '@/common/i18n/translateDiagnostic'
import { Icon } from '@/common/components/Icon'
import { formatSimpleRate } from '@/common/utils/rateFormat'
import { useCanvasStore } from '../canvas.store'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { deliverySummary, installationSummary } from '../resultSummary'
import { documentResultEvidence } from '../resultEvidence'
import { ResultResourceRow } from './ResultResourceRow'
import { SystemHUD } from './SystemHUD'
import styles from './CoreResultSummary.module.css'

/** Keep the core result visible while its independent detail panel is collapsed.
 * @param props - Detailed-result visibility controlled by the existing View menu.
 * @param props.showDetails - Whether the detailed panel may be shown.
 * @param props.onShowDetails - Restore menu visibility when explicitly opening details.
 * @returns One bounded result entry with snapshot-backed resource and machine lists.
 */
export function CoreResultSummary({ showDetails = true, onShowDetails }: { showDetails?: boolean; onShowDetails?: () => void }) {
  const { t } = useTranslation()
  const nodes = useCanvasStore(state => state.nodes)
  const configuration = useCanvasStore(state => state.networkConfiguration)
  const result = useCanvasStore(state => state.lastCalculationResult)
  const acceptedEvidence = useCanvasStore(state => state.resultEvidence)
  const status = useCanvasStore(state => state.calculationStatus)
  const message = useCanvasStore(state => state.calculationMessage)
  const recipes = useRecipeStore(state => state.recipes)
  const environment = useSettingsStore(state => state.units)
  const entries = useGlobalResourceTable(state => state.entries)
  const evidence = useMemo(() => acceptedEvidence ?? documentResultEvidence(nodes, recipes, configuration, environment, entries), [acceptedEvidence, nodes, recipes, configuration, environment, entries])
  const targets = deliverySummary(result, evidence.targets)
  const installation = installationSummary(result, evidence.recipes)
  const retained = result !== null && status !== 'success' && status !== 'feasible'
  const labels = { idle: t('shell.idle'), running: t('shell.running'), success: t('shell.success'), feasible: t('shell.feasible'), stale: t('shell.stale'), error: t('shell.error') }
  const [expanded, setExpanded] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const open = expanded && showDetails
  const close = () => { setExpanded(false); trigger.current?.focus({ preventScroll: true }) }
  return <aside className={styles.summary} aria-label={t('summary.label')} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.stopPropagation(); close() }
  }}>
    <header className={styles.header}>
      <span className={styles.machineCount}>{t('summary.machines')} <strong>{installation.total === null ? '—' : formatSimpleRate(installation.total)}</strong></span>
      <span className={styles.status} role="status" title={retained ? `${labels[status]} · ${t('summary.retained')}` : labels[status]}>{labels[status]}{retained && <span className={styles.retained}>{t('summary.retained')}</span>}</span>
      <button ref={trigger} className={styles.expand} aria-label={t('summary.details')} title={t('summary.details')} aria-expanded={open} onClick={() => { if (open) close(); else { onShowDetails?.(); setExpanded(true) } }}><Icon name={open ? 'chevronDown' : 'chevronUp'} size={16} /></button>
    </header>
    <div className={styles.delivery}>
      <span className={styles.label}>{t('summary.delivery')}{targets.length > 2 ? ` · ${targets.length}` : ''}</span>
      <div className={styles.preview}>{targets.length ? targets.slice(0, 2).map(target => <ResultResourceRow key={target.resourceId} resourceId={target.resourceId} amount={target.amount} evidence={evidence} />) : <span className={styles.empty}>{t('summary.noTargets')}</span>}</div>
    </div>
    {open && <section className={styles.details} aria-label={t('summary.details')}>
      <header><strong>{t('summary.details')}</strong><button className={styles.expand} onClick={close} aria-label={t('summary.close')}><Icon name="close" size={15} /></button></header>
      <div className={styles.detailScroll}>
        {retained && <p className={styles.retained}>{t('summary.retained')}</p>}
        {message && <p className={styles.message}>{translateDiagnostic(message)}</p>}
        {result ? <SystemHUD result={result} evidence={evidence} /> : <p className={styles.empty}>{t(status === 'running' ? 'shell.runningHint' : status === 'error' ? 'shell.errorHint' : status === 'stale' ? 'shell.staleHint' : 'shell.idleHint')}</p>}
      </div>
    </section>}
  </aside>
}
