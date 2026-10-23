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

/**
 * Present one recipe with readable resource flows and a compact installation summary.
 * @param props - React Flow node props.
 * @param props.id - Persistent node identity.
 * @param props.data - Editable recipe and verified presentation values.
 * @returns Recipe card with independent persistent resource handles.
 */
export function RecipeNode({ id, data }: NodeProps<RecipeNodeData>) {
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
  useLayoutEffect(() => { updateNodeInternals(id) }, [id, handleSignature, updateNodeInternals])
  const machineName = recipe?.machine_name ?? data.machine_name
  const implemented = recipe?.is_implemented ?? false
  const allPorts = [...payload.recipe_inputs, ...payload.recipe_outputs, ...payload.utility_inputs, ...payload.utility_outputs]
  const hasUtilities = payload.utility_inputs.length > 0 || payload.utility_outputs.length > 0

  const renderPorts = (resources: NormalizedResource[], direction: ResourceIo) => <ul className={styles.ports}>
    {groupPortsByCategory(resources).map((port, index, grouped) => {
      const portId = portIdentity(port)
      const category = resolveCategoryDef(port.utility_type ?? port.category, categories, overrides)
      const resourceName = resourceEntries[buildResourceId(port.category, port.id)]?.displayName || port.id
      const actual = data.port_throughputs?.[portId]
      const presentation = recipePortPresentation(port, payload, actual, units, category)
      const inventory = port.consumable === false || port.probability === 0
      const input = direction === 'input'
      const policy = portPolicies[portKey(id, portId)]
      const supply = policy?.boundary?.kind === 'source' ? policy.boundary : undefined
      const showSupply = input && !inventory && supply && (policy?.semantics.kind ?? 'flow') === 'flow'
      const supplyDescription = supply?.capacity === null
        ? t('canvas.sufficientSupplyStatus')
        : supply ? t('canvas.limitedSupplyStatus', { capacity: recipePortPresentation(port, payload, supply.capacity, units, category).rateValue }) : ''
      const previous = grouped[index - 1]
      const startsCategory = previous && (previous.utility_type ?? previous.category) !== (port.utility_type ?? port.category)
      return <Fragment key={portId}>{(!previous || startsCategory) && <li className={`${styles.categoryHeading}${startsCategory ? ` ${styles.categoryStart}` : ''}`} style={{ '--port-color': category.themeColor } as CSSProperties}>{categoryDisplayName(category.id, category.displayName)}</li>}<li className={styles.port} style={{ '--port-color': category.themeColor } as CSSProperties}>
        {port.routing_mode === 'global'
          ? <GlobalPortIcon side={input ? 'left' : 'right'} />
          : <Handle id={portId} type={input ? 'target' : 'source'} position={input ? Position.Left : Position.Right} className={`${styles.handle} ${input ? styles.left : styles.right}`} />}
        <div className={styles.resourceIdentity}><span className={styles.resourceName} title={`${resourceName} (${port.id})`}>{resourceName || t('canvas.unnamed_resource')}</span>{inventory && <span className={styles.inventoryTag}>{t('canvas.inventory')}</span>}{showSupply && <span
          className={`${styles.supplyStatus} nodrag nopan`}
          role="img"
          tabIndex={0}
          aria-label={`${resourceName || t('canvas.this_input')}: ${supplyDescription}`}
          title={supplyDescription}
        ><Icon name={supply.capacity === null ? 'check' : 'download'} size={12} /></span>}</div>
        <div className={styles.rate} title={presentation.rate}><strong aria-label={presentation.rate}>{presentation.rateValue}</strong></div>

      </li></Fragment>
    })}
    {!resources.length && <li className={styles.empty}>{t('canvas.none')}</li>}
  </ul>

  return <article className={`${styles.card}${!payload.eligibility.eligible ? ` ${styles.blocked}` : ''}`}>
    <header className={styles.header}>
      <div className={styles.heading}><h2 title={machineName}>{machineName || t('canvas.unnamed_machine')}</h2></div>
      <div className={`${styles.headerActions} nodrag`}><button className={styles.editButton} onClick={() => commitEdit(() => useRecipeStore.getState().updateRecipe(id, { is_implemented: !implemented }))} aria-label={t('canvas.toggle_built_status')} aria-pressed={implemented} title={implemented ? t('canvas.remove_built_mark') : t('canvas.mark_built')}><Icon name="check" size={15} /></button><button className={styles.editButton} onClick={() => onAutoFill(id)} aria-label={t('canvas.fill_ports')} title={t('canvas.fill_unconnected_ports')}><Icon name="wand" size={15} /></button><button className={styles.editButton} onClick={() => openPlanning(id)} aria-label={t('canvas.supplyAndBoundaries')} title={t('canvas.supplyAndBoundaries')}><Icon name="download" size={15} /></button><button className={styles.editButton} onClick={() => onEdit(id, data)} aria-label={t('canvas.edit_recipe')} title={t('canvas.edit_recipe')}><Icon name="settings" /></button></div>
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
    <footer className={styles.footer}>
      <dl className={styles.summary} title={t('canvas.running_machines_installed_machines_utilization', { p0: data.operating_equivalent === undefined ? '—' : formatMachineExact(data.operating_equivalent), p1: data.planned_installed === undefined ? '—' : formatCapEx(data.planned_installed), p2: data.utilization == null ? '—' : formatProbability(data.utilization) })}>
        <div><dt>{t('canvas.running')}</dt><dd>{data.operating_equivalent === undefined ? '—' : formatMachineExact(data.operating_equivalent)}<small>  {t('canvas.machines')}</small></dd></div>
        <div><dt><button className={`${styles.planningLink} nodrag`} onClick={() => openPlanning(id)}>{t('canvas.installation_settings')}</button></dt><dd>{data.planned_installed === undefined ? '—' : formatCapEx(data.planned_installed)}<small>  {t('canvas.machines')}</small></dd></div>
        <div><dt>{t('canvas.utilization')}</dt><dd>{data.utilization === undefined || data.utilization === null ? '—' : formatProbability(data.utilization)}</dd></div>
      </dl>
      <details className={`${styles.details} nodrag`}>
        <summary><span className={styles.summaryIcon}><Icon name="chevronRight" size={13} /></span>  {t('canvas.equipment_and_permachine_usage')}</summary>
        <dl className={styles.equipment}>
          <div><dt>{t('canvas.recommended_installation')}</dt><dd>{data.recommended_installed ?? '—'}</dd></div>
          <div><dt>{t('canvas.existing_equipment')}</dt><dd>{data.existing_installed ?? t('canvas.unconfirmed')}</dd></div>
          <div><dt>{t('canvas.additional_equipment')}</dt><dd>{data.additional_installed ?? t('canvas.unconfirmed')}</dd></div>
        </dl>
        <ul className={styles.coefficients}>{allPorts.map(port => {
          const category = resolveCategoryDef(port.utility_type ?? port.category, categories, overrides)
          const presentation = recipePortPresentation(port, payload, undefined, units, category)
          return <li key={portIdentity(port)}><span title={port.id}>{port.id}</span><span>{presentation.amount}</span></li>
        })}</ul>
      </details>
    </footer>
  </article>
}
