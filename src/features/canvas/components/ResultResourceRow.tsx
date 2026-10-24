import { useTranslation } from '@/common/i18n'
import { parseNormalizedKey } from '@/common/utils/resourceId'
import type { ResultEvidence } from '../resultEvidence'
import { resultQuantity } from '../resultSummary'
import styles from './SystemHUD.module.css'

/** Render one resource using the same result-owned naming and unit conversion everywhere.
 * @param props - Resource identity, canonical amount, captured metadata and quantity kind.
 * @param props.resourceId - Qualified resource identity.
 * @param props.amount - Canonical value; absent values remain unknown.
 * @param props.evidence - Accepted result metadata.
 * @param props.kind - Rate or material occupancy.
 * @returns A compact resource row with complete accessible identity and units.
 */
export function ResultResourceRow({ resourceId, amount, evidence, kind = 'flow' }: { resourceId: string; amount?: number; evidence: ResultEvidence; kind?: 'flow' | 'occupancy' }) {
  const { t } = useTranslation()
  const name = evidence.resources[resourceId]?.name || parseNormalizedKey(resourceId).id
  const quantity = resultQuantity(resourceId, amount, evidence, kind)
  const label = `${name} · ${resourceId}${evidence.resources[resourceId]?.global ? ` · ${t('shell.globalBus')}` : ''}`
  return <div className={styles.resourceRow}>
    <span className={styles.resourceName} title={label}>{name}</span>
    <span className={styles.quantity} title={quantity.unavailable ? t('summary.unknownUnit') : `${quantity.value} ${quantity.unit}`}>{quantity.value} <small>{quantity.unit}</small></span>
  </div>
}
