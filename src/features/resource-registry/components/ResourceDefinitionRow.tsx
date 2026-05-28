import { useState, useRef } from 'react'
import type { TimeBase } from '@/common/types/resource'
import type { ColumnDef } from './ResourceDefinitionRow.config'
import { TIME_BASE_OPTIONS } from './ResourceDefinitionRow.config'
import { parseResourceId } from '@/common/utils/resourceId'
import { useClickOutside } from '@/hooks/useClickOutside'
import styles from './ResourceDefinitionRow.module.css'

/**
 *
 */
type RowItem = {
  category?: string
  id?: string
  amount?: number
  time_base?: TimeBase
  routing_mode?: string
  routing_locked?: boolean
  consumable?: boolean
  probability?: number
  is_utility?: boolean
  is_utility_output?: boolean
  _uid?: string
  amount_mutable?: boolean
}

/** Props for the `ResourceDefinitionRow` component. */
export interface ResourceDefinitionRowProps {
  item: RowItem
  index: number
  columns: ColumnDef[]

  onUpdate: (index: number, patch: Record<string, unknown>) => void
  onRemove: (index: number) => void
  onToggleRouting?: (index: number) => void
  onIoTToggle?: (index: number) => void

  rateText?: string
  unitSuffix?: string
  suggestions?: string[]
  categoryOptions?: { id: string; displayName: string }[]
  probabilityLabel?: string
  routingLocked?: boolean
  amountLocked?: boolean
  canDelete?: boolean
  rowLabel?: string
  categoryLocked?: boolean
  idLocked?: boolean
  timeBaseLocked?: boolean
  probabilityLocked?: boolean
  ioToggleLocked?: boolean
}

/**
 * Renders a single row in a resource definition table.
 * Each column is rendered based on its `col.id`:
 *  - `id` / `amount` / `time_base` / `category` / `probability` – editable inputs or selects.
 *  - `routing` / `io_toggle` – toggle buttons.
 *  - `delete` – a remove button.
 *  - `preview_rate` / `label` / `spacer` – read-only display.
 *
 * @param root0
 * @param root0.item
 * @param root0.index
 * @param root0.columns
 * @param root0.onUpdate
 * @param root0.onRemove
 * @param root0.onToggleRouting
 * @param root0.onIoTToggle
 * @param root0.rateText
 * @param root0.unitSuffix
 * @param root0.suggestions
 * @param root0.categoryOptions
 * @param root0.routingLocked
 * @param root0.amountLocked
 * @param root0.canDelete
 * @param root0.rowLabel
 * @param root0.categoryLocked
 * @param root0.idLocked
 * @param root0.timeBaseLocked
 * @param root0.probabilityLocked
 * @param root0.ioToggleLocked
 * @returns Rendered JSX for the resource definition row.
 */
