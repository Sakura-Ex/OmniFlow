import { useMemo } from 'react'
import { ResourceDefinitionRow, type ResourceDefinitionRowProps, type ColumnDef } from './ResourceDefinitionRow'

export { RECIPE_INPUT_COLUMNS, RECIPE_OUTPUT_COLUMNS, UTILITY_COLUMNS, ENDPOINT_COLUMNS } from './ResourceDefinitionRow'

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
  getAmountReadonly?: (index: number) => boolean
  getCanDelete?: (index: number) => boolean
  getRowLabel?: (index: number) => string
  getUnitSuffix?: (index: number) => string
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
  getAmountReadonly,
  getCanDelete,
  getRowLabel,
  getUnitSuffix,
}: ResourceDefinitionListProps<T>) {
  const gridTemplate = useMemo(
    () => columns.map((c) => c.width ?? 'auto').join(' '),
    [columns],
  )

  return (
    <div>
      <div
        className="recipe-editor__row recipe-editor__row--resource-route-header"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {columns.map((col) => (
          <span className="recipe-editor__row-header-item" key={col.id}>
            {col.header}
          </span>
        ))}
      </div>

      {items.length === 0 && <p className="recipe-editor__empty">{emptyMessage}</p>}

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
          amountReadonly: getAmountReadonly?.(index),
          canDelete: getCanDelete?.(index) ?? true,
          rowLabel: getRowLabel?.(index),
          unitSuffix: getUnitSuffix?.(index),
        }

        return <ResourceDefinitionRow key={item._uid ?? `row-${index}`} {...rowProps} />
      })}

      <button
        className="recipe-editor__btn recipe-editor__btn--ghost"
        onClick={onAddItem}
        style={{ marginTop: items.length > 0 ? 4 : 0 }}
        type="button"
      >
        + {addLabel}
      </button>
    </div>
  )
}

import { formatOpExRate } from '../utils/formatters'

function formatRate(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0.00'
  return formatOpExRate(value)
}
