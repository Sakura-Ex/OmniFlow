import { useState } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import type { RecipeNodeData, RecipeNodeMode } from '../types/recipe'
import { useRecipeEditor } from '../RecipeEditorContext'
import { useNodeData } from '../NodeDataContext'
import { ensureRecipeDataShape, getCalculatedRates } from '../modifiers/calculate'
import { useResourceRegistry } from '../registry/resourceRegistry'
import { resolveCategoryDef } from '../utils/endpointNorm'
import type { ResourceCategoryDef } from '../registry/types'
import type { MeasureMode, Resource } from '../types/types'
import './RecipeNode.css'

function formatPortAmount(
  amount: number,
  catDef: ResourceCategoryDef,
  mMode?: MeasureMode,
  durationSeconds?: number
) {
  if (mMode === 'rate_per_tick' || mMode === 'rate_per_sec') {
    const ticks = typeof durationSeconds === 'number' && durationSeconds > 0 ? durationSeconds * 20 : 1
    const total = amount * ticks
    const rounded = parseFloat(total.toPrecision(6))
    return `${rounded} ${catDef.base_unit}`
  }
  return `x${amount} ${catDef.base_unit}`
}

function formatRateValue(value: number | undefined, mMode?: MeasureMode): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  const displayValue = mMode === 'rate_per_tick' ? value / 20 : value
  const suffix = mMode === 'rate_per_tick' ? '/t' : '/s'
  const fixed = displayValue.toFixed(2)
  const trimmed = fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
  return `${trimmed}${suffix}`
}

