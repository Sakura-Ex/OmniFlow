import { translateDiagnostic } from '@/common/i18n/translateDiagnostic'
import { categoryDisplayName } from '@/common/i18n/resourceLabels'
import { t, useTranslation } from '@/common/i18n'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { resolveCategoryDef } from '@/features/recipe/recipe.endpointNorm'
import { Icon } from '@/common/components/Icon'
import { stripCalculationResults } from '@/common/utils/calculationState'
import { useEffect, useMemo, useState } from 'react'
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from 'reactflow'
import { SplitterNodeDataSchema, type SplitterNodeData } from '@/common/schemas/splitter.schema'
import { generateId } from '@/common/utils/id'
import { useNodeData } from '@/features/canvas/contexts/NodeDataContext'
import styles from './SplitterNode.module.css'
import { useNodeDisplayStore } from '@/features/settings/nodeDisplay.store'
import { NodeDetails } from './NodePresentation'
import { splitterGeometrySignature } from '../nodeGeometry'
import { normalizeSplitterWeights, splitterAllocationKey, splitterWeightDrafts } from '../splitterWeights'
import { NodeFrame, NodeHeader, NodeResourceLayout } from './NodeFrame'
import { NodeCategoryHeading, NodeResourceIdentity, NodeResourceRow } from './NodeResource'
import { useSettingsStore } from '@/features/settings/settings.store'
import { UnitSystem } from '@/common/units/UnitSystem'
import { defaultResourceUnit } from '@/common/units/defaults'
import { buildUnitSuffix } from '@/features/resource-registry/registry.units'
import { buildResourceId } from '@/common/utils/resourceId'
import { formatOpExRate } from '@/common/utils/format'

/**
 * Edit branch ratios together while retaining the last valid allocation on the canvas.
 * @param props - React Flow node properties.
 * @param props.id - Persistent splitter identity.
 * @param props.data - Serializable allocation and verified port throughputs.
 * @returns Compact allocation card with an atomic, schema-validated draft.
 */
