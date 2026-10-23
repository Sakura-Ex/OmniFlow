import { t, useTranslation } from '@/common/i18n'
import type { ReactNode } from 'react'
import { Combobox } from '@/common/components/Combobox'
import type { Boundary } from '../networkConfig'
import styles from './BoundaryEditor.module.css'

/** Optional priorities for advanced planning. */
type Objective = { priority: number; weight: number; scale: number; ratioGroup?: string; ratio?: number }

/**
 * Keep everyday supply and demand controls ahead of optional network objectives.
 * @param props - Controlled boundary editor.
 * @param props.value - Boundary in the displayed rate unit.
 * @param props.direction - Port direction.
 * @param props.supplyInput - Recipe input accepting an explicit external supply.
 * @param props.unitLabel - Visible per-second rate unit.
 * @param props.advanced - Optional port-specific advanced controls.
 * @param props.onChange - Apply a boundary draft.
 * @returns Basic controls and collapsed advanced options.
 */
export function BoundaryEditor({ value, direction, supplyInput = false, unitLabel = '/s', advanced, onChange }: { value?: Boundary; direction: 'input' | 'output'; supplyInput?: boolean; unitLabel?: string; advanced?: ReactNode; onChange: (boundary: Boundary | undefined) => void }) {
  useTranslation()
  const objective = value?.kind === 'delivery' ? value.objective : value && value.kind !== 'forbid_spill' ? value.cost : undefined
  const setObjective = (next: Objective | undefined) => {
    if (!value || value.kind === 'forbid_spill') return
    onChange(value.kind === 'delivery' ? { ...value, objective: next } : { ...value, cost: next })
  }
  const setKind = (kind: string) => onChange(kind === 'source' ? { kind, capacity: null } : kind === 'delivery' ? { kind, mode: 'exact', amount: 0, capacity: null } : kind === 'spill' ? { kind, capacity: null } : kind === 'forbid_spill' ? { kind } : undefined)
  return <div className={styles.boundary}>
    {supplyInput && <label className={styles.check} title={t('canvas.no_supply_connection_needed_external_supply_serves')}><input type="checkbox" checked={value?.kind === 'source'} onChange={event => onChange(event.target.checked ? { kind: 'source', capacity: null } : undefined)} />{t('canvas.external_supply')}</label>}
    {!value && !supplyInput && <div className={styles.empty}><span>{t('canvas.no_supply_or_demand_configured')}</span><button onClick={() => setKind(direction === 'output' ? 'source' : 'delivery')}>{direction === 'output' ? t('canvas.set_supply') : t('canvas.set_demand')}</button></div>}
    <div className={styles.fields}>
      {value?.kind === 'delivery' && <><label>{t('canvas.production_goal')}<Combobox aria-label={t('canvas.production_goal')} value={value.mode} onChange={selected => { const mode = selected as typeof value.mode; onChange({ ...value, mode, objective: mode === 'maximize' ? value.objective ?? { priority: 0, weight: 1, scale: 1 } : undefined }) }} options={[{ value: 'exact', label: t('canvas.fixed_output') }, { value: 'at_least', label: t('canvas.produce_at_least') }, { value: 'maximize', label: t('canvas.maximize_production') }, { value: 'export', label: t('canvas.receive_surplus') }]} /></label>{['exact', 'at_least'].includes(value.mode) && <label>{t('canvas.target_output')} {unitLabel}<input type="number" min="0" step="any" value={value.amount} onChange={event => onChange({ ...value, amount: Number(event.target.value) })} /></label>}</>}
      {value && value.kind !== 'forbid_spill' && value.kind !== 'delivery' && <label>{value.kind === 'source' ? t('canvas.maximum_supply') : value.kind === 'spill' ? t('canvas.maximum_disposal') : t('canvas.acceptance_limit')} · {unitLabel}<input type="number" min="0" step="any" placeholder={t('canvas.noLimit')} value={value.capacity ?? ''} onChange={event => onChange({ ...value, capacity: event.target.value === '' ? null : Number(event.target.value) })} /></label>}
    </div>
    <details className={styles.advanced}><summary>{t('canvas.advanced_settings')}</summary>
      {value?.kind === 'delivery' && <label>{t('canvas.acceptanceLimitWithUnit')} {unitLabel}<input type="number" min="0" step="any" placeholder={t('canvas.noLimit')} value={value.capacity ?? ''} onChange={event => onChange({ ...value, capacity: event.target.value === '' ? null : Number(event.target.value) })} /></label>}
      <label>{t('canvas.external_connection')}<Combobox aria-label={t('canvas.external_connection')} value={value?.kind ?? 'closed'} onChange={setKind} options={[{ value: 'closed', label: t('canvas.closed_no_external_exchange') }, ...((direction === 'output' || supplyInput) ? [{ value: 'source', label: t('canvas.supply_from_outside') }] : []), ...(direction === 'input' ? [{ value: 'delivery', label: t('canvas.deliver_outside') }] : []), { value: 'spill', label: t('canvas.allow_surplus_disposal') }, { value: 'forbid_spill', label: t('canvas.forbid_surplus_disposal') }]} /></label>
      {value && value.kind !== 'forbid_spill' && (value.kind !== 'delivery' || value.mode === 'maximize') && <label className={styles.check}><input type="checkbox" checked={Boolean(objective)} onChange={event => setObjective(event.target.checked ? { priority: 0, weight: 1, scale: 1 } : undefined)} />{value.kind === 'delivery' ? t('canvas.optimize_output') : t('canvas.minimize_supply_or_disposal')}</label>}
      {objective && <div className={styles.fields}>{(['priority', 'weight', 'scale'] as const).map(field => <label key={field}>{field === 'priority' ? t('canvas.priority_lower_first') : field === 'weight' ? t('canvas.weight_at_same_priority') : t('canvas.normalization_scale_standard_units')}<input type="number" min="0" step={field === 'priority' ? '1' : 'any'} value={objective[field]} onChange={event => setObjective({ ...objective, [field]: Number(event.target.value) })} /></label>)}<label>{t('canvas.fixed_ratio_group')}<input placeholder={t('canvas.no_group')} value={objective.ratioGroup ?? ''} onChange={event => setObjective({ ...objective, ratioGroup: event.target.value || undefined, ratio: event.target.value ? objective.ratio ?? 1 : undefined })} /></label>{objective.ratioGroup && <label>{t('canvas.ratio_within_group')}<input type="number" min="0" step="any" value={objective.ratio ?? 1} onChange={event => setObjective({ ...objective, ratio: Number(event.target.value) })} /></label>}</div>}
      {advanced}
    </details>
  </div>
}
