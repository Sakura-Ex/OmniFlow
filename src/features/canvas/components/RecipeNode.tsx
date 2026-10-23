import { translateDiagnostic } from '@/common/i18n/translateDiagnostic'
import { categoryDisplayName } from '@/common/i18n/resourceLabels'
import { t, useTranslation } from '@/common/i18n'
import { Icon } from '@/common/components/Icon'
import { useDocumentEdit } from '@/common/components/DocumentEditContext'
import { usePlanningEditor } from '@/features/calculation/contexts/PlanningEditorContext'
import { portKey } from '@/features/calculation/topology'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { buildResourceId } from '@/common/utils/resourceId'
import { useSettingsStore } from '@/features/settings/settings.store'
import { UnitSystem } from '@/common/units/UnitSystem'
import { portIdentity } from '@/common/utils/ports'
import { Fragment, useLayoutEffect, type CSSProperties } from 'react'
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import { useRecipeEditor } from '@/features/recipe/contexts/RecipeEditorContext'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { previewModifierPipeline } from '@/features/modifier/modifier.pipeline'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { resolveCategoryDef } from '@/features/recipe/recipe.endpointNorm'
import { recipePortPresentation } from '@/features/canvas/recipePortPresentation'
import { formatProbability, formatMachineExact, formatCapEx } from '@/common/utils/format'
import type { ResourceIo, NormalizedResource } from '@/common/types/resource'
import styles from './RecipeNode.module.css'
import { groupPortsByCategory } from '../groupPortsByCategory'
import { GlobalPortIcon } from './GlobalPortIcon'
import { useNodeDisplayStore } from '@/features/settings/nodeDisplay.store'
import { NodeDetails, NodeCalculationStatus } from './NodePresentation'
import { PortPolicyBadge } from './PortPolicyBadge'
import { MachineLimit } from './MachineLimit'
import { modifierNameKeys } from '@/common/i18n/editorMessages'
import { getModifierById } from '@/features/modifier/modifier.registry'

/**
 * Present one recipe with readable resource flows and a compact installation summary.
 * @param props - React Flow node props.
 * @param props.id - Persistent node identity.
 * @param props.data - Editable recipe and verified presentation values.
 * @returns Recipe card with independent persistent resource handles.
 */
