import { categoryDisplayName } from '@/common/i18n/resourceLabels'
import { useTranslation } from '@/common/i18n'
import { translateDiagnostic } from '@/common/i18n/translateDiagnostic'
import { Icon } from '@/common/components/Icon'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import type { CSSProperties } from 'react'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { resolveCategoryDef } from '@/features/recipe/recipe.endpointNorm'
import { formatSimpleRate } from '@/common/utils/rateFormat'
import { normalizeResourceKey, parseNormalizedKey, isVirtualGlobal } from '@/common/utils/resourceId'
import { IntermediateProductsPanel } from './IntermediateProductsPanel'
import styles from './SystemHUD.module.css'

/** Separate gross boundary flows and installation quantities supplied by the result owner. */
type SystemHUDProps = {
  systemInputs: Record<string, number>
  systemOutputs: Record<string, number>
  globalInputIds: string[]
  globalOutputIds: string[]
  capexList: Record<string, number>
}

/** Render a resource quantity without mixing rate and installation semantics.
 * @param props - Resource identity, quantity and routing indicator.
 * @param props.item - Qualified resource identity.
 * @param props.value - Already calculated rate or occupancy quantity.
 * @param props.isGlobal - Whether this boundary uses a global bus.
 * @returns A labelled quantity row.
 */
function HUDResourceRow({ item, value, isGlobal }: { item: string; value: number; isGlobal: boolean }) {
  const categories = useGlobalResourceTable(state => state.categories)
  const overrides = useGlobalResourceTable(state => state.overrides)
  const { category, id } = parseNormalizedKey(item)
  const definition = resolveCategoryDef(category, categories, overrides)
  return <div className={`${styles['system-hud__row']}${isGlobal ? ` ${styles['system-hud__row--global']}` : ''}`}>
    <span className={styles['system-hud__item']}>
      <span className={styles['system-hud__badge']} style={{ '--resource-color': definition.themeColor } as CSSProperties}>{categoryDisplayName(category, definition.displayName)}</span>
      <span className={styles['system-hud__name']} title={id}>{id}</span>
    </span>
    <span className={styles['system-hud__value']}>{formatSimpleRate(value)}</span>
  </div>
}

/** Group wired and global boundaries without rendering empty subpanels.
 * @param props - Boundary quantities and routing identities.
 * @param props.values - Gross rates keyed by resource identity.
 * @param props.globalIds - Resources explicitly routed through a global pool.
 * @returns Present boundary rows or a compact empty explanation.
 */
function BoundaryRows({ values, globalIds }: { values: Record<string, number>; globalIds: string[] }) {
  const { t } = useTranslation()
  const globals = new Set(globalIds)
  const entries = Object.entries(values).filter(([item]) => !isVirtualGlobal(item))
  const wired = entries.filter(([item]) => !globals.has(normalizeResourceKey(item)))
  const global = entries.filter(([item]) => globals.has(normalizeResourceKey(item)))
  if (!entries.length) return <p className={styles['system-hud__empty']}>{t('shell.noExchange')}</p>
  return <div className={styles['system-hud__list']}>
    {wired.map(([item, value]) => <HUDResourceRow key={item} item={item} value={value} isGlobal={false} />)}
    {global.length > 0 && <><span className={styles['system-hud__subhead']}>{t('shell.globalBus')}</span>{global.map(([item, value]) => <HUDResourceRow key={item} item={item} value={value} isGlobal />)}</>}
  </div>
}

/** Keep result details in one positioned, initially compact entry point.
 * @param props - Gross supply/delivery flows, routing and installation quantities.
 * @returns A compact status and expandable result inspector which never changes canvas layout.
 */
