import { useMemo, useRef, useState } from 'react'
import { useTranslation } from '@/common/i18n'
import { Icon } from '@/common/components/Icon'
import { parseNormalizedKey } from '@/common/utils/resourceId'
import { formatSimpleRate } from '@/common/utils/rateFormat'
import { defaultResourceUnit } from '@/common/units/defaults'
import { UnitSystem } from '@/common/units/UnitSystem'
import { useCanvasStore } from '../canvas.store'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { buildUnitSuffix } from '@/features/resource-registry/registry.units'
import { deliveryResources, deliverySummary, installationSummary } from '../resultSummary'
import styles from './CoreResultSummary.module.css'

/** Always-visible production evidence, independent of detailed result-panel visibility.
 * @returns A fixed-capacity strip with bounded, keyboard-accessible detail popovers.
 */
export function CoreResultSummary() {
  const { t } = useTranslation()
  const nodes = useCanvasStore(state => state.nodes)
  const configuration = useCanvasStore(state => state.networkConfiguration)
  const result = useCanvasStore(state => state.lastCalculationResult)
  const status = useCanvasStore(state => state.calculationStatus)
  const recipes = useRecipeStore(state => state.recipes)
  const environment = useSettingsStore(state => state.units)
  const entries = useGlobalResourceTable(state => state.entries)
  const currentTargets = useMemo(() => deliveryResources(nodes, recipes, configuration), [nodes, recipes, configuration])
  // Keep the unit environment and labels with the numerical evidence: editing units or
  // deleting a machine must not reinterpret the retained previous result.
  const [snapshot, setSnapshot] = useState({ result, targets: currentTargets, recipes, environment, entries })
  if (snapshot.result !== result) setSnapshot({ result, targets: currentTargets, recipes, environment, entries })
  const evidence = snapshot.result === result ? snapshot : { result, targets: currentTargets, recipes, environment, entries }
  const units = new UnitSystem(result ? evidence.environment : environment)
  const targets = deliverySummary(result, result ? evidence.targets : currentTargets)
  const installation = installationSummary(result, evidence.recipes)
  const retained = result !== null && status !== 'success' && status !== 'feasible'
  const labels = { idle: t('shell.idle'), running: t('shell.running'), success: t('shell.success'), feasible: t('shell.feasible'), stale: t('shell.stale'), error: t('shell.error') }
  const [expanded, setExpanded] = useState<'delivery' | 'machines' | null>(null)
  const deliveryButton = useRef<HTMLButtonElement>(null)
  const machinesButton = useRef<HTMLButtonElement>(null)
  const closeDetails = () => {
    const trigger = expanded === 'delivery' ? deliveryButton : machinesButton
    setExpanded(null)
    trigger.current?.focus({ preventScroll: true })
  }
  const resourceRow = (target: typeof targets[number], detailed = false) => {
    const { category, id } = parseNormalizedKey(target.resourceId)
    const name = (result ? evidence.entries : entries)[target.resourceId]?.displayName || id
    const expression = target.unit ?? defaultResourceUnit(category, id)
    const amount = target.amount
    const value = amount === undefined ? '—' : `${formatSimpleRate(units.fromRate(amount, expression, 'rate_per_sec'))} ${buildUnitSuffix(expression, 'rate_per_sec', units)}`
    return <div className={styles.resource} key={target.resourceId} title={`${name} · ${target.resourceId}: ${value}`}><span>{detailed ? `${name} · ${target.resourceId}` : name}</span><strong>{value}</strong></div>
  }
  return <aside className={styles.summary} aria-label={t('summary.label')} onKeyDown={event => {
    if (event.key === 'Escape' && expanded) { event.stopPropagation(); closeDetails() }
  }}>
    <div className={styles.delivery}>
      <span className={styles.label}>{t('summary.delivery')}</span>
      <div className={styles.preview}>{currentTargets.length && targets.length ? targets.slice(0, 2).map(target => resourceRow(target)) : <span className={styles.empty}>{t('summary.noTargets')}</span>}</div>
      {targets.length > 0 && <button ref={deliveryButton} className={styles.expand} aria-expanded={expanded === 'delivery'} onClick={() => setExpanded(expanded === 'delivery' ? null : 'delivery')}>{t('summary.more', { count: targets.length })}<Icon name="chevronDown" size={12} /></button>}
    </div>
    <div className={styles.machines}><span className={styles.label}>{t('summary.machines')}</span><strong>{installation.total === null ? '—' : formatSimpleRate(installation.total)}</strong>
      {installation.types.length > 0 && <button ref={machinesButton} className={styles.expand} aria-expanded={expanded === 'machines'} onClick={() => setExpanded(expanded === 'machines' ? null : 'machines')}>{t('summary.types', { count: installation.types.length })}<Icon name="chevronDown" size={12} /></button>}
    </div>
    <div className={styles.status} role="status"><span title={labels[status]}>{labels[status]}</span>{retained && <span className={styles.retained} title={t('summary.retained')}>{t('summary.retained')}</span>}</div>
    {expanded && <section className={styles.details} aria-label={t(expanded === 'delivery' ? 'summary.delivery' : 'summary.machines')}>
      <header><strong>{t(expanded === 'delivery' ? 'summary.delivery' : 'summary.machines')}</strong><button className={styles.expand} onClick={closeDetails} aria-label={t('summary.close')}><Icon name="close" size={14} /></button></header>
      {retained && <p className={styles.retained}>{t('summary.retained')}</p>}
      <div className={styles.rows}>{expanded === 'delivery' ? targets.map(target => resourceRow(target, true)) : installation.types.map(type => <div className={styles.resource} key={type.name}><span>{type.name}</span><strong>{formatSimpleRate(type.count)}</strong></div>)}</div>
    </section>}
  </aside>
}
