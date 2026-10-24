import type { CSSProperties, ReactNode } from 'react'
import type { NodeDisplayMode } from '@/common/types/nodeDisplay'
import { Icon } from '@/common/components/Icon'
import styles from './NodeResource.module.css'

/** Render a resource category once, without changing the geometry for translated labels.
 * @param props - Category label and optional theme color.
 * @param props.as - List-item or ordinary grouping context.
 * @param props.label - Localized category name.
 * @param props.color - Resolved resource color.
 * @param props.separated - Add space before a subsequent category.
 * @param props.className - Additional category-specific styling.
 * @returns A fixed-height category separator.
 */
export function NodeCategoryHeading({ as: Tag = 'li', label, color, separated = false, className }: { as?: 'li' | 'div'; label: string; color?: string; separated?: boolean; className?: string }) {
  return <Tag className={`${styles.category}${separated ? ` ${styles.categorySeparated}` : ''}${className ? ` ${className}` : ''}`} style={color ? { '--port-color': color } as CSSProperties : undefined} title={label}>{label}</Tag>
}

/** Share name truncation and keyboard access while keeping supply/status markers beside it.
 * @param props - Resource identity and its independently meaningful status markers.
 * @param props.name - Human-readable resource name.
 * @param props.title - Full name and optional identity; defaults to the name.
 * @param props.children - Compact inventory, supply or diagnostic markers.
 * @returns One identity cell that reserves marker space before truncating the name.
 */
export function NodeResourceIdentity({ name, title = name, children }: { name: string; title?: string; children?: ReactNode }) {
  return <div className={styles.identity}><span className={styles.name} tabIndex={0} title={title}>{name}</span>{children}</div>
}

/** Display already-formatted quantities without parsing labels or changing their unit semantics.
 * @param props - Formatted value and independent unit suffix.
 * @param props.value - Numeric display value or an explicit unknown marker.
 * @param props.unit - Display-unit suffix, including its time basis where applicable.
 * @param props.title - Full accessible value and optional evidence status.
 * @param props.className - Additional semantic styling.
 * @param props.outcome - Evidence-backed outcome; unverified remains neutral.
 * @param props.emphasis - Primary endpoint result or normal resource throughput.
 * @returns Aligned value and muted unit with accessible overflow details.
 */
export function NodeQuantity({ value, unit, title, className, outcome, emphasis = 'normal' }: { value: string; unit?: string; title?: string; className?: string; outcome?: 'met' | 'unmet' | 'unverified'; emphasis?: 'normal' | 'primary' }) {
  const description = title ?? `${value}${unit ? ` ${unit}` : ''}`
  return <span className={`${styles.quantity} ${styles[emphasis]}${className ? ` ${className}` : ''}`} data-outcome={outcome} title={description} aria-label={description} tabIndex={0}>{outcome === 'unmet' && <Icon name="warning" size={13} />}<strong>{value}</strong>{unit && <span className={styles.unit}>{unit}</span>}</span>
}

/** Lay out shared resource identity, quantities and editing conditions without owning their data.
 * @param props - Resource presentation slots and node-specific fixed geometry.
 * @param props.as - List-item or ordinary resource-row context.
 * @param props.mode - Controls only throughput and detail visibility.
 * @param props.identity - Resource name and compact status markers.
 * @param props.actual - Quantity presentation, optionally including an inline condition editor.
 * @param props.actualInCompact - Retain endpoint outcomes in the compact view.
 * @param props.policy - Mode-aware policy or non-flow semantics.
 * @param props.details - Additional information shown only in detailed mode.
 * @param props.feedback - Validation feedback replacing the auxiliary content in every mode.
 * @param props.auxiliaryAction - Fixed-width action for inspecting complete resource details.
 * @param props.detailsTitle - Accessible full text for an abbreviated detail.
 * @param props.port - Existing wired handle or global port; kept as a direct child.
 * @param props.className - Node-specific geometry or semantic styling.
 * @param props.style - Resolved resource color and geometry variables.
 * @param props.title - Optional full row context.
 * @returns Fixed two-line group; mode changes only content density, never port geometry.
 */
export function NodeResourceRow({ as: Tag = 'li', mode, identity, actual, actualInCompact = false, policy, details, feedback, auxiliaryAction, detailsTitle, port, className, style, title }: { as?: 'li' | 'div'; mode: NodeDisplayMode; identity: ReactNode; actual?: ReactNode; actualInCompact?: boolean; policy?: ReactNode; details?: ReactNode; feedback?: ReactNode; auxiliaryAction?: ReactNode; detailsTitle?: string; port?: ReactNode; className?: string; style?: CSSProperties; title?: string }) {
  const showActual = actual != null && (mode !== 'compact' || actualInCompact)
  return <Tag className={`${styles.row}${className ? ` ${className}` : ''}`} data-mode={mode} data-actual={showActual || undefined} style={style} title={title}>
    {port}
    <div className={styles.identityCell}>{identity}</div>
    {showActual && <div className={styles.actual}>{actual}</div>}
    <div className={styles.auxiliary}>
      {feedback ? <div className={styles.feedback}>{feedback}</div> : <>
        <div className={styles.auxiliaryContent}>
          {mode === 'detailed' && details != null && <div className={styles.details} tabIndex={detailsTitle ? 0 : undefined} title={detailsTitle}>{details}</div>}
          <div className={styles.policy}>{policy}</div>
        </div>
        {auxiliaryAction && <div className={styles.auxiliaryAction}>{auxiliaryAction}</div>}
      </>}
    </div>
  </Tag>
}
