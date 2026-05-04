import { useMemo, useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { Resource, MeasureMode } from '../types/types'
import { GT_VOLTAGE_TIERS, evaluateGtMultiblockState } from '../modifiers/gtMultiblock'
import { listModifiers } from '../modifiers/registry'
import { createDefaultModifierState, patchModifierSchemaWithNodeResources } from '../modifiers/state'
import { getMachineArchetype, machineArchetypes } from '../data/archetypes/index'
import { useResourceRegistry } from '../registry/resourceRegistry'
import { buildUnitSuffix } from '../registry/units'
import { resolveCategoryDef } from '../utils/endpointNorm'

type SettingsUIProps = {
  machineName: string
  setMachineName: Dispatch<SetStateAction<string>>
  archetypeId: string
  setArchetypeId: Dispatch<SetStateAction<string>>
  onArchetypeChange?: (nextId: string) => void
  baseDurationSeconds: number
  setBaseDurationSeconds: Dispatch<SetStateAction<number>>
  baseInputs: Resource[]
  setBaseInputs: Dispatch<SetStateAction<Resource[]>>
  baseOutputs: Resource[]
  setBaseOutputs: Dispatch<SetStateAction<Resource[]>>
  activeModifiers: string[]
  setActiveModifiers: Dispatch<SetStateAction<string[]>>
  modifierStates: Record<string, Record<string, unknown>>
  setModifierStates: Dispatch<SetStateAction<Record<string, Record<string, unknown>>>>
  previewDurationSeconds: number
  previewInputRates: Resource[]
  previewOutputRates: Resource[]
  previewPowerActualEu: number
}

const emptyResource = (): Resource => ({
  category: 'item',
  id: '',
  amount: 1,
  measure_mode: 'per_cycle',
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

function formatRate(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0.00'
  return value.toFixed(2)
}

function formatDuration(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return 'Instant'
  return `${value.toFixed(2)}s`
}

function formatPower(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return value.toFixed(0)
}

function buildRateMap(rates: Resource[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const rate of rates) {
    if (!rate.id) continue
    map.set(rate.id, (map.get(rate.id) ?? 0) + rate.amount)
  }
  return map
}

function normalizeGtHatches(state: Record<string, unknown>): Array<{ tier: string; amps: number }> {
  if (!Array.isArray(state.energyHatches)) return [{ tier: 'LV', amps: 1 }]
  const rows = (state.energyHatches as Array<Record<string, unknown>>)
    .map((row: Record<string, unknown>) => ({
      tier: typeof row?.tier === 'string' ? row.tier : 'LV',
      amps: Number.isFinite(Number(row?.amps)) ? Math.max(0, Number(row.amps)) : 0,
    }))
    .filter((row: { amps: number }) => row.amps > 0)
  return rows.length > 0 ? rows : [{ tier: 'LV', amps: 1 }]
}

export function SettingsUI(props: SettingsUIProps) {
  const {
    machineName,
    setMachineName,
    archetypeId,
    setArchetypeId,
    onArchetypeChange,
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
    previewDurationSeconds,
    previewInputRates,
    previewOutputRates,
    previewPowerActualEu,
  } = props

  const modifiers = listModifiers()
  const archetype = getMachineArchetype(archetypeId)
  const registryCategories = useResourceRegistry((state) => state.categories)
  const categoryOptions = useMemo(
    () => Object.values(registryCategories).map((cat) => ({ id: cat.id, displayName: cat.displayName })),
    [registryCategories]
  )
  const [dropdownOpen, setDropdownOpen] = useState<Record<string, boolean>>({})
  const [modifierPopoverOpen, setModifierPopoverOpen] = useState(false)
  const modifierPopoverRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!modifierPopoverOpen) return
    const handleClick = (e: MouseEvent) => {
      if (modifierPopoverRef.current?.contains(e.target as Node)) return
      setModifierPopoverOpen(false)
    }
    document.addEventListener('mousedown', handleClick, true)
    return () => document.removeEventListener('mousedown', handleClick, true)
  }, [modifierPopoverOpen])
  const inputRows = baseInputs.map((resource, index) => ({ resource, index }))
  const outputRows = baseOutputs.map((resource, index) => ({ resource, index }))
  const materialInputRows = inputRows.filter(({ resource }) => !resource.is_utility)
  const utilityInputRows = inputRows.filter(({ resource }) => resource.is_utility)
  const inputRateMap = useMemo(() => buildRateMap(previewInputRates), [previewInputRates])
  const outputRateMap = useMemo(() => buildRateMap(previewOutputRates), [previewOutputRates])
  const availableModifiers = useMemo(
    () => modifiers.filter((modifier) => {
      if (activeModifiers.includes(modifier.id)) return false
      const allowed = modifier.compatible_archetypes
      if (!allowed || allowed.length === 0) return true
      return allowed.includes(archetypeId)
    }),
    [modifiers, activeModifiers, archetypeId]
  )
  const defaultModifierSet = useMemo(() => new Set(archetype.default_modifiers), [archetype.default_modifiers])

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

  const addModifier = (modifierId: string) => {
    setActiveModifiers((prev) => (prev.includes(modifierId) ? prev : [...prev, modifierId]))
    setModifierStates((prev) => ({
      ...prev,
      [modifierId]: {
        ...createDefaultModifierState(modifierId),
        ...(prev[modifierId] ?? {}),
      },
    }))
    setModifierPopoverOpen(false)
  }

  const removeModifier = (modifierId: string) => {
    setActiveModifiers((prev) => prev.filter((id) => id !== modifierId))
    setModifierStates((prev) => {
      const next = { ...prev }
      delete next[modifierId]
      return next
    })
  }

  const setModifierValue = (modifierId: string, key: string, value: unknown) => {
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
        {materialInputRows.length > 0 && (
          <div className="recipe-editor__row recipe-editor__row--resource-route-header">
            <span className="recipe-editor__row-header-item">ID</span>
            <span className="recipe-editor__row-header-item">数量</span>
            <span className="recipe-editor__row-header-item">度量</span>
            <span className="recipe-editor__row-header-item">类型</span>
            <span className="recipe-editor__row-header-item"></span>
            <span className="recipe-editor__row-header-item"></span>
            <span className="recipe-editor__row-header-item">实际速率</span>
          </div>
        )}
        {materialInputRows.map(({ resource: input, index }) => {
          const rate = inputRateMap.get(input.id)
          const catDef = registryCategories[input.category]
          const suffix = catDef ? buildUnitSuffix(catDef.base_unit, input.measure_mode) : input.category
          const rateText = rate !== undefined ? `${formatRate(rate)}/s` : ''

          return (
            <div className="recipe-editor__row recipe-editor__row--resource-route" key={input._uid ?? `input-${index}`}>
              <input
                type="text"
                placeholder="资源 ID"
                value={input.id}
                onChange={(e) => updateResourceAtIndex(setBaseInputs, index, { id: e.target.value })}
              />
              <div className="recipe-editor__input-wrap">
                <input
                  type="number"
                  min={0}
                  value={input.amount}
                  onChange={(e) => updateResourceAtIndex(setBaseInputs, index, { amount: Number(e.target.value) })}
                />
                <span className="recipe-editor__input-suffix">{suffix}</span>
              </div>
              <select
                value={input.measure_mode ?? 'per_cycle'}
                onChange={(e) => updateResourceAtIndex(setBaseInputs, index, { measure_mode: e.target.value as MeasureMode })}
              >
                <option value="per_cycle">/次</option>
                <option value="rate_per_tick">/t</option>
                <option value="rate_per_sec">/s</option>
              </select>
              <select
                value={input.category}
                onChange={(e) => updateResourceAtIndex(setBaseInputs, index, { category: e.target.value })}
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.displayName}</option>
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
              <span className="recipe-editor__row-rate">{rateText}</span>
            </div>
          )
        })}
      </section>

      <section className="recipe-settings__column recipe-settings__column--core">
        <h4>Machine Core</h4>

        <label className="recipe-editor__field">
          <span>机器范式 (Archetype)</span>
          <select value={archetypeId} onChange={(e) => { if (onArchetypeChange) onArchetypeChange(e.target.value); else setArchetypeId(e.target.value) }}>
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
          <span>基础耗时 (s)</span>
          <div className="recipe-editor__row recipe-editor__row--utility-no-buttons">
            <span className="recipe-editor__row-label">耗时</span>
            <div className="recipe-editor__input-wrap">
              <input
                type="number"
                min={0}
                step={0.05}
                value={baseDurationSeconds}
                onChange={(e) => setBaseDurationSeconds(Number(e.target.value) || 0)}
              />
              <span className="recipe-editor__input-suffix">s</span>
            </div>
            <span></span>
            <span className="recipe-editor__row-rate">{formatDuration(previewDurationSeconds)}</span>
          </div>
        </label>

        <div className="recipe-settings__modifier-pool">
          <h5>Machine Utilities</h5>
          {utilityInputRows.length === 0 && <p className="recipe-editor__empty">当前范式无固定公用设施</p>}
          {utilityInputRows.map(({ resource: input, index }) => {
            const utilityDef = archetype.fixed_utilities[input.id]
            const isLockedRoute = utilityDef?.routing_locked ?? input.routing_locked
            const isAmountMutable = utilityDef?.amount_mutable ?? input.amount_mutable ?? true
            const isReadOnlyTag = !isAmountMutable
            const typeId = input.utility_type ?? input.id
            const catDef = resolveCategoryDef(registryCategories, typeId)

            if (isReadOnlyTag) {
              const utilSuffix = buildUnitSuffix(catDef.base_unit, input.measure_mode)
              return (
                <div className="recipe-settings__utility-label" key={input._uid ?? `utility-${index}`}>
                  <span className="recipe-settings__utility-label-text">
                    {catDef.displayName} ({input.id}) : {input.amount} {utilSuffix}
                  </span>
                  <span className="recipe-settings__utility-badges">
                    <span className="recipe-settings__utility-badge">{input.routing_mode === 'global' ? '🌐' : '🔌'}</span>
                    <span className="recipe-settings__utility-badge">🔒</span>
                  </span>
                </div>
              )
            }

            const utilSuffix = buildUnitSuffix(catDef.base_unit, input.measure_mode)
            const actualText = catDef.id !== '_fallback'
              ? `${formatPower(previewPowerActualEu)} ${utilSuffix}`
              : ''

            return (
              <div className="recipe-editor__row recipe-editor__row--utility" key={input._uid ?? `utility-${index}`}>
                <span className="recipe-editor__row-label">{catDef.displayName}</span>
                <div className="recipe-editor__input-wrap">
                  <input
                    type="number"
                    min={0}
                    value={input.amount}
                    disabled={!isAmountMutable}
                    onChange={(e) => updateResourceAtIndex(setBaseInputs, index, { amount: Number(e.target.value) })}
                  />
                  <span className="recipe-editor__input-suffix">{utilSuffix}</span>
                </div>
                <span></span>
                <button
                  className={`recipe-editor__route-btn${input.routing_mode === 'global' ? ' is-global' : ''}`}
                  onClick={() => toggleRoutingAtIndex(setBaseInputs, index)}
                  disabled={isLockedRoute}
                  title={isLockedRoute ? '该范式锁定路由模式，不可切换' : input.routing_mode === 'global' ? '当前：全局总线（点击切换到有线）' : '当前：有线连接（点击切换到全局总线）'}
                  type="button"
                >
                  🌐
                </button>
                <button className="recipe-editor__icon-action" disabled title="范式固定槽位不可删除" aria-label="范式固定槽位不可删除" type="button">🔒</button>
                <span className="recipe-editor__row-rate">{actualText}</span>
              </div>
            )
          })}
        </div>

        <div className="recipe-settings__modifier-pool">
          <h5>Modifier Slots</h5>
          <div className="recipe-settings__modifier-adder">
            <button
              className="recipe-editor__btn recipe-editor__btn--ghost recipe-editor__btn--full"
              type="button"
              disabled={availableModifiers.length === 0}
              onClick={() => setModifierPopoverOpen((prev) => !prev)}
            >
              ➕ 添加修饰器
            </button>
            {modifierPopoverOpen && availableModifiers.length > 0 && (
              <div className="recipe-settings__modifier-popover" ref={modifierPopoverRef}>
                {availableModifiers.map((modifier) => (
                  <button
                    key={modifier.id}
                    className="recipe-settings__modifier-popover-item"
                    type="button"
                    onClick={() => addModifier(modifier.id)}
                  >
                    {modifier.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {activeModifiers.length === 0 && !modifierPopoverOpen && <p className="recipe-editor__empty">当前未安装修饰器</p>}
        </div>

        {activeModifiers.map((modifierId) => {
          const rawModifier = modifiers.find((m) => m.id === modifierId)
          if (!rawModifier) return null
          const isFixedModifier = defaultModifierSet.has(modifierId)

          const modifier = patchModifierSchemaWithNodeResources(rawModifier, baseOutputs)
          const state = {
            ...createDefaultModifierState(modifierId),
            ...(modifierStates[modifierId] ?? {}),
          }

          if (modifierId === 'gt_multiblock') {
            const hatchRows = normalizeGtHatches(state)
            const baseEuInput = baseInputs.find((r) => r.id === 'gt:eu' && r.is_utility)
            const baseEuPerTick = baseEuInput ? baseEuInput.amount : 0
            const summary = evaluateGtMultiblockState(
              { ...state, energyHatches: hatchRows },
              baseEuPerTick
            )

            const updateHatchRows = (nextRows: Array<{ tier: string; amps: number }>) => {
              setModifierValue(modifierId, 'energyHatches', nextRows)
            }

            return (
              <div className="recipe-settings__modifier-card" key={modifierId}>
                <div className="recipe-settings__modifier-card-header">
                  <h6>{modifier.name}</h6>
                  <button
                    className={`recipe-editor__icon-action${isFixedModifier ? '' : ' recipe-editor__icon-action--danger'}`}
                    type="button"
                    onClick={() => removeModifier(modifierId)}
                    title={isFixedModifier ? '范式固定修饰器，不可卸载' : '卸载修饰器'}
                    aria-label={isFixedModifier ? '范式固定修饰器，不可卸载' : '卸载修饰器'}
                    disabled={isFixedModifier}
                  >
                    {isFixedModifier ? '🔒' : '🗑️'}
                  </button>
                </div>

                <div className="recipe-settings__hatch-table">
                  {hatchRows.map((row, rowIndex) => (
                    <div className="recipe-settings__hatch-row" key={`${modifierId}-hatch-${rowIndex}`}>
                      <select
                        value={row.tier}
                        onChange={(e) => {
                          const nextRows = hatchRows.map((entry, idx) => (idx === rowIndex ? { ...entry, tier: e.target.value } : entry))
                          updateHatchRows(nextRows)
                        }}
                      >
                        {GT_VOLTAGE_TIERS.map((tier) => (
                          <option key={tier.id} value={tier.id}>{tier.id} ({tier.euPerAmp} EU/A)</option>
                        ))}
                      </select>
                      <div className="recipe-editor__input-wrap">
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
                        <span className="recipe-editor__input-suffix">A</span>
                      </div>
                      <button
                        className="recipe-editor__icon-action recipe-editor__icon-action--danger"
                        type="button"
                        onClick={() => {
                          const nextRows = hatchRows.filter((_, idx) => idx !== rowIndex)
                          updateHatchRows(nextRows.length > 0 ? nextRows : [{ tier: 'LV', amps: 1 }])
                        }}
                        title="删除能源仓"
                        aria-label="删除能源仓"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    className="recipe-editor__btn recipe-editor__btn--ghost"
                    type="button"
                    onClick={() => updateHatchRows(hatchRows.concat({ tier: 'LV', amps: 1 }))}
                  >
                    ➕ 添加能源仓
                  </button>
                </div>

                {(() => {
                  const PARALLEL_PRESETS = [1, 4, 16, 64, 256, 1024, 4096, 16384, 65536, 262144, 1048576]
                  const rawValue = state.parallelLimit ?? 4
                  const currentParallel = typeof rawValue === 'string' ? rawValue : Math.max(1, Math.floor(Number(rawValue)))
                  const isOpen = dropdownOpen[modifierId] ?? false
                  
                  const handleSelectPreset = (value: number) => {
                    setModifierValue(modifierId, 'parallelLimit', value)
                    setDropdownOpen((prev) => ({ ...prev, [modifierId]: false }))
                  }

                  return (
                    <div className="recipe-settings__control" key="parallelLimit" style={{ position: 'relative' }}>
                      <span>并行控制仓上限</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={String(currentParallel)}
                        onFocus={() => setDropdownOpen((prev) => ({ ...prev, [modifierId]: true }))}
                        onChange={(e) => {
                          const val = e.target.value.trim()
                          if (val === '') {
                            setModifierValue(modifierId, 'parallelLimit', '')
                          } else {
                            const num = Math.floor(Number(val) || 1)
                            if (num >= 1) setModifierValue(modifierId, 'parallelLimit', num)
                          }
                          setDropdownOpen((prev) => ({ ...prev, [modifierId]: true }))
                        }}
                        onBlur={() => {
                          setTimeout(() => setDropdownOpen((prev) => ({ ...prev, [modifierId]: false })), 200)
                          if (String(currentParallel).trim() === '') {
                            setModifierValue(modifierId, 'parallelLimit', 4)
                          }
                        }}
                        style={{ minWidth: 0 }}
                      />
                      {isOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            marginTop: 2,
                            backgroundColor: 'rgba(3, 8, 16, 1)',
                            border: '1px solid rgba(148, 163, 184, 0.3)',
                            borderRadius: 8,
                            maxHeight: 200,
                            overflowY: 'auto',
                            zIndex: 10,
                          }}
                        >
                          {PARALLEL_PRESETS.map((v) => (
                            <div
                              key={v}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                handleSelectPreset(v)
                              }}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                backgroundColor: String(currentParallel) === String(v) ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                                borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                                fontSize: 12,
                              }}
                            >
                              {v}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}

                <label className="recipe-settings__control recipe-settings__control--inline" key="perfectOverclock">
                  <span>完美超频</span>
                  <input
                    type="checkbox"
                    checked={Boolean(state.perfectOverclock)}
                    onChange={(e) => setModifierValue(modifierId, 'perfectOverclock', e.target.checked)}
                  />
                </label>

                <div className="recipe-settings__multiblock-summary">
                  <span>⚡ 机器总能量池: {formatPower(summary.totalEuPerTick)} {buildUnitSuffix(resolveCategoryDef(registryCategories, 'gt:eu').base_unit, 'rate_per_tick')}</span>
                  <span>👑 最高运行层级: {summary.highestTier}</span>
                  {!summary.canStart && baseEuPerTick > 0 && (
                    <span style={{ color: 'var(--color-danger, #f87171)' }}>⛔ 能量池不足，无法启动</span>
                  )}
                  {summary.canStart && (
                    <>
                      <span>🔁 实际并行: ×{summary.actualParallel}</span>
                      <span>🔁 实际超频: {summary.actualOverclockCount} 次</span>
                      <span>⚡ 最终功耗: {formatPower(summary.finalEuPerTick)} {buildUnitSuffix(resolveCategoryDef(registryCategories, 'gt:eu').base_unit, 'rate_per_tick')}</span>
                      <span>⏱️ 时间缩放: ×{summary.finalDurationScale.toFixed(4)}</span>
                    </>
                  )}
                </div>
              </div>
            )
          }

          return (
            <div className="recipe-settings__modifier-card" key={modifierId}>
              <div className="recipe-settings__modifier-card-header">
                <h6>{modifier.name}</h6>
                <button
                  className={`recipe-editor__icon-action${isFixedModifier ? '' : ' recipe-editor__icon-action--danger'}`}
                  type="button"
                  onClick={() => removeModifier(modifierId)}
                  title={isFixedModifier ? '范式固定修饰器，不可卸载' : '卸载修饰器'}
                  aria-label={isFixedModifier ? '范式固定修饰器，不可卸载' : '卸载修饰器'}
                  disabled={isFixedModifier}
                >
                  {isFixedModifier ? '🔒' : '🗑️'}
                </button>
              </div>
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
        {outputRows.length > 0 && (
          <div className="recipe-editor__row recipe-editor__row--resource-route-header">
            <span className="recipe-editor__row-header-item">ID</span>
            <span className="recipe-editor__row-header-item">数量</span>
            <span className="recipe-editor__row-header-item">度量</span>
            <span className="recipe-editor__row-header-item">类型</span>
            <span className="recipe-editor__row-header-item"></span>
            <span className="recipe-editor__row-header-item"></span>
            <span className="recipe-editor__row-header-item">实际速率</span>
          </div>
        )}
        {outputRows.map(({ resource: output, index }) => {
          const rate = outputRateMap.get(output.id)
          const catDef = registryCategories[output.category]
          const suffix = catDef ? buildUnitSuffix(catDef.base_unit, output.measure_mode) : output.category
          const rateText = rate !== undefined ? `${formatRate(rate)}/s` : ''
          return (
            <div className="recipe-editor__row recipe-editor__row--resource-route" key={output._uid ?? `output-${index}`}>
              <input
                type="text"
                placeholder="资源 ID"
                value={output.id}
                onChange={(e) => updateResourceAtIndex(setBaseOutputs, index, { id: e.target.value })}
              />
              <div className="recipe-editor__input-wrap">
                <input
                  type="number"
                  min={0}
                  value={output.amount}
                  onChange={(e) => updateResourceAtIndex(setBaseOutputs, index, { amount: Number(e.target.value) })}
                />
                <span className="recipe-editor__input-suffix">{suffix}</span>
              </div>
              <select
                value={output.measure_mode ?? 'per_cycle'}
                onChange={(e) => updateResourceAtIndex(setBaseOutputs, index, { measure_mode: e.target.value as MeasureMode })}
              >
                <option value="per_cycle">/次</option>
                <option value="rate_per_tick">/t</option>
                <option value="rate_per_sec">/s</option>
              </select>
              <select
                value={output.category}
                onChange={(e) => updateResourceAtIndex(setBaseOutputs, index, { category: e.target.value })}
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.displayName}</option>
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
              <span className="recipe-editor__row-rate">{rateText}</span>
            </div>
          )
        })}
      </section>

    </div>
  )
}
