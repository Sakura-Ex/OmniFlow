import { translateDiagnostic } from '@/common/i18n/translateDiagnostic'
import { useDraftState } from '@/common/components/DraftStateContext'
import { documentKey } from '@/common/utils/saveBaseline'
import { t, useTranslation } from '@/common/i18n'
import { Icon } from '@/common/components/Icon'
import { useState } from 'react'
import { Combobox } from '@/common/components/Combobox'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useSettingsStore } from '@/features/settings/settings.store'
import { UnitSystem } from '@/common/units/UnitSystem'
import { defaultResourceUnit } from '@/common/units/defaults'
import { buildUnitSuffix } from '@/features/resource-registry/registry.units'
import { graphPorts } from '../graphPorts'
import { portKey } from '../topology'
import { NetworkConfigurationSchema, type NetworkPortConfiguration, type Boundary } from '../networkConfig'
import { BoundaryEditor } from './BoundaryEditor'
import { supplyUnconnectedInputs } from '../inputSupply'
import modal from '@/common/components/Modal.module.css'
import styles from './BoundaryEditor.module.css'

/**
 * Edit a supply, demand or machine locally, retaining advanced network settings.
 * @param props - Editor props.
 * @param props.nodeId - Optional node to focus.
 * @param props.onClose - Dismiss the editor.
 * @param props.takeSnapshot - Capture undo before applying the draft.
 * @param props.embedded - Keep the editor inside the full settings page.
 * @returns A focused planning dialog.
 */
