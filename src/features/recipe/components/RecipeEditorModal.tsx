import { useTranslation } from '@/common/i18n'
import { translateDiagnostic } from '@/common/i18n/translateDiagnostic'
import { Icon } from '@/common/components/Icon'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useMemo, useEffect } from 'react'
import { useForm, useFieldArray, FormProvider, useWatch } from 'react-hook-form'
import type { RecipeNodeData, ActiveModifier } from '@/common/types/recipe'
import type { Resource } from '@/common/types/resource'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { RecipeSettings } from '@/features/recipe/components/RecipeSettings'
import { previewModifierPipeline } from '@/features/modifier/modifier.pipeline'
import { ensureRecipeDataShape } from '@/features/modifier/modifier.normalize'
import { generateId } from '@/common/utils/id'
import { createDefaultModifierState } from '@/features/modifier/modifier.state'
import { applyArchetypeToInputs, getDefaultArchetypeIdForSystem, getMachineArchetype } from '@/data/archetypes/index'
import modalStyles from '@/common/components/Modal.module.css'
import styles from './RecipeEditorModal.module.css'

/** Form data shape for the recipe editor modal. */
export type RecipeFormData = {
  machine_name: string
  base_duration_seconds: number
  base_inputs: Resource[]
  base_outputs: Resource[]
  base_utility_inputs: Resource[]
  base_utility_outputs: Resource[]
  archetype_id: string
  active_modifiers: ActiveModifier[]
  hardware_specs: Record<string, unknown>
}

/** The node target for the recipe editor. */
type EditorTarget = {
  id: string
  data: RecipeNodeData
}

/** Props for the `RecipeEditorModal` component. */
type RecipeEditorModalProps = {
  node: EditorTarget | null
  onClose: () => void
  onSave: (id: string, data: RecipeNodeData) => void
}

/**
 * Build default form values from a node target and optional stored recipe data.
 * @param node - The editor target, or null.
 * @param stored - Optional stored recipe data to merge defaults from.
 * @returns A complete `RecipeFormData` with sensible defaults.
 */
function buildFormDefaults(node: EditorTarget | null, stored?: RecipeNodeData): RecipeFormData {
  if (!node && !stored) {
    return {
      machine_name: '',
      base_duration_seconds: 0,
      base_inputs: [],
      base_outputs: [],
      base_utility_inputs: [],
      base_utility_outputs: [],
      archetype_id: 'custom_generic',
      active_modifiers: [],
      hardware_specs: {},
    }
  }

  const source = ensureRecipeDataShape(stored ?? node!.data)
  return {
    machine_name: source.machine_name ?? '',
    base_duration_seconds: source.base_duration_seconds ?? source.duration_seconds ?? 0,
    base_inputs: (source.base_inputs ?? []).map((item) => ({ ...item })),
    base_outputs: (source.base_outputs ?? []).map((item) => ({ ...item })),
    base_utility_inputs: (source.base_utility_inputs ?? []).map((item) => ({ ...item })),
    base_utility_outputs: (source.base_utility_outputs ?? []).map((item) => ({ ...item })),
    archetype_id: source.archetype_id ?? getDefaultArchetypeIdForSystem(source.system ?? 'custom'),
    active_modifiers: (source.active_modifiers ?? []).map((m) => ({ ...m })),
    hardware_specs: source.hardware_specs ? { ...source.hardware_specs } : {},
  }
}

/**
 * Modal dialog for editing a recipe node's configuration.
 * Provides a full form with machine settings, resource I/O, modifier slots and real-time preview.
 *
 * @param root0 - Component props.
 * @param root0.node - The node target to edit, or null (modal hidden).
 * @param root0.onClose - Callback to dismiss the modal.
 * @param root0.onSave - Callback invoked with the node ID and assembled recipe data on save.
 * @returns Rendered JSX element for the recipe editor modal, or null when closed.
 */
