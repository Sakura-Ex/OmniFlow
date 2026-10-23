import { translateDiagnostic } from '@/common/i18n/translateDiagnostic'
import { useDraftState } from '@/common/components/DraftStateContext'
import { documentKey } from '@/common/utils/saveBaseline'
import { categoryDisplayName } from '@/common/i18n/resourceLabels'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
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

const sectionLabels = { machines: 'settings.machines', boundaries: 'settings.boundaries', network: 'settings.network', optimization: 'settings.optimization' } as const

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
  const entries = useGlobalResourceTable(state => state.entries)
  const categories = useGlobalResourceTable(state => state.categories)
  const [section, setSection] = useState<'machines' | 'boundaries' | 'network' | 'optimization'>('boundaries')
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState(false)
  const dirty = documentKey(draft) !== documentKey(committed)
  const [error, setError] = useState<string | null>(null)
  const units = new UnitSystem(environment)
  const focused = nodes.find(node => node.id === nodeId)
  const title = focused?.type === 'sourceNode' ? t('canvas.supply_settings') : focused?.type === 'targetNode' ? t('canvas.demand_settings') : focused?.type === 'recipeNode' ? t('canvas.machine_settings') : t('canvas.production_settings')
  let ports: ReturnType<typeof graphPorts> = []
  let displayError = error
  try { ports = graphPorts(nodes, recipes, environment) } catch (failure) { displayError ??= failure instanceof Error ? failure.message : String(failure) }
  const visibleNodes = nodeId ? nodes.filter(node => node.id === nodeId) : nodes
  const recipeInputs = ports.filter(port => visibleNodes.some(node => node.id === port.nodeId && node.type === 'recipeNode') && port.direction === 'input' && port.port.amount > 0 && port.port.consumable !== false && port.port.probability !== 0 && (draft.ports[portKey(port.nodeId, port.portId)]?.semantics.kind ?? 'flow') === 'flow')
  const nodeName = (id: string): string => recipes[id]?.machine_name || nodes.find(node => node.id === id)?.data?.label || id
  const matches = (id: string, resource = '') => [id, nodeName(id), resource].join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  const scopedPorts = ports.filter(port => visibleNodes.some(node => node.id === port.nodeId))
  const filteredPorts = scopedPorts.filter(port => matches(port.nodeId, port.port.id + ' ' + port.port.category + ' ' + (entries[port.resourceId]?.displayName ?? '')))
  const machineNodes = visibleNodes.filter(node => node.type === 'recipeNode' && (matches(node.id) || filteredPorts.some(port => port.nodeId === node.id)))
  const patch = (key: string, value: NetworkPortConfiguration) => setDraft(previous => ({ ...previous, ports: { ...previous.ports, [key]: value } }))
  const save = () => {
    const parsed = NetworkConfigurationSchema.safeParse(draft)
    if (!parsed.success) { setError(parsed.error.issues.map(issue => `${issue.path.join('..')}: ${issue.message}`).join('\n')); return }
    takeSnapshot()
    useCanvasStore.getState().setNetworkConfiguration(parsed.data)
    setError(null)
    setApplied(true)
    if (!embedded) onClose()
  }
  const renderPort = (port: typeof ports[number], view: 'boundary' | 'network' | 'optimization') => {
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
    return <section key={key} className={styles.portRow} aria-label={port.port.id + ' · ' + nodeName(port.nodeId)}>
      <div className={styles.resourceName}><strong title={port.port.id}>{entries[port.resourceId]?.displayName || port.port.id}</strong><span>{port.direction === 'input' ? t('canvas.input_port') : t('canvas.output_port')}</span>{!nodeId && <small title={port.nodeId}>{nodeName(port.nodeId)} · {visibleNodes.findIndex(node => node.id === port.nodeId) + 1}</small>}</div>
      <div className={styles.portFields}>{view === 'network' ? networkFields : value.semantics.kind === 'flow' ? <BoundaryEditor direction={port.direction} supplyInput={port.direction === 'input' && nodes.some(node => node.id === port.nodeId && node.type === 'recipeNode')} value={convert(value.boundary, true)} unitLabel={unitLabel} mode={view} onChange={boundary => patch(key, { ...value, boundary: convert(boundary, false) })} /> : <span className={styles.hint}>{t('canvas.capacity_and_operating_state')}</span>}</div>
    </section>
  }
  const renderPorts = (items: typeof ports, view: 'boundary' | 'network' | 'optimization' = 'boundary') => {
    const groups = new Map<string, typeof ports>()
    for (const port of items) {
      const group = groups.get(port.port.category) ?? []
      group.push(port)
      groups.set(port.port.category, group)
    }
    return [...groups].sort(([a], [b]) => Object.keys(categories).indexOf(a) - Object.keys(categories).indexOf(b)).map(([category, group]) => <section key={category} className={styles.category}><h4>{categoryDisplayName(category, categories[category]?.displayName ?? category)}</h4>{group.map(port => renderPort(port, view))}</section>)
  }

  const suppliedInputs = filteredPorts.filter(port => recipeInputs.includes(port))
  const otherInputs = filteredPorts.filter(port => !recipeInputs.includes(port) && port.direction === 'input' && nodes.some(node => node.id === port.nodeId && node.type === 'recipeNode'))
  const remainingPorts = filteredPorts.filter(port => !suppliedInputs.includes(port) && !otherInputs.includes(port))
  const optimizationPorts = filteredPorts.filter(port => {
    const boundary = draft.ports[portKey(port.nodeId, port.portId)]?.boundary
    return boundary?.kind === 'source' || boundary?.kind === 'spill' || (boundary?.kind === 'delivery' && (boundary.mode === 'maximize' || boundary.objective !== undefined))
  })
  const count = section === 'machines' ? machineNodes.length : section === 'optimization' ? optimizationPorts.length : filteredPorts.length
  const network = <>{renderPorts(filteredPorts, 'network')}        {!nodeId && Object.keys(draft.ports).filter(key => !ports.some(port => portKey(port.nodeId, port.portId) === key)).map(key => <p key={key}>{t('canvas.obsolete_configuration')} {key} <button onClick={() => setDraft(previous => { const next = { ...previous.ports }; delete next[key]; return { ...previous, ports: next } })}>{t('canvas.remove')}</button></p>)}</>
  const optimization = <>{!nodeId && <section className={styles.group}>        <label className={styles.check}><input type="checkbox" checked={Boolean(draft.minimizeMachines)} onChange={event => setDraft(previous => ({ ...previous, minimizeMachines: event.target.checked ? { priority: 1, weight: 1, scale: 1 } : undefined }))} />{t('canvas.customize_the_priority_of_minimizing_machine_operation')}</label>
        {draft.minimizeMachines && <div className={styles.fields}>{(['priority', 'weight', 'scale'] as const).map(field => <label key={field}>{{ priority: t('canvas.priority_lower_first'), weight: t('canvas.weight'), scale: t('canvas.normalization_scale') }[field]}<input type="number" value={draft.minimizeMachines![field]} onChange={event => { const next = Number(event.target.value); setDraft(previous => ({ ...previous, minimizeMachines: { ...previous.minimizeMachines!, [field]: next } })) }} /></label>)}</div>}</section>}{renderPorts(optimizationPorts, 'optimization')}</>
  return <div className={embedded ? styles.embeddedHost : modal.overlay}><section role={embedded ? undefined : 'dialog'} aria-modal={embedded ? undefined : true} aria-labelledby={embedded ? undefined : 'planning-title'} className={(embedded ? styles.embedded : modal.panel) + ' ' + styles.dialog} onKeyDown={event => { if (event.key === 'Escape' && !embedded) onClose() }}>
    {!embedded && <header className={styles.header}><div><h3 id="planning-title">{title}</h3>{nodeId && <p>{nodeName(nodeId)}</p>}</div><button aria-label={t('canvas.close_settings')} onClick={onClose}><Icon name="close" /></button></header>}
    {!nodeId && <div className={styles.toolbar}>
      <nav className={styles.sections} aria-label={t('settings.production')}>{(['machines', 'boundaries', 'network', 'optimization'] as const).map(item => <button key={item} aria-current={section === item ? 'page' : undefined} onClick={() => setSection(item)}>{t(sectionLabels[item])}</button>)}</nav>
      <div className={styles.search}><input type="search" aria-label={t('settings.search')} placeholder={t('settings.search')} value={search} onChange={event => setSearch(event.target.value)} />{search && <button aria-label={t('settings.clearSearch')} onClick={() => setSearch('')}><Icon name="close" /></button>}<span role="status">{t('settings.matching', { count })}</span></div>
    </div>}
    <div className={styles.body}>
      {displayError && <p role="alert" className={styles.error}>{translateDiagnostic(displayError)}</p>}
      {(nodeId || section === 'machines') && <>{machineNodes.map(node => <section key={node.id} className={styles.machine}><h4 title={node.id}>{nodeId ? t('settings.machines') : nodeName(node.id)}{!nodeId && <small> · {visibleNodes.findIndex(item => item.id === node.id) + 1}</small>}</h4><div className={styles.machineFields}>{(['installed', 'existing', 'operatingUpper'] as const).map(field => <label key={field}>{field === 'installed' ? t('canvas.planned_installation') : field === 'existing' ? t('canvas.existing_machines') : t('canvas.operating_limit')}<input type="number" min="0" step={field === 'operatingUpper' ? 'any' : '1'} placeholder={field === 'installed' ? t('canvas.automatic_recommendation') : field === 'existing' ? t('canvas.not_registered') : t('canvas.noLimit')} value={draft.machines[node.id]?.[field] ?? ''} onChange={event => { const next = event.target.value; setDraft(previous => ({ ...previous, machines: { ...previous.machines, [node.id]: { ...(previous.machines[node.id] ?? { installed: null, operatingUpper: null }), [field]: next === '' ? field === 'existing' ? undefined : null : Number(next) } } })) }} /></label>)}</div></section>)}</>}
      {(nodeId || section === 'boundaries') && <>
        {suppliedInputs.length > 0 && <section className={styles.group}><header className={styles.groupHeader}><h3>{t('canvas.input_supply')}</h3><button title={t('canvas.only_unconnected_ordinary_inputs_without_conditions_are')} onClick={() => setDraft(previous => supplyUnconnectedInputs(suppliedInputs, visibleNodes, edges, previous))}>{t(nodeId ? 'canvas.provide_sufficient_supply_to_unconnected_inputs' : 'settings.supplyVisible')}</button></header>{renderPorts(suppliedInputs)}</section>}
        {otherInputs.length > 0 && <section className={styles.group}><h3>{t('settings.otherPorts')}</h3>{renderPorts(otherInputs)}</section>}
        {remainingPorts.length > 0 && <section className={styles.group}><h3>{t(focused?.type === 'recipeNode' ? 'settings.outputs' : 'settings.boundaries')}</h3>{renderPorts(remainingPorts)}</section>}
      </>}
      {nodeId ? <><details className={styles.advanced}><summary>{t('settings.network')}</summary>{network}</details>{optimizationPorts.length > 0 && <details className={styles.advanced}><summary>{t('settings.optimization')}</summary>{optimization}</details>}</> : <>{section === 'network' && network}{section === 'optimization' && optimization}{count === 0 && <p className={styles.hint}>{t('settings.noMatches')}</p>}</>}
    </div>
    <footer className={styles.footer}><span role="status">{dirty ? t('settings.pending') : applied ? t('settings.applied') : ''}</span><button onClick={() => { if (embedded) { setDraft(structuredClone(useCanvasStore.getState().networkConfiguration)); setError(null); setApplied(false) } else onClose() }}>{t(embedded ? 'settings.reset' : 'canvas.cancel')}</button><button className={styles.primary} onClick={save}>{t('settings.apply')}</button></footer>
  </section></div>
}