export function NetworkConfigurationEditor({ nodeId, onClose, takeSnapshot, embedded }: { nodeId?: string; onClose: () => void; takeSnapshot: () => void; embedded?: boolean }) {
  useTranslation()
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const recipes = useRecipeStore(s => s.recipes)
  const environment = useSettingsStore(s => s.units)
  const [draft, setDraft] = useState(() => structuredClone(useCanvasStore.getState().networkConfiguration))
  const committed = useCanvasStore(state => state.networkConfiguration)
  useDraftState(documentKey(draft) !== documentKey(committed))
  const [error, setError] = useState<string | null>(null)
  const units = new UnitSystem(environment)
  const focused = nodes.find(node => node.id === nodeId)
  const title = focused?.type === 'sourceNode' ? t('canvas.supply_settings') : focused?.type === 'targetNode' ? t('canvas.demand_settings') : focused?.type === 'recipeNode' ? t('canvas.machine_settings') : t('canvas.production_settings')
  let ports: ReturnType<typeof graphPorts> = []
  let displayError = error
  try { ports = graphPorts(nodes, recipes, environment) } catch (failure) { displayError ??= failure instanceof Error ? failure.message : String(failure) }
  const visibleNodes = nodeId ? nodes.filter(node => node.id === nodeId) : nodes
  const recipeInputs = ports.filter(port => visibleNodes.some(node => node.id === port.nodeId && node.type === 'recipeNode') && port.direction === 'input' && port.port.amount > 0 && port.port.consumable !== false && port.port.probability !== 0 && (draft.ports[portKey(port.nodeId, port.portId)]?.semantics.kind ?? 'flow') === 'flow')
  const patch = (key: string, value: NetworkPortConfiguration) => setDraft(previous => ({ ...previous, ports: { ...previous.ports, [key]: value } }))
  const save = () => {
    const parsed = NetworkConfigurationSchema.safeParse(draft)
    if (!parsed.success) { setError(parsed.error.issues.map(issue => `${issue.path.join('..')}: ${issue.message}`).join('\n')); return }
    takeSnapshot()
    useCanvasStore.getState().setNetworkConfiguration(parsed.data)
    setError(null)
    if (!embedded) onClose()
  }
  const renderPort = (port: typeof ports[number], endpoint: boolean) => {
    const key = portKey(port.nodeId, port.portId)
    const value = draft.ports[key] ?? { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' as const } }
    const expression = port.port.displayUnit ?? port.port.unit ?? defaultResourceUnit(port.port.category, port.port.id)
    const unitLabel = buildUnitSuffix(expression, 'rate_per_sec', units)
    const convert = (boundary: Boundary | undefined, toDisplay: boolean): Boundary | undefined => {
      if (!boundary || boundary.kind === 'forbid_spill') return boundary
      const amount = (rate: number) => toDisplay ? units.fromRate(rate, expression, 'rate_per_sec') : units.toRate(rate, expression, 'rate_per_sec', 1)
      return { ...boundary, capacity: boundary.capacity === null ? null : amount(boundary.capacity), ...(boundary.kind === 'delivery' ? { amount: amount(boundary.amount) } : {}) }
    }
    const networkFields = <>        <div className={styles.fields}>
          <label>{t('canvas.resource_purpose')}<Combobox aria-label={t('canvas.resourcePurposeForPort', { p0: port.port.id })} value={value.semantics.kind} onChange={selected => patch(key, { ...value, boundary: undefined, semantics: selected === 'capacity' ? { kind: 'capacity', available: 0 } : selected === 'state' ? { kind: 'state', actual: 0 } : { kind: 'flow' } })} options={[{ value: 'flow', label: t('canvas.flow_conserved') }, { value: 'capacity', label: t('canvas.shared_capacity') }, { value: 'state', label: t('canvas.fixed_operating_state') }]} /></label>
          {value.semantics.kind === 'capacity' && <label>{t('canvas.available_capacity_standard_units')}<input type="number" min="0" step="any" value={value.semantics.available} onChange={event => patch(key, { ...value, semantics: { kind: 'capacity', available: Number(event.target.value) } })} /></label>}
          {value.semantics.kind === 'state' && (['actual', 'minimum', 'maximum'] as const).map(field => <label key={field}>{{ actual: t('canvas.actual_operating_state'), minimum: t('canvas.minimum_requirement'), maximum: t('canvas.maximum_requirement') }[field]}<input type="number" step="any" value={value.semantics.kind === 'state' ? value.semantics[field] ?? '' : ''} onChange={event => value.semantics.kind === 'state' && patch(key, { ...value, semantics: { ...value.semantics, [field]: event.target.value === '' && field !== 'actual' ? undefined : Number(event.target.value) } })} /></label>)}
          <label>{t('canvas.global_scope')}<input value={value.scopeId} onChange={event => patch(key, { ...value, scopeId: event.target.value })} /></label>
          <label>{t('canvas.global_bus')}<input value={value.busId} onChange={event => patch(key, { ...value, busId: event.target.value })} /></label>
        </div>
        <button className={styles.subtle} onClick={() => setDraft(previous => { const next = { ...previous.ports }; delete next[key]; return { ...previous, ports: next } })}>{t('canvas.restore_closed_port')}</button>
</>
    return <section key={key} className={styles.portCard}>
      <h4>{port.port.id} <span>{endpoint ? port.direction === 'output' ? t('canvas.supply') : t('canvas.demand') : port.direction === 'input' ? t('canvas.input_port') : t('canvas.output_port')}</span></h4>
      {value.semantics.kind === 'flow' ? <BoundaryEditor direction={port.direction} supplyInput={port.direction === 'input' && nodes.some(node => node.id === port.nodeId && node.type === 'recipeNode')} value={convert(value.boundary, true)} unitLabel={unitLabel} advanced={networkFields} onChange={boundary => patch(key, { ...value, boundary: convert(boundary, false) })} /> : <details className={styles.advanced} open><summary>{t('canvas.capacity_and_operating_state')}</summary>{networkFields}</details>}
    </section>
  }
  return <div className={embedded ? styles.embeddedHost : modal.overlay}><section role={embedded ? undefined : 'dialog'} aria-modal={embedded ? undefined : true} aria-labelledby={embedded ? undefined : 'planning-title'} className={`${embedded ? styles.embedded : modal.panel} ${styles.dialog}`} onKeyDown={event => { if (event.key === 'Escape' && !embedded) onClose() }}>
    {!embedded && <header className={styles.header}><div><h3 id="planning-title">{title}</h3></div><button aria-label={t('canvas.close_settings')} onClick={onClose}><Icon name="close" /></button></header>}
    <div className={styles.body}>
      {displayError && <p role="alert" className={styles.error}>{translateDiagnostic(displayError)}</p>}
      {recipeInputs.length > 0 && <details className={styles.machine} open={Boolean(nodeId)}><summary>{t('canvas.input_supply')}</summary><button title={t('canvas.only_unconnected_ordinary_inputs_without_conditions_are')} onClick={() => setDraft(previous => supplyUnconnectedInputs(recipeInputs, visibleNodes, edges, previous))}>{t('canvas.provide_sufficient_supply_to_unconnected_inputs')}</button>{recipeInputs.map(port => <div key={portKey(port.nodeId, port.portId)}>{!nodeId && <p className={styles.hint}>{recipes[port.nodeId]?.machine_name || t('canvas.machine')}</p>}{renderPort(port, false)}</div>)}</details>}
      {visibleNodes.filter(node => node.type === 'sourceNode' || node.type === 'targetNode').map(node => <div key={node.id}>{ports.filter(port => port.nodeId === node.id).map(port => renderPort(port, true))}</div>)}
      {visibleNodes.filter(node => node.type === 'recipeNode').map(node => <details key={node.id} className={styles.machine} open={Boolean(nodeId)}><summary>{recipes[node.id]?.machine_name || t('canvas.machine')}  {t('canvas.installed_count')}</summary><div className={styles.fields}>{(['installed', 'existing', 'operatingUpper'] as const).map(field => <label key={field}>{field === 'installed' ? t('canvas.planned_installation') : field === 'existing' ? t('canvas.existing_machines') : t('canvas.operating_limit')}<input type="number" min="0" step={field === 'operatingUpper' ? 'any' : '1'} placeholder={field === 'installed' ? t('canvas.automatic_recommendation') : field === 'existing' ? t('canvas.not_registered') : t('canvas.noLimit')} value={draft.machines[node.id]?.[field] ?? ''} onChange={event => { const next = event.target.value; setDraft(previous => ({ ...previous, machines: { ...previous.machines, [node.id]: { ...(previous.machines[node.id] ?? { installed: null, operatingUpper: null }), [field]: next === '' ? field === 'existing' ? undefined : null : Number(next) } } })) }} /></label>)}</div></details>)}
      {(!focused || focused.type === 'recipeNode' || focused.type === 'splitterNode') && <details className={styles.advanced}><summary>{t('canvas.more_constraints_and_objectives')}</summary>
        {ports.filter(port => !recipeInputs.includes(port) && visibleNodes.some(node => node.id === port.nodeId && node.type !== 'sourceNode' && node.type !== 'targetNode')).map(port => renderPort(port, false))}
        {Object.keys(draft.ports).filter(key => !ports.some(port => portKey(port.nodeId, port.portId) === key)).map(key => <p key={key}>{t('canvas.obsolete_configuration')} {key} <button onClick={() => setDraft(previous => { const next = { ...previous.ports }; delete next[key]; return { ...previous, ports: next } })}>{t('canvas.remove')}</button></p>)}
        <label className={styles.check}><input type="checkbox" checked={Boolean(draft.minimizeMachines)} onChange={event => setDraft(previous => ({ ...previous, minimizeMachines: event.target.checked ? { priority: 1, weight: 1, scale: 1 } : undefined }))} />{t('canvas.customize_the_priority_of_minimizing_machine_operation')}</label>
        {draft.minimizeMachines && <div className={styles.fields}>{(['priority', 'weight', 'scale'] as const).map(field => <label key={field}>{{ priority: t('canvas.priority_lower_first'), weight: t('canvas.weight'), scale: t('canvas.normalization_scale') }[field]}<input type="number" value={draft.minimizeMachines![field]} onChange={event => { const next = Number(event.target.value); setDraft(previous => ({ ...previous, minimizeMachines: { ...previous.minimizeMachines!, [field]: next } })) }} /></label>)}</div>}
      </details>}
    </div>
    <footer className={styles.footer}><button onClick={() => { if (embedded) { setDraft(structuredClone(useCanvasStore.getState().networkConfiguration)); setError(null) } else onClose() }}>{t(embedded ? 'settings.reset' : 'canvas.cancel')}</button><button className={styles.primary} onClick={save}>{t('canvas.save_settings')}</button></footer>
  </section></div>
}
