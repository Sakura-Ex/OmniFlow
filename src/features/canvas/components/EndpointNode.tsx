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
import { NodeDetails } from './NodePresentation'
import { PortPolicyBadge } from './PortPolicyBadge'
import { useNodeDisplayStore } from '@/features/settings/nodeDisplay.store'

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
  showActual: boolean
  target: boolean
}

/** Commit only confirmed quantities; automatic modes display actual flow rather than a limit.
 * @param props - Current port policy, numeric evidence and display-unit context.
 * @returns Compact numeric field with Enter/blur commit and Escape cancellation.
 */
function EndpointQuantity(props: EndpointQuantityProps) {
  useTranslation()
  const { nodeId, portId, name, boundary, editableFlow, actual, units, expression, suffix, remember, showActual, target } = props
  const status = useCanvasStore(state => state.calculationStatus)
  const commit = useBoundaryCommit()
  const [draft, setDraft] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const cancelBlur = useRef(false)
  const quantity = boundary?.kind === 'source' ? boundary.capacity : boundary?.kind === 'delivery' && ['at_least', 'exact'].includes(boundary.mode) ? boundary.amount : null
  const editable = editableFlow && quantity !== null && quantity !== undefined
  const display = (amount: number) => formatOpExRate(editableFlow ? units.fromRate(amount, expression, 'rate_per_sec') : amount / units.registry.normalize(expression).scale)
  const missing = boundary?.kind === 'delivery' && ['at_least', 'exact'].includes(boundary.mode) && actual !== undefined ? Math.max(0, boundary.amount - actual) : 0
  const insufficient = missing > Math.max(1, quantity ?? 0) * 1e-7
  const verified = status === 'success' || status === 'feasible'
  const hasGoal = boundary?.kind === 'delivery' && ['at_least', 'exact'].includes(boundary.mode)
  const met = actual !== undefined && hasGoal && (boundary.mode === 'exact' ? Math.abs(actual - boundary.amount) <= Math.max(1, boundary.amount) * 1e-7 : !insufficient)
  const actualDescription = t('canvas.actual', { p0: actual === undefined ? '—' : display(actual), p1: suffix })
  const title = `${actualDescription}${editable ? `；${boundary?.kind === 'source' ? t('canvas.limit') : t('canvas.demand')} ${display(quantity!)} ${suffix}` : ''}${insufficient ? t('canvas.shortfall', { p0: display(missing), p1: suffix }) : ''}`
  const confirm = () => {
    if (cancelBlur.current) { cancelBlur.current = false; return }
    if (draft === null || !boundary || !editable) return
    const value = draft.trim() ? Number(draft) : NaN
    if (!Number.isFinite(value) || value < 0) { setInvalid(true); return }
    try {
      const canonical = units.toRate(value, expression, 'rate_per_sec', 1)
      const next = changeEndpointBoundaryAmount(boundary, canonical)
      commit(nodeId, portId, next)
      remember(canonical)
      setDraft(null)
      setInvalid(false)
    } catch { setInvalid(true) }
  }
  const outcome = target && hasGoal ? !verified || actual === undefined ? 'unverified' : met ? 'met' : 'unmet' : undefined
  return <div className={`${styles.quantity} ${showActual ? styles.withActual : ''} ${invalid || outcome === 'unmet' ? styles.insufficient : ''} nodrag nopan`} title={invalid ? t('canvas.invalidQuantity') : title} onClick={event => event.stopPropagation()}>
    {showActual && <strong className={styles.actual} title={actualDescription}>{t('canvas.actualPrefix')} {editable ? actual === undefined ? '—' : display(actual) : ''}</strong>}
    <label className={styles.field}><span>{editable ? target ? t('canvas.settingAmount') : t('canvas.limit') : ''}</span><input type="text" inputMode={editable ? 'decimal' : undefined}
      readOnly={!editable} aria-invalid={invalid || undefined} aria-label={`${name} ${editable ? boundary?.kind === 'source' ? t('canvas.supply_limit') : t('canvas.demandAmount') : t('canvas.actual_flow')} ${suffix}`}
      value={editable ? draft ?? String(units.fromRate(quantity!, expression, 'rate_per_sec')) : actual === undefined ? '—' : display(actual)}
      onChange={event => { if (editable) { cancelBlur.current = false; setInvalid(false); setDraft(event.target.value) } }} onBlur={confirm}
      onKeyDown={event => {
        if (!editable) return
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
        else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelBlur.current = true; setDraft(null); setInvalid(false); event.currentTarget.blur() }
      }} /></label>
    <span className={styles.unit}>{suffix}</span>
    <span className={styles.shortage} data-outcome={invalid ? 'unmet' : outcome} role={invalid ? 'alert' : undefined}>{invalid ? t('canvas.invalidQuantity') : outcome === 'unverified' ? t('canvas.targetUnverified') : outcome === 'met' ? t('canvas.targetMet') : outcome === 'unmet' ? `${t('canvas.targetUnmet')}${insufficient ? ` · ${display(missing)}` : ''}` : ''}</span>
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
  const displayMode = useNodeDisplayStore(state => state.mode)
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
  useLayoutEffect(() => { updateNodeInternals(id) }, [id, role, handleSignature, displayMode, updateNodeInternals])
  return <article className={`${styles.card} ${supply ? styles.supply : styles.demand}`} data-display-mode={displayMode}>
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
      <NodeDetails title={supply ? t('canvas.source') : t('canvas.target')}>
        {ports.map(port => {
          const portId = portIdentity(port)
          const policy = policies[portKey(id, portId)]
          const expression = port.displayUnit ?? port.unit ?? defaultResourceUnit(port.category, port.id)
          const flow = (policy?.semantics.kind ?? 'flow') === 'flow'
          const suffix = buildUnitSuffix(expression, flow ? 'rate_per_sec' : undefined, units)
          const name = entries[buildResourceId(port.category, port.id)]?.displayName || port.id
          return <section key={portId}><h3>{name}</h3><dl>
            <dt>{t('canvas.resource_id')}</dt><dd>{port.category} / {port.id}</dd>
            <dt>{t('canvas.actualPrefix')}</dt><dd>{data.actual_amounts?.[portId] === undefined ? '—' : formatOpExRate(flow ? units.fromRate(data.actual_amounts[portId], expression, 'rate_per_sec') : data.actual_amounts[portId] / units.registry.normalize(expression).scale)} {suffix}</dd>
            <dt>{t('canvas.portIdentity')}</dt><dd>{portId}</dd>
            <dt>{t('canvas.routingIdentity')}</dt><dd>{port.routing_mode ?? 'wired'}{port.routing_mode === 'global' ? ` · ${policy?.scopeId ?? 'document'} / ${policy?.busId ?? 'default'}` : ''}</dd>
            <dt>{t('canvas.boundaryPolicy')}</dt><dd><PortPolicyBadge policy={policy} formatAmount={amount => `${formatOpExRate(units.fromRate(amount, expression, 'rate_per_sec'))} ${suffix}`} formatQuantity={amount => `${formatOpExRate(amount / units.registry.normalize(expression).scale)} ${units.expression(expression).toString()}`} /></dd>
          </dl></section>
        })}
      </NodeDetails>
    </header>
    <ul className={styles.ports}>{ports.map((port, index) => {
      const portId = portIdentity(port)
      const configuration = policies[portKey(id, portId)]
      const category = resolveCategoryDef(port.category, categories, overrides)
      const expression = port.displayUnit ?? port.unit ?? defaultResourceUnit(port.category, port.id)
      const suffix = buildUnitSuffix(expression, (configuration?.semantics.kind ?? 'flow') === 'flow' ? 'rate_per_sec' : undefined, units)
      const name = entries[buildResourceId(port.category, port.id)]?.displayName || port.id
      const startsCategory = index > 0 && ports[index - 1].category !== port.category
      const boundary = configuration?.boundary
      return <Fragment key={portId}>
        {(index === 0 || startsCategory) && <li className={`${styles.categoryHeading}${startsCategory ? ` ${styles.categoryStart}` : ''}`} style={{ '--port-color': category.themeColor } as CSSProperties}>{categoryDisplayName(category.id, category.displayName)}</li>}
        <li className={`${styles.port} ${supply ? styles.sourceRow : styles.targetRow}`} style={{ '--port-color': category.themeColor } as CSSProperties}>
          <div className={styles.nameArea}><span className={styles.name} title={`${name} (${port.id})`}>{name}</span><PortPolicyBadge policy={configuration} formatAmount={amount => `${formatOpExRate(units.fromRate(amount, expression, 'rate_per_sec'))} ${suffix}`} formatQuantity={amount => `${formatOpExRate(amount / units.registry.normalize(expression).scale)} ${units.expression(expression).toString()}`} />{displayMode === 'detailed' && <span className={styles.identity} title={portId}>{port.routing_mode ?? 'wired'} · {portId}</span>}</div>
          <EndpointQuantity key={`${portId}:${boundaryMode(boundary)}`} nodeId={id} portId={portId} name={name} boundary={boundary} editableFlow={(configuration?.semantics.kind ?? 'flow') === 'flow'} actual={data.actual_amounts?.[portId]} units={units} expression={expression} suffix={suffix} remember={amount => { retainedAmounts.current[portId] = amount }} showActual={!supply || displayMode !== 'compact'} target={!supply} />
          {port.routing_mode === 'global' ? <GlobalPortIcon side={supply ? 'right' : 'left'} /> : <Handle id={portId} type={supply ? 'source' : 'target'} position={supply ? Position.Right : Position.Left} className={styles.handle} style={{ [supply ? 'right' : 'left']: '-5px' }} />}
        </li>
      </Fragment>
    })}</ul>

  </article>
}
