import { useTranslation } from '@/common/i18n'
import { Icon } from '@/common/components/Icon'
import { useMemo } from 'react'
import { ResourceDefinitionRow, type ResourceDefinitionRowProps } from './ResourceDefinitionRow'
import type { ColumnDef } from './ResourceDefinitionRow.config'
import { formatOpExRate } from '@/common/utils/format'
import styles from './ResourceDefinitionRow.module.css'


/** Props for the `ResourceDefinitionList` component. */
type ResourceDefinitionListProps<T extends Record<string, unknown> & { _uid?: string }> = {
  items: T[]
  columns: ColumnDef[]

  emptyMessage?: string
  addLabel?: string

  onUpdateItem: (index: number, patch: Partial<T>) => void
  onAddItem: () => void
  onRemoveItem: (index: number) => void
  onToggleRoutingItem?: (index: number) => void
  onIoTToggleItem?: (index: number) => void

  rateMap?: Map<string, number>
  suggestions?: string[]
  categoryOptions?: { id: string; displayName: string }[]
  probabilityLabel?: string

  getRoutingLocked?: (index: number) => boolean
  getAmountLocked?: (index: number) => boolean
  getCanDelete?: (index: number) => boolean
  getRowLabel?: (index: number) => string
  getUnitSuffix?: (index: number) => string
  getCategoryLocked?: (index: number) => boolean
  getIdLocked?: (index: number) => boolean
  getTimeBaseLocked?: (index: number) => boolean
  getProbabilityLocked?: (index: number) => boolean
  getIoToggleLocked?: (index: number) => boolean
}

/**
 * Format a numeric rate value into a human-readable string.
 * @param value - The rate value, or undefined.
 * @returns A formatted rate string.
 */
function formatRate(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0.00'
  return formatOpExRate(value)
}

/**
 * Renders a table-like list of resource definition rows with configurable columns,
 * add/remove behaviour, routing toggles and category options.
 * @param root0
 * @param root0.items
 * @param root0.columns
 * @param root0.emptyMessage
 * @param root0.addLabel
 * @param root0.onUpdateItem
 * @param root0.onAddItem
 * @param root0.onRemoveItem
 * @param root0.onToggleRoutingItem
 * @param root0.onIoTToggleItem
 * @param root0.rateMap
 * @param root0.suggestions
 * @param root0.categoryOptions
 * @param root0.probabilityLabel
 * @param root0.getRoutingLocked
 * @param root0.getAmountLocked
 * @param root0.getCanDelete
 * @param root0.getRowLabel
 * @param root0.getUnitSuffix
 * @param root0.getCategoryLocked
 * @param root0.getIdLocked
 * @param root0.getTimeBaseLocked
 * @param root0.getProbabilityLocked
 * @param root0.getIoToggleLocked
 * @returns Rendered JSX for the resource definition list.
 */
export function ResourceDefinitionList<T extends Record<string, unknown> & { _uid?: string }>({
  items,
  columns,
  emptyMessage,
  addLabel,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
  onToggleRoutingItem,
  onIoTToggleItem,
  rateMap,
  suggestions,
  categoryOptions,
  probabilityLabel,
  getRoutingLocked,
  getAmountLocked,
  getCanDelete,
  getRowLabel,
  getUnitSuffix,
  getCategoryLocked,
  getIdLocked,
  getTimeBaseLocked,
  getProbabilityLocked,
  getIoToggleLocked,
}: ResourceDefinitionListProps<T>) {
  const { t } = useTranslation()
  const gridTemplate = useMemo(
    () => columns.map((c) => c.width ?? 'auto').join(' '),
    [columns],
  )

  return (
    <div className={styles.tableViewport}>
      <div
        className={`${styles.row} ${styles['row--resource-route-header']}`}
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {columns.map((col) => (
          <span className={styles['row-header-item']} key={col.id} title={col.headerKey ? t(col.headerKey) : undefined}>
            {col.headerKey ? t(col.headerKey) : ''}
          </span>
        ))}
      </div>

      {items.length === 0 && <p className={styles.empty}>{emptyMessage ?? t('editor.emptyResources')}</p>}

      {items.map((item, index) => {
        const rowProps: ResourceDefinitionRowProps = {
          item: item as ResourceDefinitionRowProps['item'],
          index,
          columns,
          onUpdate: (i, patch) => onUpdateItem(i, patch as Partial<T>),
          onRemove: onRemoveItem,
          onToggleRouting: onToggleRoutingItem,
          onIoTToggle: onIoTToggleItem,
          rateText: rateMap
            ? formatRate(rateMap.get(String(item.portId ?? '')))
            : undefined,
          suggestions,
          categoryOptions,
          probabilityLabel,
          routingLocked: getRoutingLocked?.(index),
          amountLocked: getAmountLocked?.(index),
          canDelete: getCanDelete?.(index) ?? true,
          rowLabel: getRowLabel?.(index),
          unitSuffix: getUnitSuffix?.(index),
          categoryLocked: getCategoryLocked?.(index),
          idLocked: getIdLocked?.(index),
          timeBaseLocked: getTimeBaseLocked?.(index),
          probabilityLocked: getProbabilityLocked?.(index),
          ioToggleLocked: getIoToggleLocked?.(index),
        }

        return <ResourceDefinitionRow key={item._uid ?? `row-${index}`} {...rowProps} />
      })}

      <button
        className={`${styles.btn} ${styles['btn--ghost']}`}
        onClick={onAddItem}
        style={{ marginTop: items.length > 0 ? 4 : 0 }}
        type="button"
      >
        <Icon name="plus" size={14} /> {addLabel ?? t('editor.add')}
      </button>
    </div>
  )
}