export function SplitterNode({ id, data }: NodeProps<SplitterNodeData & { port_throughputs?: Record<string, number> }>) {
  useTranslation()
  const displayMode = useNodeDisplayStore(state => state.mode)
  const { updateNodeData } = useNodeData()
  const updateNodeInternals = useUpdateNodeInternals()
  const categories = useGlobalResourceTable(state => state.categories)
  const overrides = useGlobalResourceTable(state => state.overrides)
  const entries = useGlobalResourceTable(state => state.entries)
  const environment = useSettingsStore(state => state.units)
  const units = useMemo(() => new UnitSystem(environment), [environment])
  const [advanced, setAdvanced] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [draft, setDraft] = useState(() => stripCalculationResults(data))
  const [error, setError] = useState('')
  const allocationKey = splitterAllocationKey(data.outputs)
  const [retainedWeights, setRetainedWeights] = useState(() => ({ key: allocationKey, values: splitterWeightDrafts(data.outputs) }))
  const committedWeights = retainedWeights.key === allocationKey ? retainedWeights.values : splitterWeightDrafts(data.outputs)
  const [weights, setWeights] = useState(committedWeights)
  const shownWeights = dirty || advanced ? weights : committedWeights
  const shown = dirty || advanced ? draft : data
  const category = resolveCategoryDef(shown.input.category, categories, overrides)
  const handleSignature = splitterGeometrySignature(shown.input.portId, shown.outputs.map(output => output.portId), data.outputs.map(output => output.portId))
  useEffect(() => updateNodeInternals(id), [id, handleSignature, updateNodeInternals])
  const change = (next: SplitterNodeData) => {
    if (!dirty && !advanced) setWeights(committedWeights)
    setDraft(next); setDirty(true); setError('')
  }
  const changeWeight = (portId: string, value: string) => {
    if (!dirty && !advanced) setDraft(stripCalculationResults(data))
    setWeights({ ...shownWeights, [portId]: value }); setDirty(true); setError('')
  }
  const setResource = (field: 'id' | 'category', value: string) => change({ ...shown, input: { ...shown.input, [field]: value }, outputs: shown.outputs.map(output => ({ ...output, [field]: value })) })
  const cancel = () => { setDraft(stripCalculationResults(data)); setWeights(committedWeights); setDirty(false); setAdvanced(false); setError('') }
  const normalized = normalizeSplitterWeights(shown.outputs.map(output => {
    const value = shownWeights[output.portId] ?? '0'
    return value.trim() ? Number(value) : NaN
  }))
  const weightError = normalized.ok ? '' : t(normalized.reason === 'zero' ? 'canvas.weights_zero' : normalized.reason === 'precision' ? 'canvas.weights_precision' : 'canvas.weights_invalid')
  const save = () => {
    if (!normalized.ok) { setError(weightError); return }
    const weightsChanged = shown.outputs.length !== data.outputs.length || shown.outputs.some((output, index) => output.portId !== data.outputs[index]?.portId || shownWeights[output.portId] !== committedWeights[output.portId])
    const next = { ...stripCalculationResults(shown), outputs: shown.outputs.map((output, index) => ({ ...output, ratio: weightsChanged ? normalized.ratios[index] : output.ratio })) }
    const parsed = SplitterNodeDataSchema.safeParse(next)
    if (!parsed.success) { setError(parsed.error.issues.map(issue => issue.message === 'Splitter ratios must sum to one' ? t('canvas.ratios_must_total_100') : issue.message).join('; ')); return }
    updateNodeData(id, parsed.data)
    const values = Object.fromEntries(shown.outputs.map(output => [output.portId, shownWeights[output.portId] ?? '0']))
    setRetainedWeights({ key: splitterAllocationKey(parsed.data.outputs), values })
    setWeights(values); setDraft(parsed.data); setDirty(false); setAdvanced(false); setError('')
  }
  const inputRate = data.port_throughputs?.[data.input.portId]
  const resourceName = entries[buildResourceId(shown.input.category, shown.input.id)]?.displayName || shown.input.id
  const expression = shown.input.displayUnit ?? shown.input.unit ?? defaultResourceUnit(shown.input.category, shown.input.id)
  const suffix = buildUnitSuffix(expression, 'rate_per_sec', units)
  const rate = (value: number | undefined) => value === undefined ? '—' : formatOpExRate(units.fromRate(value, expression, 'rate_per_sec'))
  return <NodeFrame className={styles.node} mode={displayMode}>
    <NodeHeader title={t('canvas.splitter')} actions={<>
      <NodeDetails title={t('canvas.splitter')}><dl>
        <dt>{t('canvas.resource_id')}</dt><dd>{resourceName} · {shown.input.category} / {shown.input.id}</dd>
        <dt>{t('canvas.throughput_limit')}</dt><dd>{shown.capacity === null ? t('canvas.unlimited') : `${rate(shown.capacity)} ${suffix}`}</dd>
        <dt>{t('canvas.actual_flow')}</dt><dd>{rate(inputRate)} {suffix}</dd>
        {data.outputs.map((output, index) => <div key={output.portId}><dt>{t('canvas.branch')} {index + 1}</dt><dd>{Number((output.ratio * 100).toPrecision(12))}% · {rate(data.port_throughputs?.[output.portId])} {suffix}<br />{output.portId}</dd></div>)}
      </dl></NodeDetails>
      <button type="button" className={`${styles.iconButton} nodrag nopan`} aria-label={t('canvas.splitter_settings')} aria-expanded={advanced} title={t('canvas.resource_throughput_limit_and_branches')} onClick={() => { if (!dirty) { setDraft(stripCalculationResults(data)); setWeights(committedWeights) } setAdvanced(!advanced); setError('') }}><Icon name="settings" size={15} /></button>
    </>} />
    <NodeResourceLayout className={styles.flow}>
      <section className={styles.input}><h3>{t('canvas.inputs')}</h3>
        <NodeCategoryHeading as="div" label={categoryDisplayName(category.id, category.displayName)} color={category.themeColor} />
        <NodeResourceRow as="div" mode={displayMode} className={styles.inputPort}
          title={t('canvas.throughput_limit_standard_unitss', { p0: shown.input.category, p1: shown.input.id, p2: shown.capacity ?? t('canvas.unlimited') })}
          identity={<NodeResourceIdentity name={resourceName || t('canvas.select_resource')} title={`${resourceName} (${shown.input.id})`} />}
          policy={(displayMode === 'detailed' || shown.capacity !== null) && <span className={styles.capacity} title={`${t('canvas.throughput_limit')} ${shown.capacity === null ? t('canvas.unlimited') : `${rate(shown.capacity)} ${suffix}`}`}>{t('canvas.throughput_limit')} {shown.capacity === null ? t('canvas.unlimited') : `${rate(shown.capacity)} ${suffix}`}</span>}
          port={<Handle type="target" position={Position.Left} id={shown.input.portId} className={styles.handle} />}
        />
      </section>
      <section className={styles.output}><h3>{t('canvas.output_ratios')}</h3>
        <div className={styles.branches}>
          {shown.outputs.map((output, index) => <div className={styles.outputPort} key={output.portId}>
            <label className={styles.ratioLabel}><span>{t('canvas.branch')} {index + 1}</span><input className="nodrag nopan" aria-label={t('canvas.branch_weight', { p0: index + 1 })} type="text" inputMode="decimal" aria-invalid={!(shownWeights[output.portId] ?? '0').trim() || !Number.isFinite(Number(shownWeights[output.portId] ?? '0')) || Number(shownWeights[output.portId] ?? '0') < 0 || undefined} value={shownWeights[output.portId] ?? '0'} onChange={event => changeWeight(output.portId, event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel() } else if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); save() } }} /></label>
            {data.outputs.some(port => port.portId === output.portId) && <Handle type="source" position={Position.Right} id={output.portId} className={styles.handle} />}
          </div>)}
        </div>
      </section>
    </NodeResourceLayout>
    {advanced && <section className={`${styles.editor} nodrag nowheel`} aria-label={t('canvas.advanced_splitter_settings')}>
      <label>{t('canvas.resource_category')}<input value={shown.input.category} onChange={event => setResource('category', event.target.value)} /></label>
      <label>{t('canvas.resource_id')}<input value={shown.input.id} onChange={event => setResource('id', event.target.value)} /></label>
      <label>{t('canvas.throughput_limit')}<input type="number" min="0" step="any" placeholder={t('canvas.noLimit')} value={shown.capacity ?? ''} onChange={event => change({ ...shown, capacity: event.target.value === '' ? null : Number(event.target.value) })} /></label>
      <div className={styles.branchControls}>{shown.outputs.map((output, index) => <button type="button" key={output.portId} onClick={() => change({ ...shown, outputs: shown.outputs.filter(item => item.portId !== output.portId) })} aria-label={t('canvas.delete_branch', { p0: index + 1 })}><Icon name="minus" size={13} />  {t('canvas.branch')} {index + 1}</button>)}<button type="button" onClick={() => change({ ...shown, outputs: [...shown.outputs, { ...shown.input, portId: generateId(), ratio: 0 }] })}><Icon name="plus" size={13} />  {t('canvas.branch')}</button></div>
      <p>{t('canvas.splitter_weight_help')}</p>
    </section>}
    {(dirty || advanced) && <footer className={`${styles.actions} nodrag nopan`}>
      <span className={normalized.ok ? styles.total : styles.invalid}>{normalized.ok ? t('canvas.weights_valid') : weightError}</span>
      <button type="button" onClick={cancel}>{t('canvas.cancel')}</button><button type="button" onClick={save}>{t('canvas.save')}</button>
    </footer>}
    {error && <p role="alert" className={styles.error}>{translateDiagnostic(error)}</p>}

  </NodeFrame>
}
