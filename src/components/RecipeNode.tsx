import { useState } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import type { RecipeNodeData, RecipeNodeMode } from '../types/recipe'
import { useRecipeEditor } from '../RecipeEditorContext'
import { useNodeData } from '../NodeDataContext'
import { useRecipeStore } from '../stores/recipeStore'
import { runModifierPipeline } from '../modifiers/calculate'
import { useGlobalResourceTable } from '../registry/globalResourceTable'
import { resolveCategoryDef } from '../utils/endpointNorm'
import { formatPortAmount, formatRateValue } from '../utils/resourceFormat'
import { formatOpExRate, formatProbability, formatMachineExact, formatCapEx } from '../utils/formatters'
import type { ResourceCategoryDef } from '../registry/types'
import type { TimeBase, NormalizedResource, ComputedNodePayload } from '../types/types'
import './RecipeNode.css'

function formatDisplayValue(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  return formatOpExRate(value)
}

function formatMachineCount(value: number | undefined, isExact: boolean) {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  return isExact ? formatMachineExact(value) : formatCapEx(value)
}

export function RecipeNode({ id, data }: NodeProps<RecipeNodeData>) {
  const { onEdit, onAutoFill } = useRecipeEditor()
  const { updateNodeData } = useNodeData()
  const userCategories = useGlobalResourceTable((state) => state.categories)
  const userOverrides = useGlobalResourceTable((state) => state.overrides)

  const storedPayload = useRecipeStore((state) => state.getPayload(id))
  const recipe = useRecipeStore((state) => state.recipes[id])
  const machineName = recipe?.machine_name ?? data.machine_name

  const payload: ComputedNodePayload = storedPayload ?? runModifierPipeline(data)
  const hasZeroOutput =
    payload.recipe_outputs.length === 0 ||
    payload.recipe_outputs.every((r) => r.amount === 0)
  const mode: RecipeNodeMode =
    data.mode ?? ((data.is_auto ?? true) ? 'auto' : 'limit')
  const isLimit = mode === 'limit'
  const manualCap =
    typeof data.manual_machines === 'number' ? data.manual_machines : null
  const machinesActual =
    typeof data.machines_actual === 'number' ? data.machines_actual : null
  const machinesExact =
    typeof data.machines_exact === 'number' ? data.machines_exact : null
  const runtimeMachines = machinesExact ?? machinesActual
  const [draftManualMachines, setDraftManualMachines] = useState(
    String(data.manual_machines ?? '')
  )
  const hasUtilities =
    payload.utility_inputs.length > 0 || payload.utility_outputs.length > 0

  const handleSetMode = (nextMode: RecipeNodeMode) => {
    if (nextMode === mode) return
    const nextManual =
      typeof data.manual_machines === 'number'
        ? data.manual_machines
        : machinesActual ?? 1

    updateNodeData(id, {
      mode: nextMode,
      is_auto: nextMode === 'auto',
      manual_machines: nextMode === 'auto' ? data.manual_machines : nextManual,
    })

    if (nextMode === 'limit') {
      setDraftManualMachines(formatMachineCount(nextManual, false) || String(nextManual))
    }
  }

  const renderResourceRows = (
    resources: NormalizedResource[],
    side: 'input' | 'output'
  ) =>
    resources.map((res, index) => {
      const typeId = res.utility_type ?? res.category
      const catDef = resolveCategoryDef(typeId, userCategories, userOverrides)
      const isUnknown = catDef.id === '_fallback'
      const mMode: TimeBase | undefined = res.time_base
      const hexColor = catDef.themeColor
      const glowColor = hexColor.startsWith('#')
        ? `${hexColor}${Math.round(0.38 * 255)
            .toString(16)
            .padStart(2, '0')}`
        : hexColor.replace(')', ', 0.38)').replace('rgb', 'rgba')

      const portRate = payload.is_instant
        ? 'Instant'
        : formatRateValue(res.amount, mMode)
      const handleId = `${res.category}:${res.id || res._uid || `${side}-${index}`}`
      const isLeft = side === 'input'

      return (
        <li
          className={`recipe-node__port recipe-node__port--${isLeft ? 'left' : 'right'}${isUnknown ? ' recipe-node__port--unknown' : ''}`}
          key={res._uid ?? `${id}-${side}-${index}`}
        >
          <div
            className={`recipe-node__port-core recipe-node__port-core--${isLeft ? 'left' : 'right'}`}
          >
            {isLeft ? (
              <>
                {res.routing_mode === 'global' ? (
                  <svg
                    className="recipe-node__global-icon recipe-node__global-icon--left"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke={hexColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <circle cx="12" cy="8" r="6" fill={hexColor} stroke="none" />
                    <path d="M-1 8 A 13 13 0 0 1 12 -5" />
                    <path d="M3 8 A 9 9 0 0 1 12 -1" />
                  </svg>
                ) : (
                  <Handle
                    id={handleId}
                    type="target"
                    position={Position.Left}
                    style={{
                      left: '-6px',
                      backgroundColor: hexColor,
                      borderColor: hexColor,
                      boxShadow: `0 0 0 4px ${glowColor}`,
                    }}
                  />
                )}
                <span
                  className="recipe-node__port-type"
                  style={{ color: hexColor, borderColor: hexColor }}
                >
                  {catDef.displayName}
                </span>
                {isUnknown && <span className="recipe-node__port-warn" title="未知量纲，已从矩阵排除">⚠️</span>}
                <span className="recipe-node__port-name recipe-node__port-name--left">
                  {res.id}
                </span>
                <div className="recipe-node__port-stats recipe-node__port-stats--right">
                  <span className="recipe-node__port-amount">
                    {formatPortAmount(res.amount, catDef, mMode, payload.duration_seconds)}
                  </span>
                  <span className="recipe-node__port-rate">{portRate}</span>
                </div>
              </>
            ) : (
              <>
                <div className="recipe-node__port-stats recipe-node__port-stats--left">
                  <span className="recipe-node__port-amount">
                    {formatPortAmount(res.amount, catDef, mMode, payload.duration_seconds)}
                  </span>
                  <span className="recipe-node__port-rate">{portRate}</span>
                </div>
                <span className="recipe-node__port-name recipe-node__port-name--right">
                  {res.id}
                </span>
                <span
                  className="recipe-node__port-type"
                  style={{ color: hexColor, borderColor: hexColor }}
                >
                  {catDef.displayName}
                </span>
                {isUnknown && <span className="recipe-node__port-warn" title="未知量纲，已从矩阵排除">⚠️</span>}
                {res.routing_mode === 'global' ? (
                  <svg
                    className="recipe-node__global-icon recipe-node__global-icon--right"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke={hexColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <circle cx="12" cy="8" r="6" fill={hexColor} stroke="none" />
                    <path d="M25 8 A 13 13 0 0 0 12 -5" />
                    <path d="M21 8 A 9 9 0 0 0 12 -1" />
                  </svg>
                ) : (
                  <Handle
                    id={handleId}
                    type="source"
                    position={Position.Right}
                    style={{
                      right: '-6px',
                      backgroundColor: hexColor,
                      borderColor: hexColor,
                      boxShadow: `0 0 0 4px ${glowColor}`,
                    }}
                  />
                )}
              </>
            )}
          </div>
        </li>
      )
    })

  return (
    <article
      className={`recipe-node recipe-node--${mode}${hasZeroOutput ? ' recipe-node--zero-output' : ''}`}
    >
      <header className="recipe-node__header">
        <div className="recipe-node__header-main">
          <div>
            <p className="recipe-node__kicker">Machine Node</p>
            <h2 className="recipe-node__title">{machineName}</h2>
          </div>
        </div>
        <div className="recipe-node__header-actions">
          <button
            className="recipe-node__autofill-btn"
            onClick={() => onAutoFill(id)}
            title="补全未连端口"
          >
            🪄
          </button>
          <button
            className="recipe-node__edit-btn"
            onClick={() => onEdit(id, data)}
            title="编辑配方"
          >
            ⚙️
          </button>
          <div className="recipe-node__seg">
            <button
              className={`recipe-node__mode-btn nodrag${mode === 'auto' ? ' is-active' : ''}`}
              onClick={() => handleSetMode('auto')}
              title="按需运转"
            >
              🔄
            </button>
            <button
              className={`recipe-node__mode-btn nodrag${mode === 'limit' ? ' is-active' : ''}`}
              onClick={() => handleSetMode('limit')}
              title="产能上限"
            >
              🚧
            </button>
          </div>
        </div>
      </header>

      <div className="recipe-node__body">
        {/* ── Upper half: Recipe IO ── */}
        <section className="recipe-node__ports recipe-node__ports--inputs">
          <p className="recipe-node__section-label">Inputs</p>
          <ul className="recipe-node__port-list">
            {renderResourceRows(payload.recipe_inputs, 'input')}
          </ul>
        </section>

        <section className="recipe-node__ports recipe-node__ports--outputs">
          <p className="recipe-node__section-label recipe-node__section-label--right">
            Outputs
          </p>
          <ul className="recipe-node__port-list recipe-node__port-list--right">
            {renderResourceRows(payload.recipe_outputs, 'output')}
          </ul>
        </section>

        {/* ── Lower half: Utility IO ── */}
        {hasUtilities && (
          <>
            <section className="recipe-node__ports recipe-node__ports--inputs recipe-node__ports--utility">
              <p className="recipe-node__section-label recipe-node__section-label--utility">
                Infrastructure
              </p>
              <ul className="recipe-node__port-list">
                {renderResourceRows(payload.utility_inputs, 'input')}
              </ul>
            </section>

            <section className="recipe-node__ports recipe-node__ports--outputs recipe-node__ports--utility">
              <p className="recipe-node__section-label recipe-node__section-label--right recipe-node__section-label--utility" />
              <ul className="recipe-node__port-list recipe-node__port-list--right">
                {renderResourceRows(payload.utility_outputs, 'output')}
              </ul>
            </section>
          </>
        )}
      </div>

      <footer className="recipe-node__footer">
        <div className="recipe-node__footer-line">
          <span className="recipe-node__footer-label">
            {isLimit ? '🚧 产能上限' : '⚙️ 机器数量'}
          </span>
          <div className="recipe-node__machine-field">
            <input
              type="number"
              className={`recipe-node__machine-input nodrag${!isLimit ? ' recipe-node__machine-input--auto' : ''}`}
              value={
                isLimit
                  ? draftManualMachines
                  : formatMachineCount(machinesExact ?? machinesActual, !!machinesExact)
              }
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
            {isLimit &&
              manualCap !== null &&
              manualCap > 0 &&
              runtimeMachines !== null && (
                <span className="recipe-node__utilization-hint">
                  实际运转: {formatMachineCount(runtimeMachines, !!machinesExact)} 台 (
                  {formatProbability(
                    Math.max(0, Math.min(1, runtimeMachines / manualCap))
                  )}
                  )
                </span>
              )}
          </div>
        </div>
      </footer>
    </article>
  )
}
