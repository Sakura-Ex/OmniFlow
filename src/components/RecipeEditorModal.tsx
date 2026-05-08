import { useMemo, useEffect } from 'react'
import { useForm, useFieldArray, FormProvider } from 'react-hook-form'
import type { RecipeNodeData } from '../types/recipe'
import type { Resource } from '../types/types'
import { useRecipeStore } from '../stores/recipeStore'
import { SettingsUI } from './SettingsUI'
import { ensureRecipeDataShape, runModifierPipeline } from '../modifiers/calculate'
import { createDefaultModifierState } from '../modifiers/state'
import { resolveRecipePowerProfile } from '../modifiers/gtMultiblock'
import { applyArchetypeToInputs, getDefaultArchetypeIdForSystem, getMachineArchetype } from '../data/archetypes/index'
import './RecipeEditorModal.css'

export type RecipeFormData = {
  machine_name: string
  base_duration_seconds: number
  base_inputs: Resource[]
  base_outputs: Resource[]
  base_utility_inputs: Resource[]
  base_utility_outputs: Resource[]
  archetype_id: string
  active_modifiers: string[]
  modifier_states: Record<string, Record<string, unknown>>
}

type EditorTarget = {
  id: string
  data: RecipeNodeData
}

type RecipeEditorModalProps = {
  node: EditorTarget | null
  onClose: () => void
  onSave: (id: string, data: RecipeNodeData) => void
}

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
      modifier_states: {},
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
    active_modifiers: [...(source.active_modifiers ?? [])],
    modifier_states: source.modifier_states ? { ...source.modifier_states } : {},
  }
}

export function RecipeEditorModal({ node, onClose, onSave }: RecipeEditorModalProps) {
  const storedRecipe = useRecipeStore((state) => state.recipes[node?.id ?? ''])

  const methods = useForm<RecipeFormData>({
    defaultValues: buildFormDefaults(node, storedRecipe),
  })
  const { reset, watch, handleSubmit, setValue, getValues } = methods

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
  }, [node?.id, reset])

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
      const nextActive = Array.from(new Set([...defaults, ...currentActive]))
      setValue('active_modifiers', nextActive)

      const currentStates = getValues('modifier_states')
      const nextStates = { ...currentStates }
      for (const modifierId of defaults) {
        nextStates[modifierId] = {
          ...createDefaultModifierState(modifierId),
          ...(nextStates[modifierId] ?? {}),
        }
      }
      setValue('modifier_states', nextStates)
    }
  }

  const isOpen = Boolean(node)

  const formValues = watch()

  const liveData = useMemo(() => {
    if (!node) return null
    return ensureRecipeDataShape({
      ...node.data,
      machine_name: formValues.machine_name.trim() || 'Custom Machine',
      archetype_id: formValues.archetype_id,
      metadata,
      base_inputs: formValues.base_inputs,
      base_outputs: formValues.base_outputs,
      base_utility_inputs: formValues.base_utility_inputs,
      base_utility_outputs: formValues.base_utility_outputs,
      base_duration_seconds: Number(formValues.base_duration_seconds) || 0,
      duration_seconds: Number(formValues.base_duration_seconds) || 0,
      active_modifiers: formValues.active_modifiers,
      modifier_states: formValues.modifier_states,
    })
  }, [
    node,
    formValues,
    metadata,
  ])

  const livePayload = useMemo(() => {
    if (!liveData) return null
    return runModifierPipeline(liveData)
  }, [liveData])

  const allInputRates = useMemo(
    () => livePayload ? ([...livePayload.recipe_inputs, ...livePayload.utility_inputs] as Resource[]) : [],
    [livePayload]
  )
  const allOutputRates = useMemo(
    () => livePayload ? ([...livePayload.recipe_outputs, ...livePayload.utility_outputs] as Resource[]) : [],
    [livePayload]
  )

  const livePowerPreview = useMemo(() => {
    if (!liveData) {
      return {
        baseEuPerTick: 0,
        actualEuPerTick: 0,
        highestTier: 'N/A',
        hasPowerSetting: false,
      }
    }

    return resolveRecipePowerProfile(liveData, livePayload ? [...livePayload.recipe_inputs, ...livePayload.utility_inputs] as Resource[] : undefined)
  }, [liveData, livePayload])

  const onSubmit = (formData: RecipeFormData) => {
    if (!node) return

    const assembled = ensureRecipeDataShape({
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
      modifier_states: formData.modifier_states,
    })

    useRecipeStore.getState().setRecipe(node.id, assembled)

    const payload = runModifierPipeline(assembled)
    const assembledInputRates = payload ? ([...payload.recipe_inputs, ...payload.utility_inputs] as Resource[]) : []
    const assembledOutputRates = payload ? ([...payload.recipe_outputs, ...payload.utility_outputs] as Resource[]) : []

    onSave(node.id, {
      ...assembled,
      duration_ticks: assembled.duration_ticks,
      metadata: {
        ...assembled.metadata,
        _calculated_preview: payload
          ? {
              duration: payload.duration_seconds,
              inputs: assembledInputRates,
              outputs: assembledOutputRates,
            }
          : undefined,
      },
    })
  }

  if (!isOpen) return null

  return (
    <div className="recipe-editor__overlay" role="presentation">
      <div className="recipe-editor__modal" role="dialog" aria-modal="true">
        <header className="recipe-editor__header">
          <div>
            <p className="recipe-editor__eyebrow">Recipe Editor</p>
            <h3 className="recipe-editor__title">编辑配方</h3>
          </div>
          <button className="recipe-editor__icon-btn" onClick={onClose} title="关闭">
            ✕
          </button>
        </header>

        <div className="recipe-editor__body">
          <FormProvider {...methods}>
            <SettingsUI
              inputFields={inputFields}
              outputFields={outputFields}
              utilityInputFields={utilityInputFields}
              utilityOutputFields={utilityOutputFields}
              onArchetypeChange={handleArchetypeChange}
              previewDurationSeconds={livePayload?.duration_seconds ?? (formValues.base_duration_seconds ?? 0)}
              previewInputRates={allInputRates}
              previewOutputRates={allOutputRates}
              previewPowerActualEu={livePowerPreview.actualEuPerTick}
            />
          </FormProvider>
        </div>

        <footer className="recipe-editor__footer">
          <button className="recipe-editor__btn" onClick={onClose}>取消</button>
          <button className="recipe-editor__btn recipe-editor__btn--primary" onClick={handleSubmit(onSubmit)}>保存</button>
        </footer>
      </div>
    </div>
  )
}
