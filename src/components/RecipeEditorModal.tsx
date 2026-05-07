import { useMemo, useState, useCallback } from 'react'
import type { RecipeNodeData } from '../types/recipe'
import type { Resource } from '../types/types'
import { SettingsUI } from './SettingsUI'
import { ensureRecipeDataShape, runModifierPipeline } from '../modifiers/calculate'
import { createDefaultModifierState } from '../modifiers/state'
import { resolveRecipePowerProfile } from '../modifiers/gtMultiblock'
import { applyArchetypeToInputs, getDefaultArchetypeIdForSystem, getMachineArchetype } from '../data/archetypes/index'
import './RecipeEditorModal.css'

type EditorTarget = {
  id: string
  data: RecipeNodeData
}

type RecipeEditorModalProps = {
  node: EditorTarget | null
  onClose: () => void
  onSave: (id: string, data: RecipeNodeData) => void
}

export function RecipeEditorModal({ node, onClose, onSave }: RecipeEditorModalProps) {
  const normalized = node ? ensureRecipeDataShape(node.data) : undefined

  const [machineName, setMachineName] = useState(normalized?.machine_name ?? '')
  const [baseDurationSeconds, setBaseDurationSeconds] = useState(normalized?.base_duration_seconds ?? normalized?.duration_seconds ?? 0)
  const [baseInputs, setBaseInputs] = useState<Resource[]>((normalized?.base_inputs ?? []).map((item) => ({ ...item })))
  const [baseOutputs, setBaseOutputs] = useState<Resource[]>((normalized?.base_outputs ?? []).map((item) => ({ ...item })))
  const [archetypeId, setArchetypeId] = useState(normalized?.archetype_id ?? getDefaultArchetypeIdForSystem(normalized?.system ?? 'custom'))
  const metadata = useMemo(() => normalized?.metadata ? { ...normalized.metadata } : {}, [normalized])
  const [activeModifiers, setActiveModifiers] = useState<string[]>([...(normalized?.active_modifiers ?? [])])
  const [modifierStates, setModifierStates] = useState<Record<string, Record<string, unknown>>>(normalized?.modifier_states ? { ...normalized.modifier_states } : {})

  const handleArchetypeChange = useCallback((nextArchetypeId: string) => {
    setArchetypeId(nextArchetypeId)
    setBaseInputs((prev) => applyArchetypeToInputs(prev, nextArchetypeId, metadata))

    const defaults = getMachineArchetype(nextArchetypeId).default_modifiers
    if (defaults.length === 0) return

    setActiveModifiers((prev) => {
      const next = new Set<string>([...defaults, ...prev])
      return Array.from(next)
    })

    setModifierStates((prev) => {
      const next = { ...prev }
      for (const modifierId of defaults) {
        next[modifierId] = {
          ...createDefaultModifierState(modifierId),
          ...(next[modifierId] ?? {}),
        }
      }
      return next
    })
  }, [metadata, setArchetypeId, setBaseInputs, setActiveModifiers, setModifierStates])

  const isOpen = Boolean(node)

  const liveData = useMemo(() => {
    if (!node) return null
    return ensureRecipeDataShape({
      ...node.data,
      machine_name: machineName.trim() || 'Custom Machine',
      archetype_id: archetypeId,
      metadata,
      base_inputs: baseInputs,
      base_outputs: baseOutputs,
      base_duration_seconds: Number(baseDurationSeconds) || 0,
      duration_seconds: Number(baseDurationSeconds) || 0,
      active_modifiers: activeModifiers,
      modifier_states: modifierStates,
    })
  }, [
    node,
    machineName,
    archetypeId,
    metadata,
    baseInputs,
    baseOutputs,
    baseDurationSeconds,
    activeModifiers,
    modifierStates,
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

  const handleSave = () => {
    if (!node || !liveData) return

    onSave(node.id, {
      ...liveData,
      duration_ticks: liveData.duration_ticks,
      metadata: {
        ...liveData.metadata,
        _calculated_preview: livePayload
          ? {
              duration: livePayload.duration_seconds,
              inputs: allInputRates,
              outputs: allOutputRates,
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
          <SettingsUI
            machineName={machineName}
            setMachineName={setMachineName}
            archetypeId={archetypeId}
            setArchetypeId={setArchetypeId}
            onArchetypeChange={handleArchetypeChange}
            baseDurationSeconds={baseDurationSeconds}
            setBaseDurationSeconds={setBaseDurationSeconds}
            baseInputs={baseInputs}
            setBaseInputs={setBaseInputs}
            baseOutputs={baseOutputs}
            setBaseOutputs={setBaseOutputs}
            activeModifiers={activeModifiers}
            setActiveModifiers={setActiveModifiers}
            modifierStates={modifierStates}
            setModifierStates={setModifierStates}
            previewDurationSeconds={livePayload?.duration_seconds ?? baseDurationSeconds}
            previewInputRates={allInputRates}
            previewOutputRates={allOutputRates}
            previewPowerActualEu={livePowerPreview.actualEuPerTick}
          />
        </div>

        <footer className="recipe-editor__footer">
          <button className="recipe-editor__btn" onClick={onClose}>取消</button>
          <button className="recipe-editor__btn recipe-editor__btn--primary" onClick={handleSave}>保存</button>
        </footer>
      </div>
    </div>
  )
}
