import { useMemo } from 'react'
import { ResourceDefinitionRow, type ResourceDefinitionRowProps } from './ResourceDefinitionRow'
import type { ColumnDef } from './ResourceDefinitionRow.config'
import { formatOpExRate } from '@/common/utils/format'
import styles from './ResourceDefinitionRow.module.css'


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

function formatRate(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0.00'
  return formatOpExRate(value)
}

export function ResourceDefinitionList<T extends Record<string, unknown> & { _uid?: string }>({
  items,
  columns,
  emptyMessage = '暂无资源',
  addLabel = '添加',
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
  const gridTemplate = useMemo(
    () => columns.map((c) => c.width ?? 'auto').join(' '),
    [columns],
  )

  return (
    <div>
      <div
        className={`${styles.row} ${styles['row--resource-route-header']}`}
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {columns.map((col) => (
          <span className={styles['row-header-item']} key={col.id}>
            {col.header}
          </span>
        ))}
      </div>

      {items.length === 0 && <p className={styles.empty}>{emptyMessage}</p>}

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
            ? formatRate(rateMap.get(`${item.category ?? ''}:${item.id ?? ''}`))
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
        + {addLabel}
      </button>
    </div>
  )
}
