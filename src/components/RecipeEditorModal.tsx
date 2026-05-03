import { useEffect, useMemo, useState } from 'react'
import type { RecipeNodeData, MachineSystem } from '../types/recipe'
import type { Resource } from '../types/types'
import { SettingsUI } from './SettingsUI'
import { ensureRecipeDataShape, getCalculatedRates, toLegacyPort } from '../modifiers/calculate'
import { applyArchetypeToInputs, getDefaultArchetypeIdForSystem, getMachineArchetype } from '../data/archetypes'
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
  const [machineName, setMachineName] = useState('')
  const [baseDurationSeconds, setBaseDurationSeconds] = useState(0)
  const [baseInputs, setBaseInputs] = useState<Resource[]>([])
  const [baseOutputs, setBaseOutputs] = useState<Resource[]>([])
  const [system, setSystem] = useState<MachineSystem>('custom')
  const [archetypeId, setArchetypeId] = useState(getDefaultArchetypeIdForSystem('custom'))
  const [metadata, setMetadata] = useState<RecipeNodeData['metadata']>({})
  const [activeModifiers, setActiveModifiers] = useState<string[]>([])
  const [modifierStates, setModifierStates] = useState<Record<string, Record<string, any>>>({})

  useEffect(() => {
    if (!node) return

    const normalized = ensureRecipeDataShape(node.data)

    setMachineName(normalized.machine_name)
    setBaseDurationSeconds(normalized.base_duration_seconds ?? normalized.duration_seconds ?? 0)
    setBaseInputs((normalized.base_inputs ?? []).map((item) => ({ ...item })))
    setBaseOutputs((normalized.base_outputs ?? []).map((item) => ({ ...item })))
    setSystem(normalized.system)
    setArchetypeId(normalized.archetype_id ?? getDefaultArchetypeIdForSystem(normalized.system))
    setMetadata({ ...normalized.metadata })
    setActiveModifiers([...(normalized.active_modifiers ?? [])])
    setModifierStates({ ...(normalized.modifier_states ?? {}) })
  }, [node])

  useEffect(() => {
    setBaseInputs((prev) => applyArchetypeToInputs(prev, archetypeId, metadata))

    const defaults = getMachineArchetype(archetypeId).default_modifiers
    if (defaults.length === 0) return

    setActiveModifiers((prev) => {
      const next = new Set<string>([...defaults, ...prev])
      return Array.from(next)
    })

    setModifierStates((prev) => {
      const next = { ...prev }
      for (const modifierId of defaults) {
        next[modifierId] = {
          ...(next[modifierId] ?? {}),
        }
      }
      return next
    })
  }, [archetypeId, metadata])

  const isOpen = Boolean(node)

  const liveData = useMemo(() => {
    if (!node) return null
    return ensureRecipeDataShape({
      ...node.data,
      machine_name: machineName.trim() || 'Custom Machine',
      system,
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
    system,
    archetypeId,
    metadata,
    baseInputs,
    baseOutputs,
    baseDurationSeconds,
    activeModifiers,
    modifierStates,
  ])

  const handleSave = () => {
    if (!node || !liveData) return

    const calculated = getCalculatedRates(liveData)

    onSave(node.id, {
      ...liveData,
      // Legacy fields retained for backward compatibility with existing logic paths.
      duration_ticks: liveData.duration_ticks,
      inputs: liveData.base_inputs?.map(toLegacyPort) ?? [],
      outputs: liveData.base_outputs?.map(toLegacyPort) ?? [],
      metadata: {
        ...liveData.metadata,
        _calculated_preview: {
          duration: calculated.duration,
          inputs: calculated.inputRates,
          outputs: calculated.outputRates,
        },
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
            system={system}
            setSystem={setSystem}
            archetypeId={archetypeId}
            setArchetypeId={setArchetypeId}
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
