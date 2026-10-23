import { categoryDisplayName } from '@/common/i18n/resourceLabels'
import { t, useTranslation } from '@/common/i18n'
import { Icon } from '@/common/components/Icon'
import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Combobox } from '@/common/components/Combobox'
import { Handle, Position, useUpdateNodeInternals } from 'reactflow'
import type { SourceNodeData, TargetNodeData } from '@/common/types/recipe'
import { useEndpointEditor } from '@/features/canvas/contexts/EndpointEditorContext'
import { usePlanningEditor, useBoundaryCommit, useBoundaryBatchCommit } from '@/features/calculation/contexts/PlanningEditorContext'
import { changeEndpointBoundaryAmount, changeEndpointBoundaryMode, type EndpointMode } from '@/features/calculation/endpointBoundary'
import type { Boundary } from '@/features/calculation/networkConfig'
import type { UnitExpression } from '@/common/types/units'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { normalizeEndpointPorts, resolveCategoryDef } from '@/features/recipe/recipe.endpointNorm'
import { portKey } from '@/features/calculation/topology'
import { UnitSystem } from '@/common/units/UnitSystem'
import { defaultResourceUnit } from '@/common/units/defaults'
import { portIdentity } from '@/common/utils/ports'
import { formatOpExRate } from '@/common/utils/format'
import { buildResourceId } from '@/common/utils/resourceId'
import { buildUnitSuffix } from '@/features/resource-registry/registry.units'
import styles from './EndpointNode.module.css'
import { groupPortsByCategory } from '../groupPortsByCategory'
import { GlobalPortIcon } from './GlobalPortIcon'

/** Map authoritative boundaries to the shared card control without changing their semantics.
 * @param boundary - Explicit port boundary, if configured.
 * @returns Quick mode or an explicit unconfigured/advanced marker.
 */
function boundaryMode(boundary?: Boundary): EndpointMode | 'unset' | 'advanced' {
  if (!boundary) return 'unset'
  if (boundary.kind === 'source') return boundary.capacity === null ? 'unlimited' : 'limited'
  if (boundary.kind === 'delivery') return boundary.mode === 'at_least' ? 'demand' : boundary.mode
  return boundary.kind === 'spill' ? 'spill' : 'advanced'
}

/** One port retains its own numeric draft and actual-throughput evidence. */
type EndpointQuantityProps = {
  nodeId: string
  portId: string
  name: string
  boundary?: Boundary
  editableFlow: boolean
  actual?: number
  units: UnitSystem
  expression: UnitExpression
  suffix: string
  remember: (amount: number) => void
}

/** Commit only confirmed quantities; automatic modes display actual flow rather than a limit.
 * @param props - Current port policy, numeric evidence and display-unit context.
 * @returns Compact numeric field with Enter/blur commit and Escape cancellation.
 */
