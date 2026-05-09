import { useState, useRef } from 'react'
import type { TimeBase } from '../types/types'
import { parseResourceId } from '../utils/resourceIdentifier'
import { useClickOutside } from '../hooks/useClickOutside'

export type ResourceColumnId =
  | 'id'
  | 'amount'
  | 'time_base'
  | 'category'
  | 'probability'
  | 'routing'
  | 'delete'
  | 'preview_rate'
  | 'label'
  | 'spacer'
  | 'io_toggle'

export interface ColumnDef {
  id: ResourceColumnId
  header: string
  width?: string
}

export const RECIPE_INPUT_COLUMNS: ColumnDef[] = [
  { id: 'category', header: '类别', width: '1fr' },
  { id: 'id', header: 'ID', width: '1fr' },
  { id: 'amount', header: '数量', width: '1fr' },
  { id: 'time_base', header: '基准', width: 'minmax(0, 56px)' },
  { id: 'probability', header: '消耗几率', width: 'minmax(0, 56px)' },
  { id: 'routing', header: '', width: 'minmax(0, 34px)' },
  { id: 'delete', header: '', width: 'minmax(0, 34px)' },
  { id: 'preview_rate', header: '实际速率', width: 'minmax(0, 80px)' },
]

export const RECIPE_OUTPUT_COLUMNS: ColumnDef[] = [
  { id: 'category', header: '类别', width: '1fr' },
  { id: 'id', header: 'ID', width: '1fr' },
  { id: 'amount', header: '数量', width: '1fr' },
  { id: 'time_base', header: '基准', width: 'minmax(0, 56px)' },
  { id: 'probability', header: '产出几率', width: 'minmax(0, 56px)' },
  { id: 'routing', header: '', width: 'minmax(0, 34px)' },
  { id: 'delete', header: '', width: 'minmax(0, 34px)' },
  { id: 'preview_rate', header: '实际速率', width: 'minmax(0, 80px)' },
]

export const UTILITY_COLUMNS: ColumnDef[] = [
  { id: 'io_toggle', header: 'I/O', width: 'minmax(0, 34px)' },
  { id: 'category', header: '类别', width: '1fr' },
  { id: 'id', header: 'ID', width: '1fr' },
  { id: 'amount', header: '数量', width: '1fr' },
  { id: 'time_base', header: '基准', width: 'minmax(0, 56px)' },
  { id: 'probability', header: '消耗几率', width: 'minmax(0, 56px)' },
  { id: 'routing', header: '', width: 'minmax(0, 34px)' },
  { id: 'delete', header: '', width: 'minmax(0, 34px)' },
  { id: 'preview_rate', header: '实际速率', width: 'minmax(0, 80px)' },
]

export const MACHINE_UTILITY_COLUMNS: ColumnDef[] = [
  { id: 'label', header: '设施', width: 'auto' },
  { id: 'amount', header: '用量', width: '1fr' },
  { id: 'spacer', header: '', width: 'auto' },
  { id: 'routing', header: '', width: '34px' },
  { id: 'delete', header: '', width: '34px' },
  { id: 'preview_rate', header: '实际速率', width: 'auto' },
]

export const ENDPOINT_COLUMNS: ColumnDef[] = [
  { id: 'category', header: '类别', width: '1fr' },
  { id: 'id', header: '资源 ID', width: '3fr' },
  { id: 'routing', header: '', width: 'minmax(0, 34px)' },
  { id: 'delete', header: '', width: 'minmax(0, 34px)' },
]

export const TIME_BASE_OPTIONS: { value: TimeBase; label: string }[] = [
  { value: 'per_cycle', label: '/配方' },
  { value: 'rate_per_tick', label: '/tick' },
  { value: 'rate_per_sec', label: '/秒' },
]

type RowItem = {
  category?: string
  id?: string
  amount?: number
  time_base?: TimeBase
  routing_mode?: string
  routing_locked?: boolean
  consumable?: boolean
  consumable_probability?: number
  probability?: number
  is_utility?: boolean
  is_utility_output?: boolean
  _uid?: string
  amount_mutable?: boolean
}

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
  amountReadonly?: boolean
  canDelete?: boolean
  rowLabel?: string
}

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
  probabilityLabel,
  routingLocked,
  amountReadonly,
  canDelete,
  rowLabel,
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
    <div className="recipe-editor__row recipe-editor__row--resource-route" style={{ gridTemplateColumns: gridTemplate }}>
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
              <div className="recipe-editor__input-wrap" key={col.id}>
                <input
                  type="number"
                  min={0}
                  value={item.amount ?? 1}
                  disabled={amountReadonly}
                  onChange={(e) => onUpdate(index, { amount: Number(e.target.value) })}
                />
                {unitSuffix && <span className="recipe-editor__input-suffix">{unitSuffix}</span>}
              </div>
            )

          case 'time_base':
            return (
              <select
                key={col.id}
                value={item.time_base ?? 'per_cycle'}
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
                onChange={(e) => onUpdate(index, { category: e.target.value })}
              >
                {categoryOptions?.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.displayName}</option>
                )) ?? []}
              </select>
            )

          case 'probability':
            return (
              <div className="recipe-editor__input-wrap" key={col.id}>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={item.consumable === false ? 0 : (item.consumable_probability ?? 1)}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(1, Number(e.target.value) || 0))
                    onUpdate(index, {
                      consumable: v === 0 ? false : undefined,
                      consumable_probability: v,
                    })
                  }}
                />
              </div>
            )

          case 'routing':
            return (
              <button
                key={col.id}
                className={`recipe-editor__route-btn${item.routing_mode === 'global' ? ' is-global' : ''}`}
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
                className="recipe-editor__icon-action recipe-editor__icon-action--danger"
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
              <span className="recipe-editor__row-rate" key={col.id}>{rateText ?? ''}</span>
            )

          case 'label':
            return (
              <span className="recipe-editor__row-label" key={col.id}>{rowLabel ?? ''}</span>
            )

          case 'spacer':
            return <span key={col.id} />

          case 'io_toggle':
            return (
              <button
                key={col.id}
                className={`recipe-editor__io-btn${item.is_utility_output ? ' is-output' : ''}`}
                onClick={() => onIoTToggle?.(index)}
                title={item.is_utility_output ? '当前：设施输出（点击切换）' : '当前：设施输入（点击切换）'}
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
