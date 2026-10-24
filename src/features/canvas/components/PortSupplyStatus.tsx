import { Icon } from '@/common/components/Icon'
import { t, useTranslation } from '@/common/i18n'
import type { NetworkPortConfiguration } from '@/common/schemas/network.schema'
import styles from './PortSupplyStatus.module.css'

/** Present explicit flow supply independently of wired or global routing.
 * @param props - Port identity, policy and display-unit conversion.
 * @param props.name - Resource name used in the accessible status.
 * @param props.policy - Flow source configuration; other policies have no supply marker.
 * @param props.formatAmount - Formats a finite canonical supply cap with display units.
 * @returns A keyboard-readable status icon, or nothing when flow supply is not configured.
 */
export function PortSupplyStatus({ name, policy, formatAmount }: { name: string; policy?: NetworkPortConfiguration; formatAmount: (amount: number) => string }) {
  useTranslation()
  const boundary = policy?.boundary
  if (policy?.semantics.kind !== 'flow' || boundary?.kind !== 'source') return null
  const description = boundary.capacity === null
    ? t('canvas.sufficientSupplyStatus')
    : t('canvas.limitedSupplyStatus', { capacity: formatAmount(boundary.capacity) })
  return <span className={`${styles.status} nodrag nopan`} role="img" tabIndex={0} aria-label={`${name}: ${description}`} title={description}>
    <Icon name={boundary.capacity === null ? 'check' : 'boundary'} size={12} />
  </span>
}