function formatDisplayValue(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  const rounded = parseFloat(value.toPrecision(6))
  return Number.isFinite(rounded) ? String(rounded) : ''
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1).replace(/\.0$/, '')}%`
}

export function RecipeNode({ id, data }: NodeProps<RecipeNodeData>) {
  const { onEdit, onAutoFill } = useRecipeEditor()
  const { updateNodeData } = useNodeData()
  const userDims = useResourceRegistry((state) => state.dimensions)
  const userOverrides = useResourceRegistry((state) => state.overrides)
  const normalizedData = ensureRecipeDataShape(data)
  const calculated = getCalculatedRates(normalizedData)
  const materialOutputs = calculated.transformedOutputs.filter((r) => !r.is_utility)
  const hasZeroOutput = materialOutputs.length === 0 || materialOutputs.every((r) => r.amount === 0)
  const mode: RecipeNodeMode = normalizedData.mode ?? ((normalizedData.is_auto ?? true) ? 'auto' : 'limit')
  const isLimit = mode === 'limit'
  const manualCap = typeof normalizedData.manual_machines === 'number' ? normalizedData.manual_machines : null
  const machinesActual = typeof normalizedData.machines_actual === 'number' ? normalizedData.machines_actual : null
  const machinesExact = typeof normalizedData.machines_exact === 'number' ? normalizedData.machines_exact : null
  const runtimeMachines = machinesExact ?? machinesActual
  const [draftManualMachines, setDraftManualMachines] = useState(String(normalizedData.manual_machines ?? ''))

  const handleSetMode = (nextMode: RecipeNodeMode) => {
    if (nextMode === mode) return
    const nextManual = typeof data.manual_machines === 'number'
      ? data.manual_machines
      : machinesActual ?? 1

    updateNodeData(id, {
      mode: nextMode,
      is_auto: nextMode === 'auto',
      manual_machines: nextMode === 'auto' ? data.manual_machines : nextManual,
    })

    if (nextMode === 'limit') {
      setDraftManualMachines(formatDisplayValue(nextManual) || String(nextManual))
    }
  }

  const renderResourceRows = (
    resources: Resource[],
    rates: Resource[],
    side: 'input' | 'output'
  ) => resources.map((res, index) => {
    const typeId = res.utility_type ?? res.category
    const catDef = resolveCategoryDef(typeId, userDims, userOverrides)
    const mMode: MeasureMode | undefined = res.measure_mode
    const hexColor = catDef.themeColor
    const glowColor = hexColor.startsWith('#')
      ? `${hexColor}${Math.round(0.38 * 255).toString(16).padStart(2, '0')}`
      : hexColor.replace(')', ', 0.38)').replace('rgb', 'rgba')

    const rate = rates[index]
    const portRate = calculated.isInstant
      ? 'Instant'
      : formatRateValue(rate?.amount, mMode)
    const handleId = `${res.category}:${res.id || res._uid || `${side}-${index}`}`

    const isLeft = side === 'input'

    return (
      <li className={`recipe-node__port recipe-node__port--${isLeft ? 'left' : 'right'}`} key={res._uid ?? `${id}-${side}-${index}`}>
        <div className={`recipe-node__port-core recipe-node__port-core--${isLeft ? 'left' : 'right'}`}>
          {isLeft ? (
            <>
              {res.routing_mode !== 'global' && (
                <Handle
                  id={handleId} type="target" position={Position.Left}
                  style={{ left: '-6px', backgroundColor: hexColor, borderColor: hexColor, boxShadow: `0 0 0 4px ${glowColor}` }}
                />
              )}
              <span className="recipe-node__port-type" style={{ color: hexColor, borderColor: hexColor }}>{catDef.displayName}</span>
              <span className="recipe-node__port-name recipe-node__port-name--left">{res.id}</span>
              <div className="recipe-node__port-stats recipe-node__port-stats--right">
                <span className="recipe-node__port-amount">{formatPortAmount(res.amount, catDef, mMode, calculated.duration)}</span>
                <span className="recipe-node__port-rate">{portRate}</span>
              </div>
            </>
          ) : (
            <>
              <div className="recipe-node__port-stats recipe-node__port-stats--left">
                <span className="recipe-node__port-amount">{formatPortAmount(res.amount, catDef, mMode)}</span>
                <span className="recipe-node__port-rate">{portRate}</span>
              </div>
              <span className="recipe-node__port-name recipe-node__port-name--right">{res.id}</span>
              <span className="recipe-node__port-type" style={{ color: hexColor, borderColor: hexColor }}>{catDef.displayName}</span>
              {res.routing_mode !== 'global' && (
                <Handle
                  id={handleId} type="source" position={Position.Right}
                  style={{ right: '-6px', backgroundColor: hexColor, borderColor: hexColor, boxShadow: `0 0 0 4px ${glowColor}` }}
                />
              )}
            </>
          )}
        </div>
      </li>
    )
  })

  return (
    <article className={`recipe-node recipe-node--${mode}${hasZeroOutput ? ' recipe-node--zero-output' : ''}`}>
      <header className="recipe-node__header">
        <div className="recipe-node__header-main">
          <div>
            <p className="recipe-node__kicker">Machine Node</p>
            <h2 className="recipe-node__title">{data.machine_name}</h2>
          </div>
        </div>
        <div className="recipe-node__header-actions">
          <button className="recipe-node__autofill-btn" onClick={() => onAutoFill(id)} title="补全未连端口">🪄</button>
          <button className="recipe-node__edit-btn" onClick={() => onEdit(id, data)} title="编辑配方">⚙️</button>
          <div className="recipe-node__seg">
            <button
              className={`recipe-node__mode-btn nodrag${mode === 'auto' ? ' is-active' : ''}`}
              onClick={() => handleSetMode('auto')} title="按需运转"
            >🔄</button>
            <button
              className={`recipe-node__mode-btn nodrag${mode === 'limit' ? ' is-active' : ''}`}
              onClick={() => handleSetMode('limit')} title="产能上限"
            >🚧</button>
          </div>
        </div>
      </header>

      <div className="recipe-node__body">
        <section className="recipe-node__ports recipe-node__ports--inputs">
          <p className="recipe-node__section-label">Inputs</p>
          <ul className="recipe-node__port-list">
            {renderResourceRows(calculated.transformedInputs, calculated.inputRates, 'input')}
          </ul>
        </section>

        <section className="recipe-node__ports recipe-node__ports--outputs">
          <p className="recipe-node__section-label recipe-node__section-label--right">Outputs</p>
          <ul className="recipe-node__port-list recipe-node__port-list--right">
            {renderResourceRows(calculated.transformedOutputs, calculated.outputRates, 'output')}
          </ul>
        </section>
      </div>

      <footer className="recipe-node__footer">
        <div className="recipe-node__footer-line">
          <span className="recipe-node__footer-label">{isLimit ? '🚧 产能上限' : '⚙️ 机器数量'}</span>
          <div className="recipe-node__machine-field">
            <input
              type="number"
              className={`recipe-node__machine-input nodrag${!isLimit ? ' recipe-node__machine-input--auto' : ''}`}
              value={isLimit ? draftManualMachines : formatDisplayValue(machinesActual ?? undefined)}
              readOnly={!isLimit}
              placeholder="[ 等待计算 ]"
              onChange={(event) => {
                if (!isLimit) return
                const nextValue = event.target.value
                setDraftManualMachines(nextValue)
                const parsed = Number.parseFloat(nextValue)
                updateNodeData(id, {
                  mode: 'limit',
                  is_auto: false,
                  manual_machines: Number.isFinite(parsed) ? parsed : undefined,
                })
              }}
            />
            {isLimit && manualCap !== null && manualCap > 0 && runtimeMachines !== null && (
              <span className="recipe-node__utilization-hint">
                实际运转: {formatDisplayValue(runtimeMachines)} 台 ({formatPercent(Math.max(0, Math.min(1, runtimeMachines / manualCap)))})
              </span>
            )}
          </div>
        </div>
      </footer>
    </article>
  )
}