export function RecipeEditorModal({ node, onClose, onSave }: RecipeEditorModalProps) {
  const { t } = useTranslation()
  const storedRecipe = useRecipeStore((state) => state.recipes[node?.id ?? ''])

  const methods = useForm<RecipeFormData>({
    defaultValues: buildFormDefaults(node, storedRecipe),
  })
  const { reset, handleSubmit, setValue, getValues } = methods

  const inputFields = useFieldArray({ control: methods.control, name: 'base_inputs' })
  const outputFields = useFieldArray({ control: methods.control, name: 'base_outputs' })
  const utilityInputFields = useFieldArray({ control: methods.control, name: 'base_utility_inputs' })
  const utilityOutputFields = useFieldArray({ control: methods.control, name: 'base_utility_outputs' })

  useEffect(() => {
    if (node) {
      const currentStored = useRecipeStore.getState().recipes[node.id]
      const defaults = buildFormDefaults(node, currentStored)
      reset(defaults)
    }
  }, [node, reset])

  const normalized = node ? ensureRecipeDataShape(node.data) : undefined
  const metadata = useMemo(() => normalized?.metadata ? { ...normalized.metadata } : {}, [normalized])

  const handleArchetypeChange = (nextArchetypeId: string) => {
    setValue('archetype_id', nextArchetypeId)

    const prevInputs = getValues('base_inputs')
    const prevUtilityInputs = getValues('base_utility_inputs')
    const prevUtilityOutputs = getValues('base_utility_outputs')

    const { materials, utilityInputs, utilityOutputs } = applyArchetypeToInputs(prevInputs, nextArchetypeId, metadata)

    inputFields.replace(materials)

    const userAddedInputs = prevUtilityInputs.filter((u) => !(u._uid?.startsWith('utility-')))
    const userAddedOutputs = prevUtilityOutputs.filter((u) => !(u._uid?.startsWith('utility-')))

    utilityInputFields.replace([...utilityInputs, ...userAddedInputs])
    utilityOutputFields.replace([...utilityOutputs, ...userAddedOutputs])

    const defaults = getMachineArchetype(nextArchetypeId).default_modifiers
    if (defaults.length > 0) {
      const currentActive = getValues('active_modifiers')
      const currentDefIds = new Set(currentActive.map((m) => m.definition_id))
      const newInstances = defaults
        .filter((d) => !currentDefIds.has(d))
        .map((d) => ({
          instance_id: generateId(),
          definition_id: d,
          uiState: createDefaultModifierState(d),
        }))
      if (newInstances.length > 0) {
        setValue('active_modifiers', [...currentActive, ...newInstances])
      }
    }
  }

  const isOpen = Boolean(node)

  const watchedArchetypeId = useWatch({ control: methods.control, name: 'archetype_id' })
  const watchedMachineName = useWatch({ control: methods.control, name: 'machine_name' })
  const watchedBaseDuration = useWatch({ control: methods.control, name: 'base_duration_seconds' })
  const watchedBaseInputs = useWatch({ control: methods.control, name: 'base_inputs' }) as Resource[]
  const watchedBaseOutputs = useWatch({ control: methods.control, name: 'base_outputs' }) as Resource[]
  const watchedBaseUtilityInputs = useWatch({ control: methods.control, name: 'base_utility_inputs' }) as Resource[]
  const watchedBaseUtilityOutputs = useWatch({ control: methods.control, name: 'base_utility_outputs' }) as Resource[]
  const watchedActiveModifiers = useWatch({ control: methods.control, name: 'active_modifiers' }) as ActiveModifier[]
  const watchedHardwareSpecs = useWatch({ control: methods.control, name: 'hardware_specs' }) as Record<string, unknown>

  const liveData = useMemo(() => {
    if (!node) return null
    return {
      ...node.data,
      machine_name: (watchedMachineName || '').trim() || 'Custom Machine',
      archetype_id: watchedArchetypeId,
      metadata,
      base_inputs: watchedBaseInputs,
      base_outputs: watchedBaseOutputs,
      base_utility_inputs: watchedBaseUtilityInputs,
      base_utility_outputs: watchedBaseUtilityOutputs,
      base_duration_seconds: Number(watchedBaseDuration) || 0,
      duration_seconds: Number(watchedBaseDuration) || 0,
      active_modifiers: watchedActiveModifiers,
      hardware_specs: watchedHardwareSpecs,
    }
  }, [
    node,
    watchedArchetypeId,
    watchedMachineName,
    watchedBaseDuration,
    watchedBaseInputs,
    watchedBaseOutputs,
    watchedBaseUtilityInputs,
    watchedBaseUtilityOutputs,
    watchedActiveModifiers,
    watchedHardwareSpecs,
    metadata,
  ])

  const environment = useSettingsStore((s) => s.units)
  const livePayload = useMemo(() => {
    if (!liveData) return null
    return previewModifierPipeline(liveData, environment)
  }, [liveData, environment])

  const allInputRates = useMemo(
    () => livePayload ? ([...livePayload.recipe_inputs, ...livePayload.utility_inputs] as Resource[]) : [],
    [livePayload]
  )
  const allOutputRates = useMemo(
    () => livePayload ? ([...livePayload.recipe_outputs, ...livePayload.utility_outputs] as Resource[]) : [],
    [livePayload]
  )

  const onSubmit = (formData: RecipeFormData) => {
    if (!node) return

    const assembled: RecipeNodeData = {
      ...node.data,
      machine_name: formData.machine_name.trim() || 'Custom Machine',
      archetype_id: formData.archetype_id,
      metadata,
      base_inputs: formData.base_inputs,
      base_outputs: formData.base_outputs,
      base_utility_inputs: formData.base_utility_inputs,
      base_utility_outputs: formData.base_utility_outputs,
      base_duration_seconds: Number(formData.base_duration_seconds) || 0,
      duration_seconds: Number(formData.base_duration_seconds) || 0,
      active_modifiers: formData.active_modifiers,
      hardware_specs: formData.hardware_specs,
    }

    const preview = previewModifierPipeline(assembled, environment)
    if (!preview.trace.length && !preview.eligibility.eligible) { alert(preview.eligibility.reasons.map(reason => translateDiagnostic(reason)).join('; ')); return }
    onSave(node.id, assembled)
  }

  if (!isOpen) return null

  return (
    <div className={modalStyles.overlay} role="presentation">
      <div className={`${modalStyles.panel} ${styles['recipe-editor__modal']}`} role="dialog" aria-modal="true" aria-labelledby="recipe-editor-title">
        <header className={modalStyles.header}>
          <div>
            <h3 id="recipe-editor-title" className={styles['recipe-editor__title']}>{t('editor.editRecipe')}</h3>
          </div>
          <button className={modalStyles.closeBtn} onClick={onClose} title={t('editor.close')}>
            <Icon name="close" />
          </button>
        </header>

        <div className={styles['recipe-editor__body']}>
          <FormProvider {...methods}>
            <RecipeSettings
              inputFields={inputFields}
              outputFields={outputFields}
              utilityInputFields={utilityInputFields}
              utilityOutputFields={utilityOutputFields}
              onArchetypeChange={handleArchetypeChange}
              previewDurationSeconds={livePayload?.duration_seconds ?? (watchedBaseDuration ?? 0)}
              previewInputRates={allInputRates}
              previewOutputRates={allOutputRates}
            />
          </FormProvider>
        </div>

        <footer className={styles['recipe-editor__footer']}>
          <button type="button" className={styles['recipe-editor__btn']} onClick={onClose}>{t('editor.cancel')}</button>
          <button type="button" className={`${styles['recipe-editor__btn']} ${styles['recipe-editor__btn--primary']}`} onClick={handleSubmit(onSubmit)}>{t('editor.saveRecipe')}</button>
        </footer>
      </div>
    </div>
  )
}