export function ResourceDefinitionRow({
  item,
  index,
  columns,
  onUpdate,
  onRemove,
  onToggleRouting,
  onIoTToggle,
  rateText,
  unitSuffix,
  suggestions,
  categoryOptions,
  routingLocked,
  amountLocked,
  canDelete,
  rowLabel,
  categoryLocked,
  idLocked,
  timeBaseLocked,
  probabilityLocked,
  ioToggleLocked,
}: ResourceDefinitionRowProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const idInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useClickOutside(containerRef, () => setShowSuggestions(false), showSuggestions)

  const filteredSuggestions = suggestions?.filter((s) =>
    s.toLowerCase().includes((item.id ?? '').toLowerCase()),
  ) ?? []

  const gridTemplate = columns.map((c) => c.width ?? 'auto').join(' ')

  return (
    <div className={`${styles.row} ${styles['row--resource-route']}`} style={{ gridTemplateColumns: gridTemplate }}>
      {columns.map((col) => {
        switch (col.id) {
          case 'id':
            return (
              <div key={col.id} ref={containerRef} style={{ position: 'relative', minWidth: 0 }}>
                <input
                  ref={idInputRef}
                  type="text"
                  placeholder="资源 ID"
                  value={item.id ?? ''}
                  disabled={idLocked}
                  style={{ width: '100%' }}
                  onFocus={() => setShowSuggestions(true)}
                  onChange={(e) => onUpdate(index, { id: e.target.value })}
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: 2,
                      minWidth: '100%',
                      width: 280,
                      backgroundColor: 'rgba(3, 8, 16, 1)',
                      border: '1px solid rgba(148, 163, 184, 0.3)',
                      borderRadius: 8,
                      maxHeight: 160,
                      overflowY: 'auto',
                      zIndex: 20,
                    }}
                  >
                    {filteredSuggestions.map((s) => (
                      <div
                        key={s}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          const parsed = parseResourceId(s)
                          const cat = parsed.category !== parsed.id ? parsed.category : ''
                          const name = parsed.id
                          onUpdate(index, { id: name, category: cat })
                          setShowSuggestions(false)
                        }}
                        style={{
                          padding: '6px 10px',
                          cursor: 'pointer',
                          fontSize: 12,
                          borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                        }}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )

          case 'amount':
            return (
              <div className={styles['input-wrap']} key={col.id}>
                <input
                  type="number"
                  min={0}
                  value={item.amount ?? 1}
                  disabled={amountLocked}
                  onChange={(e) => onUpdate(index, { amount: Number(e.target.value) })}
                />
                {unitSuffix && <span className={styles['input-suffix']}>{unitSuffix}</span>}
              </div>
            )

          case 'time_base':
            return (
              <select
                key={col.id}
                value={item.time_base ?? 'per_cycle'}
                disabled={timeBaseLocked}
                onChange={(e) => onUpdate(index, { time_base: e.target.value as TimeBase })}
              >
                {TIME_BASE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )

          case 'category':
            return (
              <select
                key={col.id}
                value={item.category ?? ''}
                disabled={categoryLocked}
                onChange={(e) => onUpdate(index, { category: e.target.value })}
              >
                {categoryOptions?.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.displayName}</option>
                )) ?? []}
              </select>
            )

          case 'probability':
            return (
              <div className={styles['input-wrap']} key={col.id}>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  disabled={probabilityLocked}
                  value={item.consumable === false ? 0 : (item.probability ?? 1)}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(1, Number(e.target.value) || 0))
                    onUpdate(index, {
                      consumable: v === 0 ? false : undefined,
                      probability: v,
                    })
                  }}
                />
              </div>
            )

          case 'routing':
            return (
              <button
                key={col.id}
                className={`${styles['route-btn']}${item.routing_mode === 'global' ? ' ' + styles['is-global'] : ''}`}
                onClick={() => onToggleRouting?.(index)}
                title={
                  routingLocked
                    ? '路由锁定，不可切换'
                    : item.routing_mode === 'global'
                      ? '当前：全局总线（点击切换到有线）'
                      : '当前：有线连接（点击切换到全局总线）'
                }
                disabled={routingLocked}
                type="button"
              >
                🌐
              </button>
            )

          case 'delete':
            return (
              <button
                key={col.id}
                className={`${styles['icon-action']} ${styles['icon-action--danger']}`}
                onClick={() => onRemove(index)}
                title={canDelete === false ? '不可删除' : '删除'}
                aria-label="删除"
                disabled={canDelete === false}
                type="button"
              >
                {canDelete === false ? '🔒' : '✕'}
              </button>
            )

          case 'preview_rate':
            return (
              <span className={styles['row-rate']} key={col.id}>{rateText ?? ''}</span>
            )

          case 'label':
            return (
              <span className={styles['row-label']} key={col.id}>{rowLabel ?? ''}</span>
            )

          case 'spacer':
            return <span key={col.id} />

          case 'io_toggle':
            return (
              <button
                key={col.id}
                className={`${styles['io-btn']}${item.is_utility_output ? ' ' + styles['is-output'] : ''}`}
                onClick={() => onIoTToggle?.(index)}
                title={item.is_utility_output ? '当前：设施输出（点击切换）' : '当前：设施输入（点击切换）'}
                disabled={ioToggleLocked}
                type="button"
              >
                {item.is_utility_output ? '出' : '入'}
              </button>
            )

          default:
            return null
        }
      })}
    </div>
  )
}
