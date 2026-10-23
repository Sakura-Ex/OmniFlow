import { translateDiagnostic } from '@/common/i18n/translateDiagnostic'
import { t, useTranslation } from '@/common/i18n'
import type { ActiveLimit, DiagnosticReport } from '../diagnostics'
import styles from './DiagnosticsPanel.module.css'

/** Display hypothetical deficits separately from runnable results.
 * @param props - Separate diagnostic evidence and location callback.
 * @param props.report - Hypothetical deficit explanation.
 * @param props.limits - Verified capacity and bound slacks.
 * @param props.onLocate - Locate implicated nodes and ports.
 * @returns Diagnostic and capacity controls, or null when no evidence exists.
 */
export function DiagnosticsPanel(props: {
  report?: DiagnosticReport
  limits?: ActiveLimit[]
  onLocate: (nodeIds: string[], portKeys: string[]) => void
}) {
  useTranslation()
  const { report, limits = [], onLocate } = props
  if (!report && !limits.length) return null
  const labels = { missing_supply: t('canvas.supply_shortfall'), missing_outlet: t('canvas.additional_outlet_required'), capacity_shortfall: t('canvas.capacity_shortfall') }
  return <details className={styles.panel} aria-label={t('canvas.constraint_diagnostics')} open={Boolean(report)}><summary>{report ? t('canvas.why_production_could_not_complete') : t('canvas.capacity_and_bottlenecks')}</summary>
    {report && <section>
      <strong>{t('canvas.infeasibility_diagnostics')}</strong>
      <p>{translateDiagnostic(report.message)}</p>
      {report.issues.map(issue => <button key={`${issue.rowId}:${issue.kind}`} onClick={() => onLocate(issue.nodeIds, issue.portKeys)}>
        {labels[issue.kind]}：{issue.amount.toPrecision(6)}{t('canvas.standard_resource_unitss')} {issue.nodeIds.join('、')}
      </button>)}
      <details><summary>{t('canvas.diagnostic_assumptions')}</summary>{report.assumptions.map(item => <p key={item}>{translateDiagnostic(item)}</p>)}</details>
    </section>}
    {limits.length > 0 && <section>
      <strong>{t('canvas.capacity_and_limits')}</strong>
      <p>{t('canvas.at_capacity_means_a_constraint_is_reached')}</p>
      {limits.map(limit => <button key={limit.id} onClick={() => onLocate(limit.nodeIds, limit.portKeys)}>
        {limit.nodeIds.join('、')}：{limit.atLimit ? t('canvas.at_capacity') : t('canvas.slack', { p0: limit.slack.toPrecision(6) })}
      </button>)}
    </section>}
  </details>
}