export function SystemHUD(props: SystemHUDProps) {
  const { t } = useTranslation()
  const { systemInputs, systemOutputs, globalInputIds, globalOutputIds, capexList } = props
  const status = useCanvasStore(state => state.calculationStatus)
  const hasResult = useCanvasStore(state => state.lastCalculationResult !== null)
  const message = useCanvasStore(state => state.calculationMessage)
  const nets = useCanvasStore(state => state.netSummaries)
  const startup = useCanvasStore(state => state.startup)
  const spills = useCanvasStore(state => state.systemSpills)
  const labels = { idle: t('shell.idle'), running: hasResult ? t('shell.runningRetained') : t('shell.running'), success: t('shell.success'), feasible: t('shell.feasible'), stale: t('shell.stale'), error: hasResult ? t('shell.errorRetained') : t('shell.error') }
  return <aside className={styles['system-hud']} aria-label={t('shell.resultsLabel')}>
    <details className={styles.resultInspector}>
      <summary className={styles.resultEntry}>
        <span>{t('shell.results')}</span>
        <span className={styles.status} role="status">{labels[status]}</span><span className={styles.entryIcon}><Icon name="chevronUp" size={15} /></span>
      </summary>
      <div className={styles.resultBody}>
        {message && <p className={styles.message}>{translateDiagnostic(message)}</p>}
        {!hasResult ? <p className={styles['system-hud__empty']}>{status === 'idle' ? t('shell.idleHint') : status === 'stale' ? t('shell.staleHint') : status === 'running' ? t('shell.runningHint') : t('shell.errorHint')}</p> : <>
          <details className={styles.resultSection}><summary>{t('shell.supply')} <span>{Object.keys(systemInputs).length} {t('shell.items')}</span><span className={styles.expandIcon}><Icon name="chevronRight" size={14} /></span></summary><p className={styles.hint}>{t('shell.units')}</p><BoundaryRows values={systemInputs} globalIds={globalInputIds} /></details>
          <details className={styles.resultSection}><summary>{t('shell.delivery')} <span>{Object.keys(systemOutputs).length} {t('shell.items')}</span><span className={styles.expandIcon}><Icon name="chevronRight" size={14} /></span></summary><p className={styles.hint}>{t('shell.units')}</p><BoundaryRows values={systemOutputs} globalIds={globalOutputIds} /></details>
          <details className={styles.resultSection}><summary>{t('shell.bom')} <span>{Object.keys(capexList).length} {t('shell.items')}</span><span className={styles.expandIcon}><Icon name="chevronRight" size={14} /></span></summary><div className={styles['system-hud__list']}>{Object.entries(capexList).map(([item, value]) => <HUDResourceRow key={item} item={item} value={value} isGlobal={false} />)}{!Object.keys(capexList).length && <p className={styles['system-hud__empty']}>{t('shell.noBom')}</p>}</div></details>
          <details className={styles.resultSection}><summary>{t('shell.spill')} <span>{Object.keys(spills).length} {t('shell.items')}</span><span className={styles.expandIcon}><Icon name="chevronRight" size={14} /></span></summary><p className={styles.hint}>{t('shell.spillHint')}</p><BoundaryRows values={spills} globalIds={[]} /></details>
          <details className={styles.resultSection}><summary>{t('shell.networks')} <span>{nets.length} {t('shell.count')}</span><span className={styles.expandIcon}><Icon name="chevronRight" size={14} /></span></summary>{nets.map((net, index) => <div className={styles.net} key={net.id}><strong>{t('shell.network')} {index + 1} · {net.resourceId}</strong><p>{t('shell.external')} {formatSimpleRate(net.source)} / {t('shell.delivered')} {formatSimpleRate(net.delivery)} / {t('shell.spill')} {formatSimpleRate(net.spill)}</p><details><summary>{t('shell.netIdentity')}<span className={styles.expandIcon}><Icon name="chevronRight" size={14} /></span></summary><code>{net.id}</code></details></div>)}</details>
          <details className={styles.resultSection}><summary>{t('shell.startup')} <span>{t('shell.pending')}</span><span className={styles.expandIcon}><Icon name="chevronRight" size={14} /></span></summary><p className={styles.hint}>{t('shell.startupHint')}</p>{startup ? <><p>{t('shell.catalysts')}{startup.catalysts.map(item => `${item.nodeId} · ${item.resourceId} × ${formatSimpleRate(item.amount)}`).join('；') || t('shell.notDeclared')}</p><p>{t('shell.cycles')}{startup.cycles.map(cycle => cycle.join(' → ')).join('；') || t('shell.noCycles')}</p>{startup.preheat.map(item => <p key={item.nodeId}>{item.nodeId}：{item.requirement}</p>)}</> : <p>{t('shell.noStartup')}</p>}</details>
          <details className={styles.resultSection}><summary>{t('shell.internal')}<span className={styles.expandIcon}><Icon name="chevronRight" size={14} /></span></summary><IntermediateProductsPanel systemInputs={systemInputs} systemOutputs={systemOutputs} /></details>
        </>}
      </div>
    </details>
  </aside>
}
