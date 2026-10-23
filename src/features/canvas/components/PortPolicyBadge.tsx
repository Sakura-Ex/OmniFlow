import { t, useTranslation } from '@/common/i18n'
import type { NetworkPortConfiguration } from '@/common/schemas/network.schema'
import styles from './PortPolicyBadge.module.css'

/** Describe explicit policy independently of node density and solver results.
 * @param policy - Authoritative port policy.
 * @param formatAmount - Converts canonical flow quantities to the port's display units.
 * @param formatQuantity - Converts canonical capacity or state quantities without a time divisor.
 * @returns A compact label, or no label for an ordinary unconfigured flow.
 */
function portPolicyLabel(policy: NetworkPortConfiguration | undefined, formatAmount: (amount: number) => string, formatQuantity: (amount: number) => string): string {
  if (!policy) return ''
  const semantics = policy.semantics
  if (semantics.kind === 'capacity') return t('recipeDisplay.capacity', { value: formatQuantity(semantics.available) })
  if (semantics.kind === 'state') return t('recipeDisplay.state', { value: formatQuantity(semantics.actual) })
  const boundary = policy.boundary
  if (!boundary) return ''
  if (boundary.kind === 'forbid_spill') return t('recipeDisplay.closed')
  if (boundary.kind === 'delivery') {
    const label = t(boundary.mode === 'exact' ? 'canvas.fixed_output_exact' : boundary.mode === 'at_least' ? 'canvas.demand_minimum' : boundary.mode === 'maximize' ? 'canvas.maximize_output' : 'canvas.receive_surplus')
    return boundary.capacity === null ? label : `${label} · ${t('recipeDisplay.capacity', { value: formatAmount(boundary.capacity) })}`
  }
  return t(boundary.kind === 'spill' ? 'recipeDisplay.spill' : 'recipeDisplay.supply', { value: boundary.capacity === null ? '∞' : formatAmount(boundary.capacity) })
}

/** Keep nondefault boundary and semantic identity visible in every display mode.
 * @param props - Policy and display-unit formatter.
 * @param props.policy - Explicit policy for this independent port.
 * @param props.formatAmount - Canonical flow to display quantity formatter.
 * @param props.formatQuantity - Canonical capacity or state display formatter.
 * @returns Keyboard-readable, fixed-height policy badge.
 */
export function PortPolicyBadge({ policy, formatAmount, formatQuantity = String }: { policy?: NetworkPortConfiguration; formatAmount: (amount: number) => string; formatQuantity?: (amount: number) => string }) {
  useTranslation()
  const label = portPolicyLabel(policy, formatAmount, formatQuantity)
  return label ? <span className={`${styles.badge} nodrag nopan`} tabIndex={0} title={label} aria-label={label}>{label}</span> : null
}