function EndpointQuantity(props: EndpointQuantityProps) {
  useTranslation()
  const { nodeId, portId, name, boundary, editableFlow, actual, units, expression, suffix, remember } = props
  const commit = useBoundaryCommit()
  const [draft, setDraft] = useState<string | null>(null)
  const cancelBlur = useRef(false)
  const quantity = boundary?.kind === 'source' ? boundary.capacity : boundary?.kind === 'delivery' && ['at_least', 'exact'].includes(boundary.mode) ? boundary.amount : null
  const editable = editableFlow && quantity !== null && quantity !== undefined
  const display = (amount: number) => formatOpExRate(units.fromRate(amount, expression, 'rate_per_sec'))
  const missing = boundary?.kind === 'delivery' && ['at_least', 'exact'].includes(boundary.mode) && actual !== undefined ? Math.max(0, boundary.amount - actual) : 0
  const insufficient = missing > Math.max(1, quantity ?? 0) * 1e-7
  const actualDescription = t('canvas.actual', { p0: actual === undefined ? '—' : display(actual), p1: suffix })
  const title = `${actualDescription}${editable ? `；${boundary?.kind === 'source' ? t('canvas.limit') : t('canvas.demand')} ${display(quantity!)} ${suffix}` : ''}${insufficient ? t('canvas.shortfall', { p0: display(missing), p1: suffix }) : ''}`
  const confirm = () => {
    if (cancelBlur.current) { cancelBlur.current = false; return }
    if (draft === null || !boundary || !editable) return
    const value = draft.trim() ? Number(draft) : NaN
    setDraft(null)
    if (!Number.isFinite(value) || value < 0) return
    try {
      const canonical = units.toRate(value, expression, 'rate_per_sec', 1)
      const next = changeEndpointBoundaryAmount(boundary, canonical)
      remember(canonical)
      commit(nodeId, portId, next)
    } catch { /* Invalid conversions leave the authoritative boundary unchanged. */ }
  }
  return <div className={`${styles.quantity} ${insufficient ? styles.insufficient : ''} nodrag nopan`} title={title} onClick={event => event.stopPropagation()}>
    <input type={editable ? 'number' : 'text'} min={editable ? 0 : undefined} step={editable ? 'any' : undefined}
      readOnly={!editable} aria-label={`${name} ${editable ? boundary?.kind === 'source' ? t('canvas.supply_limit') : t('canvas.demandAmount') : t('canvas.actual_flow')} ${suffix}`}
      value={editable ? draft ?? String(units.fromRate(quantity!, expression, 'rate_per_sec')) : actual === undefined ? '—' : display(actual)}
      onChange={event => { if (editable) { cancelBlur.current = false; setDraft(event.target.value) } }} onBlur={confirm}
      onKeyDown={event => {
        if (!editable) return
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
        else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelBlur.current = true; setDraft(null); event.currentTarget.blur() }
      }} />
    <span className={styles.unit}>{suffix}</span>
    {insufficient && <span className={styles.shortage}>{t('canvas.shortfallLabel')} {display(missing)}</span>}
  </div>
}

/**
 * Compact grouped source/sink rows with one explicit shared-mode selector.
 * @param props - Endpoint card props.
 * @param props.id - Persistent node identity.
 * @param props.data - Resource ports and current verified results.
 * @param props.role - Supply or demand role.
 * @returns A compact endpoint card retaining independent port quantities and handles.
 */
