import type { Dispatch, SetStateAction } from 'react'
import type { MachineSystem } from '../types/recipe'
import type { Resource, ResourceCategory } from '../types/types'
import { listModifiers, patchModifierSchemaWithNodeResources, createDefaultModifierState } from '../modifiers/registry'
import { getMachineArchetype, machineArchetypes } from '../data/archetypes'

type SettingsUIProps = {
  machineName: string
  setMachineName: Dispatch<SetStateAction<string>>
  system: MachineSystem
  setSystem: Dispatch<SetStateAction<MachineSystem>>
  archetypeId: string
  setArchetypeId: Dispatch<SetStateAction<string>>
  baseDurationSeconds: number
  setBaseDurationSeconds: Dispatch<SetStateAction<number>>
  baseInputs: Resource[]
  setBaseInputs: Dispatch<SetStateAction<Resource[]>>
  baseOutputs: Resource[]
  setBaseOutputs: Dispatch<SetStateAction<Resource[]>>
  activeModifiers: string[]
  setActiveModifiers: Dispatch<SetStateAction<string[]>>
  modifierStates: Record<string, Record<string, any>>
  setModifierStates: Dispatch<SetStateAction<Record<string, Record<string, any>>>>
}

const categories: ResourceCategory[] = ['item', 'fluid']

const emptyResource = (): Resource => ({
  category: 'item',
  id: '',
  amount: 1,
  routing_mode: 'wired',
  routing_locked: false,
  _uid: crypto.randomUUID(),
})

function updateResourceAtIndex(
  setList: Dispatch<SetStateAction<Resource[]>>,
  index: number,
  patch: Partial<Resource>
) {
  setList((prev) => prev.map((entry, idx) => (idx === index ? { ...entry, ...patch } : entry)))
}

function addResource(setList: Dispatch<SetStateAction<Resource[]>>) {
  setList((prev) => prev.concat(emptyResource()))
}

function removeResource(
  setList: Dispatch<SetStateAction<Resource[]>>,
  index: number
) {
  setList((prev) => prev.filter((_, idx) => idx !== index))
}