export function RecipeNode({ id, data }: NodeProps<RecipeNodeData>) {
  const mode = useNodeDisplayStore(state => state.mode)
  const commitEdit = useDocumentEdit()
  useTranslation()
  const { onEdit, onAutoFill } = useRecipeEditor()
  const openPlanning = usePlanningEditor()
  const portPolicies = useCanvasStore(state => state.networkConfiguration.ports)
  const categories = useGlobalResourceTable(state => state.categories)
  const resourceEntries = useGlobalResourceTable(state => state.entries)
  const overrides = useGlobalResourceTable(state => state.overrides)
  const recipe = useRecipeStore(state => state.recipes[id])
  const storedPayload = useRecipeStore(state => state.getPayload(id))
  const environment = useSettingsStore(state => state.units)
  const units = new UnitSystem(environment)
  const payload = storedPayload ?? previewModifierPipeline(data, environment)
  const updateNodeInternals = useUpdateNodeInternals()
  const handleSignature = JSON.stringify([payload.recipe_inputs, payload.recipe_outputs, payload.utility_inputs, payload.utility_outputs].map(ports => ports.map(port => [portIdentity(port), port.routing_mode ?? 'wired'])))
  useLayoutEffect(() => { updateNodeInternals(id) }, [id, handleSignature, mode, updateNodeInternals])
  const machineName = recipe?.machine_name ?? data.machine_name
  const implemented = recipe?.is_implemented ?? false
  const modifiers = recipe?.active_modifiers ?? data.active_modifiers ?? []
  const modifierNames = modifiers.map(modifier => { const key = modifierNameKeys[modifier.definition_id]; return key ? t(key) : getModifierById(modifier.definition_id)?.name ?? modifier.definition_id })
  const allPorts = [...payload.recipe_inputs, ...payload.recipe_outputs, ...payload.utility_inputs, ...payload.utility_outputs]
  const hasUtilities = payload.utility_inputs.length > 0 || payload.utility_outputs.length > 0

  const renderPorts = (resources: NormalizedResource[], direction: ResourceIo) => <ul className={styles.ports}>
    {groupPortsByCategory(resources).map((port, index, grouped) => {
      const portId = portIdentity(port)
      const category = resolveCategoryDef(port.utility_type ?? port.category, categories, overrides)
      const resourceName = resourceEntries[buildResourceId(port.category, port.id)]?.displayName || port.id
      const actual = data.port_throughputs?.[portId]
      const policy = portPolicies[portKey(id, portId)]
      const presentation = recipePortPresentation(port, payload, actual, units, category, policy?.semantics)
      const inventory = port.consumable === false || port.probability === 0
      const input = direction === 'input'
      const supply = policy?.boundary?.kind === 'source' ? policy.boundary : undefined
      const showSupply = input && !inventory && supply && (policy?.semantics.kind ?? 'flow') === 'flow'
      const supplyDescription = supply?.capacity === null
        ? t('canvas.sufficientSupplyStatus')
        : supply ? t('canvas.limitedSupplyStatus', { capacity: recipePortPresentation(port, payload, supply.capacity, units, category).rateValue }) : ''
      const previous = grouped[index - 1]
      const startsCategory = previous && (previous.utility_type ?? previous.category) !== (port.utility_type ?? port.category)
      return <Fragment key={portId}>{(!previous || startsCategory) && <li className={`${styles.categoryHeading}${startsCategory ? ` ${styles.categoryStart}` : ''}`} style={{ '--port-color': category.themeColor } as CSSProperties}>{categoryDisplayName(category.id, category.displayName)}</li>}<li className={`${styles.port} ${styles[mode]}`} style={{ '--port-color': category.themeColor } as CSSProperties}>
        {port.routing_mode === 'global'
          ? <GlobalPortIcon side={input ? 'left' : 'right'} />
          : <Handle id={portId} type={input ? 'target' : 'source'} position={input ? Position.Left : Position.Right} className={`${styles.handle} ${input ? styles.left : styles.right}`} />}
        <div className={styles.resourceIdentity}><span tabIndex={0} className={styles.resourceName} title={`${resourceName} (${port.id})`}>{resourceName || t('canvas.unnamed_resource')}</span>{inventory && <span className={styles.inventoryTag}>{t('canvas.inventory')}</span>}{showSupply && <span
          className={`${styles.supplyStatus} nodrag nopan`}
          role="img"
          tabIndex={0}
          aria-label={`${resourceName || t('canvas.this_input')}: ${supplyDescription}`}
          title={supplyDescription}
        ><Icon name={supply.capacity === null ? 'check' : 'boundary'} size={12} /></span>}</div>
        {mode !== 'compact' && <div className={styles.rate} title={actual === undefined ? t('shell.idle') : presentation.rate}><strong>{actual === undefined ? '—' : presentation.rateValue}</strong></div>}
        <div className={styles.policy}><PortPolicyBadge policy={policy} formatQuantity={presentation.formatQuantity} formatAmount={amount => recipePortPresentation(port, payload, amount, units, category).rateValue} /></div>
        {mode === 'detailed' && <div className={styles.portDetail} tabIndex={0} title={`${presentation.amount} · ${t('recipeDisplay.probability', { value: formatProbability(port.probability ?? 1) })}`}>{presentation.amount} · {t('recipeDisplay.probability', { value: formatProbability(port.probability ?? 1) })}</div>}

      </li></Fragment>
    })}
    {!resources.length && <li className={styles.empty}>{t('canvas.none')}</li>}
  </ul>

  return <article className={`${styles.card}${!payload.eligibility.eligible ? ` ${styles.blocked}` : ''}`}>
    <header className={styles.header}>
      <div className={styles.heading}><h2 title={machineName}>{machineName || t('canvas.unnamed_machine')}</h2></div>
      <div className={`${styles.headerActions} nodrag`}><button className={styles.editButton} onClick={() => commitEdit(() => useRecipeStore.getState().updateRecipe(id, { is_implemented: !implemented }))} aria-label={t('canvas.toggle_built_status')} aria-pressed={implemented} title={implemented ? t('canvas.remove_built_mark') : t('canvas.mark_built')}><Icon name="check" size={15} /></button><button className={styles.editButton} onClick={() => onAutoFill(id)} aria-label={t('canvas.fill_ports')} title={t('canvas.fill_unconnected_ports')}><Icon name="wand" size={15} /></button><button className={styles.editButton} onClick={() => openPlanning(id)} aria-label={t('canvas.supplyAndBoundaries')} title={t('canvas.supplyAndBoundaries')}><Icon name="boundary" size={15} /></button><button className={styles.editButton} onClick={() => onEdit(id, data)} aria-label={t('canvas.edit_recipe')} title={t('canvas.edit_recipe')}><Icon name="settings" /></button></div>
    </header>
    {!payload.eligibility.eligible && <div className={styles.warning} title={payload.eligibility.reasons.map(reason => translateDiagnostic(reason)).join('; ')}>{t('canvas.cannot_run')} {translateDiagnostic(payload.eligibility.reasons[0] ?? t('canvas.check_recipe_settings'))}</div>}
    <div className={styles.flowGroup}>
      <section className={styles.inputSection}><h3>{t('canvas.inputs')}</h3>{renderPorts(payload.recipe_inputs, 'input')}</section>
      <section className={styles.outputSection}><h3>{t('canvas.outputs')}</h3>{renderPorts(payload.recipe_outputs, 'output')}</section>
    </div>
    {hasUtilities && <div className={`${styles.flowGroup} ${styles.utilities}`}>
      <section className={styles.inputSection}><h3>{t('canvas.utility_inputs')}</h3>{renderPorts(payload.utility_inputs, 'input')}</section>
      <section className={styles.outputSection}><h3>{t('canvas.utility_outputs')}</h3>{renderPorts(payload.utility_outputs, 'output')}</section>
    </div>}
    <footer className={`${styles.footer} ${styles[mode]}`}>
      <div className={`${styles.machineSummary} ${styles[mode]}`}>
        <div className={styles.primaryCount}><span>{data.planned_installed === undefined && data.operating_equivalent !== undefined ? t('canvas.running') : t('recipeDisplay.installed')}</span><strong>{data.planned_installed !== undefined ? formatCapEx(data.planned_installed) : data.operating_equivalent !== undefined ? formatMachineExact(data.operating_equivalent) : '—'}</strong><small>{t('canvas.machines')}</small></div>
        {mode !== 'compact' && <div className={styles.auxiliaryCount}>{t('canvas.running')} <strong>{data.operating_equivalent === undefined ? '—' : formatMachineExact(data.operating_equivalent)}</strong>{mode === 'detailed' && <span> · {t('canvas.utilization')} {data.utilization == null ? '—' : formatProbability(data.utilization)}</span>}</div>}
        <MachineLimit id={id} />
      </div>
      {mode === 'detailed' && <div className={styles.modifiers}><span title={modifierNames.join(' → ')}>{t('recipeDisplay.cycle', { value: formatMachineExact(payload.duration_seconds) })} · {modifierNames[0] ?? t('canvas.none')}</span>{modifiers.length > 1 && <button className={`${styles.planningLink} nodrag`} onClick={() => onEdit(id, data)}>{t('recipeDisplay.more', { count: modifiers.length - 1 })}</button>}</div>}
      <div className={styles.bottomBar}><NodeCalculationStatus /><NodeDetails title={machineName || t('canvas.unnamed_machine')}>
        <p>{t('recipeDisplay.cycle', { value: formatMachineExact(payload.duration_seconds) })}</p>
        <p>{t('canvas.running_machines_installed_machines_utilization', { p0: data.operating_equivalent === undefined ? '—' : formatMachineExact(data.operating_equivalent), p1: data.planned_installed === undefined ? '—' : formatCapEx(data.planned_installed), p2: data.utilization == null ? '—' : formatProbability(data.utilization) })}</p>
        <dl className={styles.equipment}>
          <div><dt>{t('canvas.recommended_installation')}</dt><dd>{data.recommended_installed ?? '—'}</dd></div>
          <div><dt>{t('canvas.existing_equipment')}</dt><dd>{data.existing_installed ?? t('canvas.unconfirmed')}</dd></div>
          <div><dt>{t('canvas.additional_equipment')}</dt><dd>{data.additional_installed ?? t('canvas.unconfirmed')}</dd></div>
        </dl>
        <ul className={styles.coefficients}>{allPorts.map(port => {
          const category = resolveCategoryDef(port.utility_type ?? port.category, categories, overrides)
          const policy = portPolicies[portKey(id, portIdentity(port))]
          const presentation = recipePortPresentation(port, payload, data.port_throughputs?.[portIdentity(port)], units, category, policy?.semantics)
          return <li key={portIdentity(port)}><span>{port.id}<small>{port.routing_mode === 'global' ? `${t('canvas.global_bus')}: ${policy?.scopeId ?? 'document'} / ${policy?.busId ?? 'default'}` : portIdentity(port)}</small></span><span>{presentation.amount}<small>{data.port_throughputs?.[portIdentity(port)] === undefined ? t('shell.idle') : presentation.rate}</small><small>{t('recipeDisplay.probability', { value: formatProbability(port.probability ?? 1) })}</small><PortPolicyBadge policy={policy} formatQuantity={presentation.formatQuantity} formatAmount={amount => recipePortPresentation(port, payload, amount, units, category).rateValue} /></span></li>
        })}</ul>
        <p>{t('recipeDisplay.modifiers', { count: modifiers.length })}</p><ol>{modifierNames.map((name, index) => <li key={modifiers[index].instance_id}>{name}</li>)}</ol>
      </NodeDetails></div>
    </footer>
  </article>
}
