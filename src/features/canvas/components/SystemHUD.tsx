import { useTranslation } from '@/common/i18n'
import { Icon } from '@/common/components/Icon'
import { formatSimpleRate } from '@/common/utils/rateFormat'
import { parseNormalizedKey } from '@/common/utils/resourceId'
import type { CalculateResponse } from '@/common/types/api'
import type { ResultEvidence } from '../resultEvidence'
import { internalResultResources, resultQuantity, startupCanonicalAmount } from '../resultSummary'
import { ResultResourceRow } from './ResultResourceRow'
import styles from './SystemHUD.module.css'

/** Keep each result category expandable without creating a second floating result entry.
 * @param props - Verified result and its immutable display evidence.
 * @param props.result - Accepted values; never the current edited model.
 * @param props.evidence - Labels and units captured with the result.
 * @returns Detailed supply, delivery, disposal, installation and network evidence.
 */
export function SystemHUD({ result, evidence }: { result: CalculateResponse; evidence: ResultEvidence }) {
  const { t } = useTranslation()
  const internal = internalResultResources(result)
  const machines = Object.entries(result.node_results ?? {}).filter(([, node]) => node.planned_installed !== undefined || node.operating_equivalent !== undefined)
  const resources = (values: Record<string, number> = {}, kind: 'flow' | 'occupancy' = 'flow') => <div className={styles.rows}>
    {Object.entries(values).sort(([a], [b]) => a.localeCompare(b)).map(([resourceId, amount]) => <ResultResourceRow key={resourceId} resourceId={resourceId} amount={amount} evidence={evidence} kind={kind} />)}
    {!Object.keys(values).length && <p className={styles.empty}>{t(kind === 'occupancy' ? 'shell.noBom' : 'shell.noExchange')}</p>}
  </div>
  const number = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? formatSimpleRate(value) : '—'
  return <div className={styles.resultBody}>
    <details className={styles.section} open><summary>{t('shell.delivery')}<Icon name="chevronRight" size={14} /></summary>{resources(result.system_outputs)}</details>
    <details className={styles.section} open><summary>{t('summary.machines')}<Icon name="chevronRight" size={14} /></summary>
      {!machines.length ? <p className={styles.empty}>{t('summary.noMachines')}</p> : <div className={styles.machineList}>{machines.map(([id, node]) => <section className={styles.machine} key={id}>
        <strong title={id}>{evidence.recipes[id]?.machine_name ?? id}<small>{evidence.recipes[id]?.system}</small></strong>
        <dl><div><dt>{t('summary.machines')}</dt><dd>{number(node.planned_installed)}</dd></div><div><dt>{t('summary.operation')}</dt><dd>{number(node.operating_equivalent)}</dd></div><div><dt>{t('canvas.existing_equipment')}</dt><dd>{number(node.existing_installed)}</dd></div><div><dt>{t('canvas.additional_equipment')}</dt><dd>{number(node.additional_installed)}</dd></div></dl>
      </section>)}</div>}
    </details>
    <details className={styles.section}><summary>{t('shell.supply')}<Icon name="chevronRight" size={14} /></summary>{resources(result.system_inputs)}</details>
    <details className={styles.section}><summary>{t('shell.spill')}<Icon name="chevronRight" size={14} /></summary>{resources(result.system_spills)}</details>
    <details className={styles.section}><summary>{t('shell.bom')}<Icon name="chevronRight" size={14} /></summary>{resources(result.bom, 'occupancy')}</details>
    <details className={styles.section}><summary>{t('shell.networks')}<Icon name="chevronRight" size={14} /></summary>{(result.net_summaries ?? []).map((net, index) => <section className={styles.net} key={net.id}>
      <strong>{t('shell.network')} {index + 1} · {evidence.resources[net.resourceId]?.name || parseNormalizedKey(net.resourceId).id}</strong>
      {(evidence.netKinds[net.id] ?? 'flow') === 'flow' ? <dl>{([['shell.external', net.source], ['shell.delivered', net.delivery], ['shell.spill', net.spill]] as const).map(([key, amount]) => { const quantity = resultQuantity(net.resourceId, amount, evidence); return <div key={key}><dt>{t(key)}</dt><dd>{quantity.value} {quantity.unit}</dd></div> })}</dl> : <p className={styles.hint}>{t(evidence.netKinds[net.id] === 'capacity' ? 'canvas.capacity_and_operating_state' : 'canvas.fixed_operating_state')}</p>}
      <details><summary>{t('shell.netIdentity')}</summary><code>{net.id}</code></details>
    </section>)}</details>
    <details className={styles.section}><summary>{t('shell.startup')} · {t('shell.pending')}<Icon name="chevronRight" size={14} /></summary><p className={styles.hint}>{t('shell.startupHint')}</p>{result.startup ? <>
      <p>{t('shell.catalysts')}</p>{result.startup.catalysts.length ? result.startup.catalysts.map((item, index) => <div key={`${item.nodeId}:${index}`}><small>{evidence.recipes[item.nodeId]?.machine_name ?? item.nodeId}</small><ResultResourceRow resourceId={item.resourceId} amount={startupCanonicalAmount(result, index, evidence)} evidence={evidence} kind="occupancy" /></div>) : <p>{t('shell.notDeclared')}</p>}
      <p>{t('shell.cycles')}{result.startup.cycles.map(cycle => cycle.map(id => evidence.recipes[id]?.machine_name ?? id).join(' → ')).join('；') || t('shell.noCycles')}</p>
      {result.startup.preheat.map(item => <p key={item.nodeId}>{evidence.recipes[item.nodeId]?.machine_name ?? item.nodeId}：{item.requirement}</p>)}
    </> : <p>{t('shell.noStartup')}</p>}</details>
    <details className={styles.section}><summary>{t('shell.internal')}<Icon name="chevronRight" size={14} /></summary>{internal.length ? <ul className={styles.internal}>{internal.map(id => <li key={id} title={id}>{evidence.resources[id]?.name || parseNormalizedKey(id).id}</li>)}</ul> : <p className={styles.empty}>{t('summary.noInternal')}</p>}</details>
  </div>
}
