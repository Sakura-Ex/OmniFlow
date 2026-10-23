import { categoryDisplayName, archetypeDisplayName } from '@/common/i18n/resourceLabels'
import { modifierNameKeys } from '@/common/i18n/editorMessages'
import { t, useTranslation } from '@/common/i18n'
import { Icon } from '@/common/components/Icon'
import { useMemo, useState, useRef, useCallback, type CSSProperties } from 'react'
import { useFormContext } from 'react-hook-form'
import { useClickOutside } from '@/hooks/useClickOutside'
import { toggleRouting } from '@/common/utils/routing'
import { generateId } from '@/common/utils/id'
import { DEFAULT_RESOURCE_CATEGORY } from '@/common/utils/resourceId'
import type { UseFieldArrayReturn } from 'react-hook-form'
import type { RecipeFormData } from '@/features/recipe/components/RecipeEditorModal'
import type { ActiveModifier } from '@/common/types/recipe'
import type { Resource } from '@/common/types/resource'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { listModifiers } from '@/features/modifier/modifier.registry'
import { createDefaultModifierState } from '@/features/modifier/modifier.state'
import { ModifierCardShell } from '@/features/recipe/components/ModifierCardShell'
import { GT_VOLTAGE_TIERS, computePowerPool, normalizeGtHatches } from '@/features/modifier/modifiers/gregtech/gtPower'
import type { GtEnergyHatch } from '@/features/modifier/modifiers/gregtech/gtPower'
import { getMachineArchetype, machineArchetypes } from '@/data/archetypes'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { ResourceDefinitionList } from '@/features/resource-registry/components/ResourceDefinitionList'
import { RECIPE_INPUT_COLUMNS, RECIPE_OUTPUT_COLUMNS, UTILITY_COLUMNS } from '@/features/resource-registry/components/ResourceDefinitionRow.config'
import { formatOpExRate } from '@/common/utils/format'
import editorStyles from './RecipeSettings.module.css'
import layoutStyles from '@/features/recipe/components/RecipeEditorModal.module.css'
import { Combobox } from '@/common/components/Combobox'

/**
 *
 */
type RecipeSettingsProps = {
  inputFields: UseFieldArrayReturn<RecipeFormData, 'base_inputs', 'id'>
  outputFields: UseFieldArrayReturn<RecipeFormData, 'base_outputs', 'id'>
  utilityInputFields: UseFieldArrayReturn<RecipeFormData, 'base_utility_inputs', 'id'>
  utilityOutputFields: UseFieldArrayReturn<RecipeFormData, 'base_utility_outputs', 'id'>
  onArchetypeChange?: (nextId: string) => void
  previewDurationSeconds: number
  previewInputRates: Resource[]
  previewOutputRates: Resource[]
}

/**
 * Format a duration value into a human-readable string.
 * @param value - The duration in seconds.
 * @returns A formatted duration string (e.g. `"5.00s"`) or `"Instant"` for non-positive values.
 */
function formatDuration(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return t('canvas.invalid_duration')
  return `${formatOpExRate(value)}s`
}

/**
 * Build a map of resource key to total amount from a resource array.
 * @param rates - Array of resources with `category`, `id`, and `amount`.
 * @returns A map of `"category:id"` to total amount.
 */
function buildRateMap(rates: Resource[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const rate of rates) {
    if (!rate.id) continue
    const key = rate.portId ?? ''
    map.set(key, (map.get(key) ?? 0) + rate.amount)
  }
  return map
}

/**
 * A sortable wrapper for a modifier card, enabling drag-and-drop reordering.
 * @param root0 - Component props.
 * @param root0.id - The unique sortable identifier.
 * @param root0.children - The card content to render.
 * @returns Rendered JSX for the sortable modifier card wrapper.
 */
function SortableModifierCard({ id, children }: { id: string; children: React.ReactNode }) {
  useTranslation()
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
    listeners,
    attributes,
  } = useSortable({ id })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    position: 'relative',
    width: '100%',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <span className={editorStyles['recipe-settings__modifier-drag-handle']} {...listeners}>
        <Icon name="more" size={16} />
      </span>
      {children}
    </div>
  )
}