export function SettingsUI(props: SettingsUIProps) {
  const {
    machineName,
    setMachineName,
    system,
    setSystem,
    archetypeId,
    setArchetypeId,
    baseDurationSeconds,
    setBaseDurationSeconds,
    baseInputs,
    setBaseInputs,
    baseOutputs,
    setBaseOutputs,
    activeModifiers,
    setActiveModifiers,
    modifierStates,
    setModifierStates,
  } = props

  const modifiers = listModifiers()
  const archetype = getMachineArchetype(archetypeId)
  const inputRows = baseInputs.map((resource, index) => ({ resource, index }))
  const outputRows = baseOutputs.map((resource, index) => ({ resource, index }))
  const materialInputRows = inputRows.filter(({ resource }) => !resource.is_utility)
  const utilityInputRows = inputRows.filter(({ resource }) => resource.is_utility)

  const toggleRoutingAtIndex = (
    setList: Dispatch<SetStateAction<Resource[]>>,
    index: number
  ) => {
    setList((prev) => prev.map((entry, idx) => {
      if (idx !== index) return entry
      if (entry.routing_locked) return entry
      const nextMode = entry.routing_mode === 'global' ? 'wired' : 'global'
      return { ...entry, routing_mode: nextMode }
    }))
  }

  const toggleModifier = (modifierId: string, enabled: boolean) => {
    if (enabled) {
      setActiveModifiers((prev) => {
        if (prev.includes(modifierId)) return prev
        return [...prev, modifierId]
      })
      setModifierStates((prev) => ({
        ...prev,
        [modifierId]: {
          ...createDefaultModifierState(modifierId),
          ...(prev[modifierId] ?? {}),
        },
      }))
      return
    }

    setActiveModifiers((prev) => prev.filter((id) => id !== modifierId))
  }

  const setModifierValue = (modifierId: string, key: string, value: any) => {
    setModifierStates((prev) => ({
      ...prev,
      [modifierId]: {
        ...(prev[modifierId] ?? {}),
        [key]: value,
      },
    }))
  }

  return (
    <div className="recipe-settings__layout">
      <section className="recipe-settings__column">
        <div className="recipe-settings__column-header">
          <h4>Inputs</h4>
          <button className="recipe-editor__btn recipe-editor__btn--ghost" onClick={() => addResource(setBaseInputs)}>
            + 添加输入
          </button>
        </div>
        {materialInputRows.length === 0 && <p className="recipe-editor__empty">暂无输入资源</p>}
        {materialInputRows.map(({ resource: input, index }) => (
          <div className="recipe-editor__row recipe-editor__row--resource recipe-editor__row--resource-route" key={input._uid ?? `input-${index}`}>
            <input
              type="text"
              placeholder="资源 ID"
              value={input.id}
              onChange={(e) => updateResourceAtIndex(setBaseInputs, index, { id: e.target.value })}
            />
            <input
              type="number"
              min={0}
              value={input.amount}
              onChange={(e) => updateResourceAtIndex(setBaseInputs, index, { amount: Number(e.target.value) })}
            />
            <select
              value={input.category}
              onChange={(e) => updateResourceAtIndex(setBaseInputs, index, { category: e.target.value as ResourceCategory })}
            >
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <button
              className={`recipe-editor__route-btn${input.routing_mode === 'global' ? ' is-global' : ''}`}
              onClick={() => toggleRoutingAtIndex(setBaseInputs, index)}
              title={input.routing_mode === 'global' ? '当前：全局总线（点击切换到有线）' : '当前：有线连接（点击切换到全局总线）'}
              type="button"
            >
              🌐
            </button>
            <button
              className="recipe-editor__icon-action recipe-editor__icon-action--danger"
              onClick={() => removeResource(setBaseInputs, index)}
              title="删除该输入"
              aria-label="删除该输入"
              type="button"
            >
              ✕
            </button>
          </div>
        ))}
      </section>

      <section className="recipe-settings__column recipe-settings__column--core">
        <h4>Machine Core</h4>

        <label className="recipe-editor__field">
          <span>机器底盘 (Archetype)</span>
          <select value={archetypeId} onChange={(e) => setArchetypeId(e.target.value)}>
            {machineArchetypes.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>

        <label className="recipe-editor__field">
          <span>机器名称</span>
          <input type="text" value={machineName} onChange={(e) => setMachineName(e.target.value)} />
        </label>

        <label className="recipe-editor__field">
          <span>系统标识</span>
          <input type="text" value={system} onChange={(e) => setSystem(e.target.value as MachineSystem)} />
        </label>

        <label className="recipe-editor__field">
          <span>基础耗时 (s)</span>
          <input
            type="number"
            min={0}
            step={0.05}
            value={baseDurationSeconds}
            onChange={(e) => setBaseDurationSeconds(Number(e.target.value) || 0)}
          />
        </label>

        <div className="recipe-settings__modifier-pool">
          <h5>MACHINE UTILITIES (固定槽位)</h5>
          {utilityInputRows.length === 0 && <p className="recipe-editor__empty">当前底盘无固定公用设施</p>}
          {utilityInputRows.map(({ resource: input, index }) => {
            const utilityDef = archetype.fixed_utilities[input.id]
            const isLockedRoute = utilityDef?.routing_locked ?? input.routing_locked
            const isAmountMutable = utilityDef?.amount_mutable ?? input.amount_mutable ?? true

            return (
              <div className="recipe-editor__row recipe-editor__row--resource recipe-editor__row--resource-route" key={input._uid ?? `utility-${index}`}>
                <input
                  type="text"
                  value={input.id}
                  readOnly
                  title="固定公用槽位 ID"
                />
                <input
                  type="number"
                  min={0}
                  value={input.amount}
                  disabled={!isAmountMutable}
                  onChange={(e) => updateResourceAtIndex(setBaseInputs, index, { amount: Number(e.target.value) })}
                />
                <input type="text" value={input.utility_type ?? input.category} readOnly title="公用设施类型" />
                <button
                  className={`recipe-editor__route-btn${input.routing_mode === 'global' ? ' is-global' : ''}`}
                  onClick={() => toggleRoutingAtIndex(setBaseInputs, index)}
                  disabled={isLockedRoute}
                  title={isLockedRoute ? '该底盘锁定路由模式，不可切换' : input.routing_mode === 'global' ? '当前：全局总线（点击切换到有线）' : '当前：有线连接（点击切换到全局总线）'}
                  type="button"
                >
                  🌐
                </button>
                <button
                  className="recipe-editor__icon-action"
                  disabled
                  title="底盘固定槽位不可删除"
                  aria-label="底盘固定槽位不可删除"
                  type="button"
                >
                  🔒
                </button>
              </div>
            )
          })}
        </div>

        <div className="recipe-settings__modifier-pool">
          <h5>Active Modifiers</h5>
          {modifiers.map((modifier) => (
            <label className="recipe-settings__modifier-toggle" key={modifier.id}>
              <input
                type="checkbox"
                checked={activeModifiers.includes(modifier.id)}
                onChange={(e) => toggleModifier(modifier.id, e.target.checked)}
              />
              <span>{modifier.name}</span>
            </label>
          ))}
        </div>

        {activeModifiers.map((modifierId) => {
          const rawModifier = modifiers.find((m) => m.id === modifierId)
          if (!rawModifier) return null

          const modifier = patchModifierSchemaWithNodeResources(rawModifier, baseOutputs)
          const state = {
            ...createDefaultModifierState(modifierId),
            ...(modifierStates[modifierId] ?? {}),
          }

          return (
            <div className="recipe-settings__modifier-card" key={modifierId}>
              <h6>{modifier.name}</h6>
              {modifier.ui_schema.map((control) => {
                const currentValue = state[control.key]
                if (control.type === 'toggle') {
                  return (
                    <label className="recipe-settings__control" key={control.key}>
                      <span>{control.label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(currentValue)}
                        onChange={(e) => setModifierValue(modifierId, control.key, e.target.checked)}
                      />
                    </label>
                  )
                }

                if (control.type === 'select') {
                  const options = control.options ?? []
                  return (
                    <label className="recipe-settings__control" key={control.key}>
                      <span>{control.label}</span>
                      <select
                        value={String(currentValue ?? '')}
                        onChange={(e) => setModifierValue(modifierId, control.key, e.target.value)}
                      >
                        {options.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                  )
                }

                if (control.type === 'slider') {
                  return (
                    <label className="recipe-settings__control" key={control.key}>
                      <span>{control.label}</span>
                      <input
                        type="range"
                        min={0}
                        max={8}
                        step={1}
                        value={Number(currentValue ?? 0)}
                        onChange={(e) => setModifierValue(modifierId, control.key, Number(e.target.value))}
                      />
                    </label>
                  )
                }

                return (
                  <label className="recipe-settings__control" key={control.key}>
                    <span>{control.label}</span>
                    <input
                      type="number"
                      value={Number(currentValue ?? 0)}
                      onChange={(e) => setModifierValue(modifierId, control.key, Number(e.target.value))}
                    />
                  </label>
                )
              })}
            </div>
          )
        })}
      </section>

      <section className="recipe-settings__column">
        <div className="recipe-settings__column-header">
          <h4>Outputs</h4>
          <button className="recipe-editor__btn recipe-editor__btn--ghost" onClick={() => addResource(setBaseOutputs)}>
            + 添加输出
          </button>
        </div>
        {outputRows.length === 0 && <p className="recipe-editor__empty">暂无输出资源</p>}
        {outputRows.map(({ resource: output, index }) => (
          <div className="recipe-editor__row recipe-editor__row--resource recipe-editor__row--resource-route" key={output._uid ?? `output-${index}`}>
            <input
              type="text"
              placeholder="资源 ID"
              value={output.id}
              onChange={(e) => updateResourceAtIndex(setBaseOutputs, index, { id: e.target.value })}
            />
            <input
              type="number"
              min={0}
              value={output.amount}
              onChange={(e) => updateResourceAtIndex(setBaseOutputs, index, { amount: Number(e.target.value) })}
            />
            <select
              value={output.category}
              onChange={(e) => updateResourceAtIndex(setBaseOutputs, index, { category: e.target.value as ResourceCategory })}
            >
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <button
              className={`recipe-editor__route-btn${output.routing_mode === 'global' ? ' is-global' : ''}`}
              onClick={() => toggleRoutingAtIndex(setBaseOutputs, index)}
              title={output.routing_mode === 'global' ? '当前：全局总线（点击切换到有线）' : '当前：有线连接（点击切换到全局总线）'}
              type="button"
            >
              🌐
            </button>
            <button
              className="recipe-editor__icon-action recipe-editor__icon-action--danger"
              onClick={() => removeResource(setBaseOutputs, index)}
              title="删除该输出"
              aria-label="删除该输出"
              type="button"
            >
              ✕
            </button>
          </div>
        ))}
      </section>
    </div>
  )
}
