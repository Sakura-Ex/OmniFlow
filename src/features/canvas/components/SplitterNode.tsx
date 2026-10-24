import { translateDiagnostic } from '@/common/i18n/translateDiagnostic'
import { categoryDisplayName } from '@/common/i18n/resourceLabels'
import { t, useTranslation } from '@/common/i18n'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { resolveCategoryDef } from '@/features/recipe/recipe.endpointNorm'
import { Icon } from '@/common/components/Icon'
import { stripCalculationResults } from '@/common/utils/calculationState'
import { useEffect, useState, type CSSProperties } from 'react'
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from 'reactflow'
import { SplitterNodeDataSchema, type SplitterNodeData } from '@/common/schemas/splitter.schema'
import { generateId } from '@/common/utils/id'
import { useNodeData } from '@/features/canvas/contexts/NodeDataContext'
import styles from './SplitterNode.module.css'
import { useNodeDisplayStore } from '@/features/settings/nodeDisplay.store'
import { NodeDetails } from './NodePresentation'
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
  const units = new UnitSystem(environment)
  const [advanced, setAdvanced] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [draft, setDraft] = useState(() => stripCalculationResults(data))
  const [error, setError] = useState('')
  const shown = dirty || advanced ? draft : data
  const category = resolveCategoryDef(shown.input.category, categories, overrides)
  const categoryColor = { '--port-color': category.themeColor } as CSSProperties
  const outputIdentities = JSON.stringify(shown.outputs.map(output => output.portId))
  useEffect(() => updateNodeInternals(id), [id, outputIdentities, displayMode, updateNodeInternals])
  const change = (next: SplitterNodeData) => { setDraft(next); setDirty(true); setError('') }
  const setResource = (field: 'id' | 'category', value: string) => change({ ...shown, input: { ...shown.input, [field]: value }, outputs: shown.outputs.map(output => ({ ...output, [field]: value })) })
  const cancel = () => { setDraft(stripCalculationResults(data)); setDirty(false); setAdvanced(false); setError('') }
  const save = () => {
    const parsed = SplitterNodeDataSchema.safeParse(stripCalculationResults(draft))
    if (!parsed.success) { setError(parsed.error.issues.map(issue => issue.message === 'Splitter ratios must sum to one' ? t('canvas.ratios_must_total_100') : issue.message).join('; ')); return }
    updateNodeData(id, parsed.data)
    setDraft(parsed.data); setDirty(false); setAdvanced(false); setError('')
  }
  const total = shown.outputs.reduce((sum, output) => sum + output.ratio, 0)
  const totalValid = Math.abs(total - 1) <= 1e-8
  const inputRate = data.port_throughputs?.[data.input.portId]
  const resourceName = entries[buildResourceId(shown.input.category, shown.input.id)]?.displayName || shown.input.id
  const expression = shown.input.displayUnit ?? shown.input.unit ?? defaultResourceUnit(shown.input.category, shown.input.id)
  const suffix = buildUnitSuffix(expression, 'rate_per_sec', units)
  const rate = (value: number | undefined) => value === undefined ? '—' : formatOpExRate(units.fromRate(value, expression, 'rate_per_sec'))
  return <article className={styles.node} data-display-mode={displayMode}>
    <header className={styles.header}>
      <strong>{t('canvas.splitter')}</strong>
      <NodeDetails title={t('canvas.splitter')}><dl>
        <dt>{t('canvas.resource_id')}</dt><dd>{resourceName} · {shown.input.category} / {shown.input.id}</dd>
        <dt>{t('canvas.throughput_limit')}</dt><dd>{shown.capacity === null ? t('canvas.unlimited') : `${rate(shown.capacity)} ${suffix}`}</dd>
        <dt>{t('canvas.actual_flow')}</dt><dd>{rate(inputRate)} {suffix}</dd>
        {shown.outputs.map((output, index) => <div key={output.portId}><dt>{t('canvas.branch')} {index + 1}</dt><dd>{Number((output.ratio * 100).toPrecision(12))}% · {rate(data.port_throughputs?.[output.portId])} {suffix}<br />{output.portId}</dd></div>)}
      </dl></NodeDetails>
      <button type="button" className={`${styles.iconButton} nodrag nopan`} aria-label={t('canvas.splitter_settings')} aria-expanded={advanced} title={t('canvas.resource_throughput_limit_and_branches')} onClick={() => { if (!dirty) setDraft(stripCalculationResults(data)); setAdvanced(!advanced); setError('') }}><Icon name="settings" size={15} /></button>
    </header>
    <div className={styles.flow}>
      <section className={styles.input}><h3>{t('canvas.inputs')}</h3>
        <div className={styles.categoryHeading} style={categoryColor}>{categoryDisplayName(category.id, category.displayName)}</div>
        <div className={styles.inputPort} title={t('canvas.throughput_limit_standard_unitss', { p0: shown.input.category, p1: shown.input.id, p2: shown.capacity ?? t('canvas.unlimited') })}>
          <Handle type="target" position={Position.Left} id={shown.input.portId} className={styles.handle} />
          <div className={styles.resourceRow}>
            <span tabIndex={0} className={styles.resource} title={`${resourceName} (${shown.input.id})`}>{resourceName || t('canvas.select_resource')}</span>
            {displayMode !== 'compact' && <span className={styles.throughput} title={`${rate(inputRate)} ${suffix}`}>{rate(inputRate)} {suffix}</span>}
          </div>
          <div className={styles.capacity} title={`${t('canvas.throughput_limit')} ${shown.capacity === null ? t('canvas.unlimited') : `${rate(shown.capacity)} ${suffix}`}`}>{(displayMode === 'detailed' || shown.capacity !== null) && <>{t('canvas.throughput_limit')} {shown.capacity === null ? t('canvas.unlimited') : `${rate(shown.capacity)} ${suffix}`}</>}</div>
          {displayMode === 'detailed' && <span className={styles.identity} tabIndex={0} title={shown.input.portId}>{shown.input.portId}</span>}
        </div>
      </section>
      <section className={styles.output}><h3>{t('canvas.output_ratios')}</h3>
        <div className={styles.categoryHeading} style={categoryColor}>{categoryDisplayName(category.id, category.displayName)}</div>
        {shown.outputs.map((output, index) => <div className={styles.outputPort} key={output.portId} title={t('canvas.branch_standard_unitss', { p0: index + 1, p1: data.port_throughputs?.[output.portId]?.toPrecision(5) ?? '—' })}>
          <div className={styles.resourceRow}>
            <span tabIndex={0} className={styles.resource} title={`${resourceName} (${shown.input.id})`}>{resourceName || t('canvas.select_resource')}</span>
            {displayMode !== 'compact' && <span className={styles.throughput} title={`${rate(data.port_throughputs?.[output.portId])} ${suffix}`}>{rate(data.port_throughputs?.[output.portId])} {suffix}</span>}
          </div>
          <label className={styles.ratioLabel}><span>{t('canvas.branch')} {index + 1}</span><input className="nodrag nopan" aria-label={t('canvas.branch_percentage', { p0: index + 1 })} type="number" min="0" max="100" step="any" value={Number((output.ratio * 100).toPrecision(12))} onChange={event => change({ ...shown, outputs: shown.outputs.map(item => item.portId === output.portId ? { ...item, ratio: Number(event.target.value) / 100 } : item) })} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel() } else if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); save() } }} /><span>%</span></label>
          {displayMode === 'detailed' && <span className={styles.identity} tabIndex={0} title={output.portId}>{output.portId}</span>}
          {data.outputs.some(port => port.portId === output.portId) && <Handle type="source" position={Position.Right} id={output.portId} className={styles.handle} />}
        </div>)}
      </section>
    </div>
    {advanced && <section className={`${styles.editor} nodrag nowheel`} aria-label={t('canvas.advanced_splitter_settings')}>
      <label>{t('canvas.resource_category')}<input value={shown.input.category} onChange={event => setResource('category', event.target.value)} /></label>
      <label>{t('canvas.resource_id')}<input value={shown.input.id} onChange={event => setResource('id', event.target.value)} /></label>
      <label>{t('canvas.throughput_limit')}<input type="number" min="0" step="any" placeholder={t('canvas.noLimit')} value={shown.capacity ?? ''} onChange={event => change({ ...shown, capacity: event.target.value === '' ? null : Number(event.target.value) })} /></label>
      <div className={styles.branchControls}>{shown.outputs.map((output, index) => <button type="button" key={output.portId} onClick={() => change({ ...shown, outputs: shown.outputs.filter(item => item.portId !== output.portId) })} aria-label={t('canvas.delete_branch', { p0: index + 1 })}><Icon name="minus" size={13} />  {t('canvas.branch')} {index + 1}</button>)}<button type="button" onClick={() => change({ ...shown, outputs: [...shown.outputs, { ...shown.input, portId: generateId(), ratio: 0 }] })}><Icon name="plus" size={13} />  {t('canvas.branch')}</button></div>
      <p>{t('canvas.ratios_must_total_100_deleted_ports_leave')}</p>
    </section>}
    {(dirty || advanced) && <footer className={`${styles.actions} nodrag nopan`}>
      <span className={totalValid ? styles.total : styles.invalid}>{t('canvas.total')} {Number((total * 100).toPrecision(12))}%</span>
      <button type="button" onClick={cancel}>{t('canvas.cancel')}</button><button type="button" onClick={save}>{t('canvas.save')}</button>
    </footer>}
    {error && <p role="alert" className={styles.error}>{translateDiagnostic(error)}</p>}

  </article>
}