/**
 * Main settings panel for the recipe editor.
 * Provides a three-column layout for configuring recipe inputs, machine core (archetype,
 * duration, hardware specs, utility I/O, modifier slots with drag-and-drop reordering),
 * and recipe outputs. Integrates real-time preview of calculated rates and power consumption.
 *
 * @param props - Component props
 * @param props.inputFields - Field array controller for recipe base inputs
 * @param props.outputFields - Field array controller for recipe base outputs
 * @param props.utilityInputFields - Field array controller for utility inputs
 * @param props.utilityOutputFields - Field array controller for utility outputs
 * @param props.onArchetypeChange - Optional callback invoked when the archetype selection changes
 * @param props.previewDurationSeconds - Computed preview duration after modifiers
 * @param props.previewInputRates - Computed input resource rates for preview display
 * @param props.previewOutputRates - Computed output resource rates for preview display
 * @returns Rendered JSX element for the recipe settings UI.
 */
export function RecipeSettings(props: RecipeSettingsProps) {
  const { locale } = useTranslation()
  const {
    inputFields,
    outputFields,
    utilityInputFields,
    utilityOutputFields,
    onArchetypeChange,
    previewDurationSeconds,
    previewInputRates,
    previewOutputRates,
  } = props

  const { watch, setValue, getValues } = useFormContext<RecipeFormData>()

  const modifiers = listModifiers()
  const archetypeId = watch('archetype_id')
  const archetype = getMachineArchetype(archetypeId)
  const resourceIndex = useGlobalResourceTable((state) => state.entries)
  const registryCategories = useGlobalResourceTable((state) => state.categories)

  const baseInputs = watch('base_inputs') as Resource[]
  const baseOutputs = watch('base_outputs') as Resource[]
  const baseUtilityInputs = watch('base_utility_inputs') as Resource[]
  const baseUtilityOutputs = watch('base_utility_outputs') as Resource[]
  const machineName = watch('machine_name')
  const baseDurationSeconds = watch('base_duration_seconds')
  const activeModifiers = watch('active_modifiers') as ActiveModifier[]
  const hardwareSpecs = watch('hardware_specs') as Record<string, unknown> | undefined

  const emptyResource = useCallback((): Resource => ({
    category: DEFAULT_RESOURCE_CATEGORY,
    id: '',
    amount: 1,
    time_base: 'per_cycle',
    routing_mode: 'wired',
    routing_locked: false,
    _uid: generateId(),
    portId: generateId(),
  }), [])

  const categoryOptions = useMemo(
    () => Object.values(registryCategories).map((cat) => ({ id: cat.id, displayName: categoryDisplayName(cat.id, cat.displayName, locale) })),
    [registryCategories, locale]
  )
  const resourceSuggestions = useMemo(() => Object.keys(resourceIndex), [resourceIndex])
  const [modifierPopoverOpen, setModifierPopoverOpen] = useState(false)
  const [utilityEditorOpen, setUtilityEditorOpen] = useState(false)
  const modifierPopoverRef = useRef<HTMLDivElement | null>(null)

  useClickOutside(modifierPopoverRef, () => setModifierPopoverOpen(false), modifierPopoverOpen)

  const inputRateMap = useMemo(() => buildRateMap(previewInputRates), [previewInputRates])
  const outputRateMap = useMemo(() => buildRateMap(previewOutputRates), [previewOutputRates])
  const availableModifiers = useMemo(
    () => modifiers.filter((modifier) => {
      const count = activeModifiers.filter((m) => m.definition_id === modifier.id).length
      const maxP = modifier.max_placements ?? 1
      if (count >= maxP) return false
      const allowed = modifier.compatible_archetypes
      if (!allowed || allowed.length === 0) return true
      return allowed.includes(archetypeId)
    }),
    [modifiers, activeModifiers, archetypeId]
  )
  const defaultModifierSet = useMemo(() => new Set(archetype.default_modifiers), [archetype.default_modifiers])

  const handleUpdateInput = useCallback((index: number, patch: Partial<Resource>) => {
    const current = getValues('base_inputs')[index]
    if (!current) return
    const merged = { ...current, ...patch }
    if (patch.category && patch.category !== current.category) {
      const catDef = registryCategories[patch.category]
      if (catDef?.preferred_time_base) {
        merged.time_base = catDef.preferred_time_base
      }
    }
    inputFields.update(index, merged)
  }, [inputFields, registryCategories, getValues])

  const handleUpdateOutput = useCallback((index: number, patch: Partial<Resource>) => {
    const current = getValues('base_outputs')[index]
    if (!current) return
    outputFields.update(index, { ...current, ...patch })
  }, [outputFields, getValues])

  const handleAddInput = useCallback(() => {
    inputFields.append(emptyResource())
  }, [inputFields, emptyResource])

  const handleAddOutput = useCallback(() => {
    outputFields.append(emptyResource())
  }, [outputFields, emptyResource])

  const handleRemoveInput = useCallback((index: number) => {
    inputFields.remove(index)
  }, [inputFields])

  const handleRemoveOutput = useCallback((index: number) => {
    outputFields.remove(index)
  }, [outputFields])

  const handleToggleInputRouting = useCallback((index: number) => {
    const current = getValues('base_inputs')[index]
    if (!current || current.routing_locked) return
    inputFields.update(index, toggleRouting(current))
  }, [inputFields, getValues])

  const handleToggleOutputRouting = useCallback((index: number) => {
    const current = getValues('base_outputs')[index]
    if (!current || current.routing_locked) return
    outputFields.update(index, toggleRouting(current))
  }, [outputFields, getValues])

  const handleUpdateUtilityMerged = useCallback((index: number, patch: Partial<Resource>) => {
    const inputValues = getValues('base_utility_inputs')
    const outputValues = getValues('base_utility_outputs')
    if (index < inputValues.length) {
      const current = inputValues[index]
      if (!current) return
      const merged = { ...current, ...patch }
      if (patch.category && patch.category !== current.category) {
        const catDef = registryCategories[patch.category]
        if (catDef?.preferred_time_base) {
          merged.time_base = catDef.preferred_time_base
        }
      }
      utilityInputFields.update(index, merged)
    } else {
      const outIndex = index - inputValues.length
      const current = outputValues[outIndex]
      if (!current) return
      utilityOutputFields.update(outIndex, { ...current, ...patch })
    }
  }, [utilityInputFields, utilityOutputFields, registryCategories, getValues])

  const handleAddUtilityInput = useCallback(() => {
    setUtilityEditorOpen(true)
    utilityInputFields.append(emptyResource())
  }, [utilityInputFields, emptyResource, setUtilityEditorOpen])

  const handleRemoveUtilityMerged = useCallback((index: number) => {
    const inputValues = getValues('base_utility_inputs')
    if (index < inputValues.length) {
      utilityInputFields.remove(index)
    } else {
      utilityOutputFields.remove(index - inputValues.length)
    }
  }, [utilityInputFields, utilityOutputFields, getValues])

  const handleToggleUtilityRoutingMerged = useCallback((index: number) => {
    const inputValues = getValues('base_utility_inputs')
    const outputValues = getValues('base_utility_outputs')
    if (index < inputValues.length) {
      const current = inputValues[index]
      if (!current || current.routing_locked) return
      utilityInputFields.update(index, toggleRouting(current))
    } else {
      const outIndex = index - inputValues.length
      const current = outputValues[outIndex]
      if (!current || current.routing_locked) return
      utilityOutputFields.update(outIndex, toggleRouting(current))
    }
  }, [utilityInputFields, utilityOutputFields, getValues])

  const utilityItems = useMemo(() => [
    ...baseUtilityInputs.map((r) => ({ ...r, is_utility_output: false })),
    ...baseUtilityOutputs.map((r) => ({ ...r, is_utility_output: true })),
  ], [baseUtilityInputs, baseUtilityOutputs])

  const handleToggleUtilityIO = useCallback((index: number) => {
    const inputValues = getValues('base_utility_inputs')
    if (index < inputValues.length) {
      const item = { ...inputValues[index] }
      utilityInputFields.remove(index)
      utilityOutputFields.append(item)
    } else {
      const outIndex = index - inputValues.length
      const outputValues = getValues('base_utility_outputs')
      const item = { ...outputValues[outIndex] }
      utilityOutputFields.remove(outIndex)
      utilityInputFields.append(item)
    }
  }, [utilityInputFields, utilityOutputFields, getValues])

  const addModifier = (modifierId: string) => {
    const currentActive = getValues('active_modifiers') as ActiveModifier[]
    const modifier = modifiers.find((m) => m.id === modifierId)
    const maxP = modifier?.max_placements ?? 1
    const count = currentActive.filter((m) => m.definition_id === modifierId).length
    if (count >= maxP) return
    const newInstance: ActiveModifier = {
      instance_id: generateId(),
      definition_id: modifierId,
      uiState: createDefaultModifierState(modifierId),
    }
    setValue('active_modifiers', [...currentActive, newInstance])
    setModifierPopoverOpen(false)
  }

  const removeModifier = (instanceId: string) => {
    const currentActive = getValues('active_modifiers') as ActiveModifier[]
    setValue('active_modifiers', currentActive.filter((m) => m.instance_id !== instanceId))
  }

  const moveModifier = (fromIndex: number, toIndex: number) => {
    const currentActive = getValues('active_modifiers') as ActiveModifier[]
    setValue('active_modifiers', arrayMove(currentActive, fromIndex, toIndex))
  }

  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    if (!over || active.id === over.id) return
    const currentActive = getValues('active_modifiers') as ActiveModifier[]
    const oldIndex = currentActive.findIndex((m) => m.instance_id === active.id)
    const newIndex = currentActive.findIndex((m) => m.instance_id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    moveModifier(oldIndex, newIndex)
  }

  const setModifierValue = (instanceId: string, key: string, value: unknown) => {
    const currentActive = getValues('active_modifiers') as ActiveModifier[]
    setValue('active_modifiers', currentActive.map((m) =>
      m.instance_id === instanceId
        ? { ...m, uiState: { ...m.uiState, [key]: value } }
        : m
    ))
  }

  const setHardwareSpecsValue = (key: string, value: unknown) => {
    const currentSpecs = getValues('hardware_specs') ?? {}
    setValue('hardware_specs', { ...currentSpecs, [key]: value })
  }

  const es = editorStyles

  return (
    <div className={layoutStyles.settingsLayout}>
      <div className={layoutStyles.settingsStack}>
        <section className={`${es['recipe-settings__column']} ${layoutStyles.settingsSection}`} aria-label={t('canvas.inputs')}>
          <h4>{t('canvas.inputs')}</h4>
          <ResourceDefinitionList<Resource>
            items={baseInputs}
            columns={RECIPE_INPUT_COLUMNS}
            emptyMessage={t('canvas.no_input_resources')}
            addLabel={t('canvas.add_input')}
            onUpdateItem={handleUpdateInput}
            onAddItem={handleAddInput}
            onRemoveItem={handleRemoveInput}
            onToggleRoutingItem={handleToggleInputRouting}
            rateMap={inputRateMap}
            suggestions={resourceSuggestions}
            categoryOptions={categoryOptions}
            probabilityLabel={t('canvas.consumption_probability')}
          />
        </section>

        <section className={`${es['recipe-settings__column']} ${layoutStyles.settingsSection}`} aria-label={t('canvas.outputs')}>
          <h4>{t('canvas.outputs')}</h4>
          <ResourceDefinitionList<Resource>
            items={baseOutputs}
            columns={RECIPE_OUTPUT_COLUMNS}
            emptyMessage={t('canvas.no_output_resources')}
            addLabel={t('canvas.add_output')}
            onUpdateItem={handleUpdateOutput}
            onAddItem={handleAddOutput}
            onRemoveItem={handleRemoveOutput}
            onToggleRoutingItem={handleToggleOutputRouting}
            rateMap={outputRateMap}
            suggestions={resourceSuggestions}
            categoryOptions={categoryOptions}
            probabilityLabel={t('canvas.production_probability')}
          />
        </section>

      </div>
      <div className={layoutStyles.settingsStack}>
        <section className={`${es['recipe-settings__column']} ${es['recipe-settings__column--core']} ${layoutStyles.settingsSection}`}>
          <h4>{t('canvas.machine_properties')}</h4>

          <label className={es['recipe-editor__field']}>
            <span>{t('canvas.machine_archetype')}</span>
            <Combobox value={archetypeId} aria-label={t('canvas.machine_archetype')} options={machineArchetypes.map(item => ({ value: item.id, label: archetypeDisplayName(item.id, item.name) }))} onChange={value => { if (onArchetypeChange) onArchetypeChange(value); else setValue('archetype_id', value) }} />
          </label>

          <label className={es['recipe-editor__field']}>
            <span>{t('canvas.machine_name')}</span>
            <input type="text" value={machineName} onChange={(e) => setValue('machine_name', e.target.value)} />
          </label>

          <label className={es['recipe-editor__field']}>
            <span>{t('canvas.base_duration_s')}</span>
            <div className={`${es['recipe-editor__row']} ${es['recipe-editor__row--utility-no-buttons']}`}>
              <span className={es['recipe-editor__row-label']}>{t('canvas.duration')}</span>
              <div className={es['recipe-editor__input-wrap']}>
                <input
                  type="number"
                  min={0}
                  step={0.05}
                  value={baseDurationSeconds}
                  onChange={(e) => setValue('base_duration_seconds', Number(e.target.value) || 0)}
                />
                <span className={es['recipe-editor__input-suffix']}>s</span>
              </div>
              <span></span>
              <span className={es['recipe-editor__row-rate']}>{formatDuration(previewDurationSeconds)}</span>
            </div>
          </label>

          {archetype.traits && Object.keys(archetype.traits).length > 0 && (
            <div className={es['recipe-settings__modifier-pool']}>
              <h5>{t('canvas.hardware_parameters')}</h5>
              {Object.entries(archetype.traits).map(([traitKey, traitDef]) => {
                if (traitKey === 'energyHatches') {
                  const hatchRows = normalizeGtHatches({ energyHatches: hardwareSpecs?.energyHatches ?? traitDef.default })
                  const { totalEuPerTick, highestTier } = computePowerPool(hatchRows)

                  const updateHatchRows = (nextRows: GtEnergyHatch[]) => {
                    setHardwareSpecsValue('energyHatches', nextRows)
                  }

                  return (
                    <div key={traitKey}>
                      <span className={es['recipe-settings__utility-label-text']}>{traitKey === 'energyHatches' ? t('canvas.energyHatches') : traitDef.label}</span>
                      <div className={es['recipe-settings__hatch-table']} style={{ marginTop: 6 }}>
                        {hatchRows.map((row, rowIndex) => (
                          <div className={es['recipe-settings__hatch-row']} key={`hs-hatch-${rowIndex}`}>
                            <Combobox
                              aria-label={traitKey === 'energyHatches' ? t('canvas.energyHatches') : traitDef.label}
                              value={row.tier}
                              options={GT_VOLTAGE_TIERS.map(tier => ({ value: tier.id, label: `${tier.id} (${tier.euPerAmp} EU/A)` }))}
                              onChange={value => {
                                const nextRows = hatchRows.map((entry, idx) => (idx === rowIndex ? { ...entry, tier: value } : entry))
                                updateHatchRows(nextRows)
                              }}
                            />
                            <div className={es['recipe-editor__input-wrap']}>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={row.amps}
                                onChange={(e) => {
                                  const nextRows = hatchRows.map((entry, idx) => (idx === rowIndex ? { ...entry, amps: Number(e.target.value) || 0 } : entry))
                                  updateHatchRows(nextRows)
                                }}
                              />
                              <span className={es['recipe-editor__input-suffix']}>A</span>
                            </div>
                            <button
                              className={`${es['recipe-editor__icon-action']} ${es['recipe-editor__icon-action--danger']}`}
                              type="button"
                              onClick={() => {
                                const nextRows = hatchRows.filter((_, idx) => idx !== rowIndex)
                                updateHatchRows(nextRows.length > 0 ? nextRows : [{ tier: 'LV', amps: 1 }])
                              }}
                              title={t('canvas.delete_energy_hatch')}
                              aria-label={t('canvas.delete_energy_hatch')}
                            >
                              <Icon name="close" size={14} />
                            </button>
                          </div>
                        ))}
                        <button
                          className={`${es['recipe-editor__btn']} ${es['recipe-editor__btn--ghost']}`}
                          type="button"
                          onClick={() => updateHatchRows(hatchRows.concat({ tier: 'LV', amps: 1 }))}
                        >
                          <Icon name="plus" size={14} />  {t('canvas.add_energy_hatch')}
                        </button>
                      </div>
                      <div className={es['recipe-settings__multiblock-summary']} style={{ marginTop: 6 }}>
                        <span><Icon name="bolt" size={14} />  {t('canvas.total_energy_pool')} {totalEuPerTick} EU/t {highestTier !== 'N/A' ? `(${highestTier})` : ''}</span>
                      </div>
                    </div>
                  )
                }
                return (
                  <div className={es['recipe-settings__control']} key={traitKey}>
                    <span>{traitKey === 'energyHatches' ? t('canvas.energyHatches') : traitDef.label}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>{JSON.stringify(hardwareSpecs?.[traitKey] ?? traitDef.default)}</span>
                  </div>
                )
              })}
            </div>
          )}

          <div className={es['recipe-settings__modifier-pool']}>
            <h5>{t('canvas.utility_usage')}</h5>
            {utilityItems.length === 0 ? <>
              <p className={es['recipe-editor__empty']}>{t('canvas.no_utilities')}</p>
              <button className={`${es['recipe-editor__btn']} ${es['recipe-editor__btn--ghost']}`} type="button" onClick={handleAddUtilityInput}><Icon name="plus" />  {t('canvas.add_utility')}</button>
            </> : <>
              {utilityItems.map((item, index) => <p className={es['recipe-editor__empty']} key={item.portId ?? index}>
                {item.is_utility_output ? t('canvas.outputs') : t('canvas.inputs')} · {item.id || t('canvas.unnamed_resource')}
              </p>)}
              <details open={utilityEditorOpen} onToggle={event => setUtilityEditorOpen(event.currentTarget.open)}>
                <summary className={es['recipe-settings__utility-label-text']}><span className={es.summaryIcon}><Icon name="chevronRight" size={13} /></span>  {t('canvas.edit_utility_usage')}</summary>
                <ResourceDefinitionList<Resource & Record<string, unknown>>
              items={utilityItems}
              columns={UTILITY_COLUMNS}
              emptyMessage={t('canvas.no_fixed_utilities_in_this_archetype')}
              addLabel={t('canvas.add_utility')}
              onUpdateItem={handleUpdateUtilityMerged}
              onAddItem={handleAddUtilityInput}
              onRemoveItem={handleRemoveUtilityMerged}
              onToggleRoutingItem={handleToggleUtilityRoutingMerged}
              onIoTToggleItem={handleToggleUtilityIO}
              rateMap={inputRateMap}
              categoryOptions={categoryOptions}
              getCanDelete={(i) => !(utilityItems[i]?._uid?.startsWith('utility-'))}
              getAmountLocked={(i) => !(utilityItems[i]?.amount_mutable)}
              getRoutingLocked={(i) => utilityItems[i]?.routing_locked ?? false}
              getCategoryLocked={(i) => utilityItems[i]?._uid?.startsWith('utility-') ?? false}
              getIdLocked={(i) => utilityItems[i]?._uid?.startsWith('utility-') ?? false}
              getTimeBaseLocked={(i) => utilityItems[i]?._uid?.startsWith('utility-') ?? false}
              getProbabilityLocked={(i) => utilityItems[i]?._uid?.startsWith('utility-') ?? false}
              getIoToggleLocked={(i) => utilityItems[i]?._uid?.startsWith('utility-') ?? false}
                />
              </details>
            </>}
          </div>

          <details className={layoutStyles.advancedSettings}>
            <summary><span className={es.summaryIcon}><Icon name="chevronRight" size={13} /></span>  {t('canvas.advanced_how_usage_scales_with_equipment')}</summary>
            {([
              ['base_inputs', t('canvas.recipe_inputs')], ['base_outputs', t('canvas.recipe_outputs')],
              ['base_utility_inputs', t('canvas.facilityInputs')], ['base_utility_outputs', t('canvas.facilityOutputs')],
            ] as const).flatMap(([group, label]) => (watch(group) ?? []).map((port, index) => (
              <label className={layoutStyles.scalingField} key={port.portId ?? group + index}>
                <span>{label} · {port.id || t('canvas.unnamed_resource')}</span>
                <Combobox value={port.scaling ?? 'per_cycle'} aria-label={t('canvas.scaling_mode', { p0: label, p1: port.id || t('canvas.unnamed_resource') })} onChange={value => setValue(group, getValues(group).map((item, i) => i === index ? { ...item, scaling: value as Resource['scaling'] } : item), { shouldDirty: true })}
                  options={[{ value: 'per_cycle', label: t('canvas.per_recipe_cycle') }, { value: 'per_parallel_slot', label: t('canvas.per_parallel_slot') }, { value: 'per_running_machine', label: t('canvas.per_running_machine') }, { value: 'per_installed_machine', label: t('canvas.per_installed_machine_fixed_load') }]} />
              </label>
            )))}
          </details>

        </section>
        <section className={`${es['recipe-settings__column']} ${layoutStyles.settingsSection}`} aria-label={t('canvas.modifiers')}>
          <h4>{t('canvas.modifiers')}</h4>
          <div className={es.modifierControls}>
            <div className={es['recipe-settings__modifier-adder']}>
              <button
                className={`${es['recipe-editor__btn']} ${es['recipe-editor__btn--ghost']} ${es['recipe-editor__btn--full']}`}
                type="button"
                disabled={availableModifiers.length === 0}
                onClick={() => setModifierPopoverOpen((prev) => !prev)}
              >
                <Icon name="plus" size={14} />  {t('canvas.add_modifier')}
              </button>
              {modifierPopoverOpen && availableModifiers.length > 0 && (
                <div className={es['recipe-settings__modifier-popover']} ref={modifierPopoverRef}>
                  {availableModifiers.map((modifier) => (
                    <button
                      key={modifier.id}
                      className={es['recipe-settings__modifier-popover-item']}
                      type="button"
                      onClick={() => addModifier(modifier.id)}
                    >
                      {modifierNameKeys[modifier.id] ? t(modifierNameKeys[modifier.id]!) : modifier.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {activeModifiers.length === 0 && !modifierPopoverOpen && <p className={es['recipe-editor__empty']}>{t('canvas.no_modifiers_installed')}</p>}
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <SortableContext items={activeModifiers.map((m) => m.instance_id)} strategy={verticalListSortingStrategy}>
              {activeModifiers.map((m) => {
                const rawModifier = modifiers.find((mod) => mod.id === m.definition_id)
                if (!rawModifier) return null
                const modifier = rawModifier
                const isFixedModifier = defaultModifierSet.has(m.definition_id)

                const state = {
                  ...createDefaultModifierState(m.definition_id),
                  ...(m.uiState ?? {}),
                }

                return (
                  <SortableModifierCard key={m.instance_id} id={m.instance_id}>
                    <ModifierCardShell
                      modifier={modifier}
                      state={state}
                      isFixedModifier={isFixedModifier}
                      onRemove={() => removeModifier(m.instance_id)}
                      onChange={(key, value) => setModifierValue(m.instance_id, key, value)}
                      recipeInputs={baseInputs}
                      recipeOutputs={baseOutputs}
                      hardwareSpecs={hardwareSpecs}
                    />
                  </SortableModifierCard>
                )
              })}
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeDragId && (() => {
                const dragInstance = activeModifiers.find((m) => m.instance_id === activeDragId)
                if (!dragInstance) return null
                const overlayModifier = modifiers.find((mod) => mod.id === dragInstance.definition_id)
                if (!overlayModifier) return null
                const overlayState = {
                  ...createDefaultModifierState(dragInstance.definition_id),
                  ...(dragInstance.uiState ?? {}),
                }
                return (
                  <div className={editorStyles.dragPreview}>
                    <ModifierCardShell
                      modifier={overlayModifier}
                      state={overlayState}
                      isFixedModifier={defaultModifierSet.has(dragInstance.definition_id)}
                      onRemove={() => {}}
                      onChange={() => {}}
                      readOnly
                      recipeInputs={baseInputs}
                      recipeOutputs={baseOutputs}
                      hardwareSpecs={hardwareSpecs}
                    />
                  </div>
                )
              })()}
            </DragOverlay>
          </DndContext>
        </section>

      </div>
    </div>
  )
}
