import { useTranslation } from '@/common/i18n'
import { categoryDisplayName } from '@/common/i18n/resourceLabels'
import { Icon } from '@/common/components/Icon'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { legacyUnit } from '@/common/units/defaults'
import type { UnitExpression } from '@/common/types/units'
import { defaultResourceUnit } from '@/common/units/defaults'
import { UnitExpressionEditor } from './UnitExpressionEditor'
import { Combobox } from '@/common/components/Combobox'
import type { TimeBase } from '@/common/types/resource'
import type { ColumnDef } from './ResourceDefinitionRow.config'
import { TIME_BASE_OPTIONS } from './ResourceDefinitionRow.config'
import { parseResourceId } from '@/common/utils/resourceId'
import styles from './ResourceDefinitionRow.module.css'

/**
 *
 */
type RowItem = {
  unit?: UnitExpression
  displayUnit?: UnitExpression
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
  const { t } = useTranslation()
  const categoryDefinitions = useGlobalResourceTable((s) => s.categories)
  const unitOverrides = useGlobalResourceTable((s) => s.overrides)
  const declaredLabel = unitOverrides[`${item.category}:${item.id}`]?.unit_override ?? categoryDefinitions[item.category ?? 'item']?.base_unit
  const expression = item.unit ?? (declaredLabel ? legacyUnit(declaredLabel) : defaultResourceUnit(item.category ?? 'item', item.id ?? ''))
  const gridTemplate = columns.map((c) => c.width ?? 'auto').join(' ')

  return (
    <div className={`${styles.row} ${styles['row--resource-route']}`} style={{ gridTemplateColumns: gridTemplate }}>
      {columns.map((col) => {
        switch (col.id) {
          case 'id':
            return <Combobox key={col.id} aria-label={t('editor.resourceId')} placeholder={t('editor.resourceId')} value={item.id ?? ''} disabled={idLocked} allowCustom
              options={(suggestions ?? []).map(value => ({ value, label: value }))}
              onChange={value => onUpdate(index, { id: value })}
              onSelect={value => {
                const parsed = parseResourceId(value)
                const category = parsed.category !== parsed.id ? parsed.category : ''
                onUpdate(index, category ? { id: parsed.id, category } : { id: value })
              }} />

          case 'unit':
            return <UnitExpressionEditor key={col.id} expression={expression} amount={item.amount ?? 0} displayExpression={item.displayUnit} onDisplayChange={(displayUnit) => onUpdate(index, { displayUnit })} onChange={(unit, amount) => onUpdate(index, { unit, amount })} />

          case 'amount':
            return (
              <div className={styles['input-wrap']} data-has-suffix={!!unitSuffix} key={col.id}>
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
            return <Combobox key={col.id} aria-label={t('editor.timeBase')} value={item.time_base ?? 'per_cycle'} disabled={timeBaseLocked}
              options={TIME_BASE_OPTIONS.map(option => ({ ...option, label: t(option.labelKey) }))} onChange={value => onUpdate(index, { time_base: value as TimeBase })} />

          case 'category':
            return <Combobox key={col.id} aria-label={t('editor.category')} value={item.category ?? ''} disabled={categoryLocked}
              options={(categoryOptions ?? []).map(option => ({ value: option.id, label: categoryDisplayName(option.id, option.displayName) }))}
              onChange={value => onUpdate(index, { category: value })} />

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
            return <label key={col.id} className={styles.routingCell}
              title={routingLocked ? t('editor.routingLocked') : t('editor.routingHint')}>
              <input className={styles.routingCheckbox} type="checkbox" checked={item.routing_mode === 'global'}
                aria-label={`${item.id || t('editor.unnamedResource')}: ${t('editor.global')}`} disabled={routingLocked}
                onChange={() => onToggleRouting?.(index)} />
              {item.routing_mode === 'global' && <span className={styles.routingMark}><Icon name="check" size={14} /></span>}
            </label>

          case 'delete':
            return (
              <button
                key={col.id}
                className={`${styles['icon-action']} ${styles['icon-action--danger']}`}
                onClick={() => onRemove(index)}
                title={canDelete === false ? t('editor.cannotDelete') : t('editor.delete')}
                aria-label={t('editor.delete')}
                disabled={canDelete === false}
                type="button"
              >
                <Icon name={canDelete === false ? 'lock' : 'close'} />
              </button>
            )

          case 'preview_rate':
            return (
              <span className={styles['row-rate']} title={rateText} key={col.id}>{rateText ?? ''}</span>
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
                title={item.is_utility_output ? t('editor.utilityOutputHint') : t('editor.utilityInputHint')}
                disabled={ioToggleLocked}
                type="button"
              >
                {item.is_utility_output ? t('editor.outputShort') : t('editor.inputShort')}
              </button>
            )

          default:
            return null
        }
      })}
    </div>
  )
}