export function EndpointNode({ id, data, role }: { id: string; data: SourceNodeData | TargetNodeData; role: 'source' | 'target' }) {
  useTranslation()
  const { onEdit } = useEndpointEditor()
  const openPlanning = usePlanningEditor()
  const commitBatch = useBoundaryBatchCommit()
  const policies = useCanvasStore(state => state.networkConfiguration.ports)
  const environment = useSettingsStore(state => state.units)
  const categories = useGlobalResourceTable(state => state.categories)
  const overrides = useGlobalResourceTable(state => state.overrides)
  const entries = useGlobalResourceTable(state => state.entries)
  const units = new UnitSystem(environment)
  const supply = role === 'source'
  const ports = groupPortsByCategory(normalizeEndpointPorts(data))
  const retainedAmounts = useRef<Record<string, number>>({})
  const modes = ports.map(port => boundaryMode(policies[portKey(id, portIdentity(port))]?.boundary))
  const hasNonFlow = ports.some(port => (policies[portKey(id, portIdentity(port))]?.semantics.kind ?? 'flow') !== 'flow')
  const sharedMode = hasNonFlow ? 'advanced' : !modes.length ? 'unset' : modes.every(mode => mode === modes[0]) ? modes[0] : 'mixed'
  const changeMode = (mode: EndpointMode) => {
    if (hasNonFlow) return
    const boundaries: Record<string, Boundary> = {}
    for (const port of ports) {
      const portId = portIdentity(port)
      const previous = policies[portKey(id, portId)]?.boundary
      const previousAmount = previous?.kind === 'source' ? previous.capacity : previous?.kind === 'delivery' && ['at_least', 'exact'].includes(previous.mode) ? previous.amount : null
      if (previousAmount !== null && previousAmount !== undefined) retainedAmounts.current[portId] = previousAmount
      const fallback = retainedAmounts.current[portId] ?? units.toRate(port.amount, port.unit ?? defaultResourceUnit(port.category, port.id), 'rate_per_sec', 1)
      boundaries[portId] = changeEndpointBoundaryMode(previous, mode, fallback)
    }
    commitBatch(id, boundaries)
  }
  const updateNodeInternals = useUpdateNodeInternals()
  const handleSignature = JSON.stringify(ports.map(port => [portIdentity(port), port.routing_mode ?? 'wired']))
  useLayoutEffect(() => { updateNodeInternals(id) }, [id, role, handleSignature, updateNodeInternals])
  return <article className={`${styles.card} ${supply ? styles.supply : styles.demand}`}>
    <header className={styles.header}>
      <span className={styles.title}>{supply ? t('canvas.source') : t('canvas.target')}</span>
      <div className={`${styles.mode} nodrag nopan`} title={hasNonFlow ? t('canvas.contains_capacity_or_state_ports_use_advanced') : undefined}>
        <Combobox aria-label={supply ? t('canvas.supply_mode') : t('canvas.target_mode')} value={sharedMode} disabled={hasNonFlow || !ports.length} onChange={selected => changeMode(selected as EndpointMode)} options={[
          ...(['mixed', 'advanced', 'unset'].includes(sharedMode) ? [{ value: sharedMode, label: sharedMode === 'mixed' ? t('canvas.mixed') : sharedMode === 'advanced' ? t('canvas.advanced_settings') : t('canvas.select'), disabled: true }] : []),
          ...(supply ? [{ value: 'unlimited', label: t('canvas.unlimited_supply') }, { value: 'limited', label: t('canvas.supplyCap') }] : [{ value: 'demand', label: t('canvas.demand_minimum') }, { value: 'maximize', label: t('canvas.maximize_output') }, { value: 'spill', label: t('canvas.overflow_disposal') }, { value: 'exact', label: t('canvas.fixed_output_exact') }, { value: 'export', label: t('canvas.receive_surplus') }]),
        ]} />
      </div>
      <button className={`${styles.iconButton} nodrag nopan`} onClick={() => onEdit(id, role, data)} title={t('canvas.edit_resources')} aria-label={t('canvas.edit_resources')}><Icon name="settings" size={15} /></button>
      <button className={`${styles.iconButton} nodrag nopan`} onClick={() => openPlanning(id)} title={supply ? t('canvas.supply_settings') : t('canvas.demand_settings')} aria-label={supply ? t('canvas.supply_settings') : t('canvas.demand_settings')}><Icon name="boundary" size={16} /></button>
    </header>
    <ul className={styles.ports}>{ports.map((port, index) => {
      const portId = portIdentity(port)
      const configuration = policies[portKey(id, portId)]
      const category = resolveCategoryDef(port.category, categories, overrides)
      const expression = port.displayUnit ?? port.unit ?? defaultResourceUnit(port.category, port.id)
      const suffix = buildUnitSuffix(expression, 'rate_per_sec', units)
      const name = entries[buildResourceId(port.category, port.id)]?.displayName || port.id
      const startsCategory = index > 0 && ports[index - 1].category !== port.category
      const boundary = configuration?.boundary
      return <Fragment key={portId}>
        {(index === 0 || startsCategory) && <li className={`${styles.categoryHeading}${startsCategory ? ` ${styles.categoryStart}` : ''}`} style={{ '--port-color': category.themeColor } as CSSProperties}>{categoryDisplayName(category.id, category.displayName)}</li>}
        <li className={`${styles.port} ${supply ? styles.sourceRow : styles.targetRow}`} style={{ '--port-color': category.themeColor } as CSSProperties}>
          <span className={styles.name} title={port.id}>{name}</span>
          <EndpointQuantity key={`${portId}:${boundaryMode(boundary)}`} nodeId={id} portId={portId} name={name} boundary={boundary} editableFlow={(configuration?.semantics.kind ?? 'flow') === 'flow'} actual={data.actual_amounts?.[portId]} units={units} expression={expression} suffix={suffix} remember={amount => { retainedAmounts.current[portId] = amount }} />
          {port.routing_mode === 'global' ? <GlobalPortIcon side={supply ? 'right' : 'left'} /> : <Handle id={portId} type={supply ? 'source' : 'target'} position={supply ? Position.Right : Position.Left} className={styles.handle} style={{ [supply ? 'right' : 'left']: '-5px' }} />}
        </li>
      </Fragment>
    })}</ul>
  </article>
}
