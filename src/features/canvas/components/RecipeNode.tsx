import { useState } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import type { RecipeNodeData, RecipeNodeMode } from '@/common/types/recipe'
import { useRecipeEditor } from '@/features/recipe/contexts/RecipeEditorContext'
import { useNodeData } from '@/features/canvas/contexts/NodeDataContext'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { runModifierPipeline } from '@/features/modifier/modifier.pipeline'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { resolveCategoryDef } from '@/features/recipe/recipe.endpointNorm'
import { formatPortAmount, formatRateValue } from '@/common/utils/rateFormat'
import { formatProbability, formatMachineExact, formatCapEx } from '@/common/utils/format'
import type { TimeBase, ResourceIo, NormalizedResource, ComputedNodePayload } from '@/common/types/resource'
import styles from './RecipeNode.module.css'
import shared from './shared-port.module.css'

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
  const isImplemented = recipe?.is_implemented ?? false

  const payload: ComputedNodePayload = storedPayload ?? runModifierPipeline(data)
  const hasZeroOutput =
    payload.recipe_outputs.length === 0 ||
    payload.recipe_outputs.every((r) => r.amount === 0)
  const mode: RecipeNodeMode =
    data.mode ?? 'auto'
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
      manual_machines: nextMode === 'auto' ? data.manual_machines : nextManual,
    })

    if (nextMode === 'limit') {
      setDraftManualMachines(String(nextManual))
    }
  }

  const handleToggleImplemented = () => {
    useRecipeStore.getState().updateRecipe(id, { is_implemented: !isImplemented })
  }

  const renderResourceRows = (
    resources: NormalizedResource[],
    side: ResourceIo
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

      const portRate = payload.duration_seconds === 0
        ? 'Instant'
        : formatRateValue(res.amount, mMode)
      const handleId = `${res.category}:${res.id || res._uid || `${side}-${index}`}`
      const isLeft = side === 'input'

      return (
        <li
          className={`${shared['recipe-node__port']} ${shared[`recipe-node__port--${isLeft ? 'left' : 'right'}`]}${isUnknown ? ` ${styles['recipe-node__port--unknown']}` : ''}`}
          key={res._uid ?? `${id}-${side}-${index}`}
        >
          <div
            className={`${shared['recipe-node__port-core']} ${shared[`recipe-node__port-core--${isLeft ? 'left' : 'right'}`]}`}
          >
            {isLeft ? (
              <>
                {res.routing_mode === 'global' ? (
                  <svg
                    className={`${shared['recipe-node__global-icon']} ${shared['recipe-node__global-icon--left']}`}
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
                  className={shared['recipe-node__port-type']}
                  style={{ color: hexColor, borderColor: hexColor }}
                >
                  {catDef.displayName}
                </span>
                {isUnknown && <span className={styles['recipe-node__port-warn']} title="未知量纲，已从矩阵排除">⚠️</span>}
                <span className={`${shared['recipe-node__port-name']} ${shared['recipe-node__port-name--left']}`}>
                  {res.id}
                </span>
                <div className={`${styles['recipe-node__port-stats']} ${styles['recipe-node__port-stats--right']}`}>
                  <span className={styles['recipe-node__port-amount']}>
                    {formatPortAmount(res.amount, catDef, mMode, payload.duration_seconds)}
                  </span>
                  <span className={styles['recipe-node__port-rate']}>{portRate}</span>
                </div>
              </>
            ) : (
              <>
                <div className={`${styles['recipe-node__port-stats']} ${styles['recipe-node__port-stats--left']}`}>
                  <span className={styles['recipe-node__port-amount']}>
                    {formatPortAmount(res.amount, catDef, mMode, payload.duration_seconds)}
                  </span>
                  <span className={styles['recipe-node__port-rate']}>{portRate}</span>
                </div>
                <span className={`${shared['recipe-node__port-name']} ${shared['recipe-node__port-name--right']}`}>
                  {res.id}
                </span>
                <span
                  className={shared['recipe-node__port-type']}
                  style={{ color: hexColor, borderColor: hexColor }}
                >
                  {catDef.displayName}
                </span>
                {isUnknown && <span className={styles['recipe-node__port-warn']} title="未知量纲，已从矩阵排除">⚠️</span>}
                {res.routing_mode === 'global' ? (
                  <svg
                    className={`${shared['recipe-node__global-icon']} ${shared['recipe-node__global-icon--right']}`}
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
      className={`${styles['recipe-node']} ${styles[`recipe-node--${mode}`]}${hasZeroOutput ? ` ${styles['recipe-node--zero-output']}` : ''}${isImplemented ? ` ${styles['recipe-node--implemented']}` : ''}`}
    >
      <header className={styles['recipe-node__header']}>
        <div className={styles['recipe-node__header-main']}>
          <div>
            <p className={styles['recipe-node__kicker']}>Machine Node</p>
            <h2 className={styles['recipe-node__title']}>{machineName}</h2>
          </div>
        </div>
        <div className={styles['recipe-node__header-actions']}>
          <button
            type="button"
            className={`${styles['recipe-node__implement-btn']} nodrag${isImplemented ? ` ${styles['is-active']}` : ''}`}
            onClick={handleToggleImplemented}
            title={isImplemented ? '已实装' : '未实装'}
            aria-label="切换实装状态"
            aria-pressed={isImplemented}
          >
            ✅
          </button>
          <button
            className={styles['recipe-node__autofill-btn']}
            onClick={() => onAutoFill(id)}
            title="补全未连端口"
          >
            🪄
          </button>
          <button
            className={styles['recipe-node__edit-btn']}
            onClick={() => onEdit(id, data)}
            title="编辑配方"
          >
            ⚙️
          </button>
          <div className={styles['recipe-node__seg']}>
            <button
              className={`${styles['recipe-node__mode-btn']} nodrag${mode === 'auto' ? ` ${styles['is-active']}` : ''}`}
              onClick={() => handleSetMode('auto')}
              title="按需运转"
            >
              🔄
            </button>
            <button
              className={`${styles['recipe-node__mode-btn']} nodrag${mode === 'limit' ? ` ${styles['is-active']}` : ''}`}
              onClick={() => handleSetMode('limit')}
              title="产能上限"
            >
              🚧
            </button>
          </div>
        </div>
      </header>

      <div className={styles['recipe-node__body']}>
        <section className={`${shared['recipe-node__ports']} ${styles['recipe-node__ports--inputs']}`}>
          <p className={styles['recipe-node__section-label']}>Inputs</p>
          <ul className={shared['recipe-node__port-list']}>
            {renderResourceRows(payload.recipe_inputs, 'input')}
          </ul>
        </section>

        <section className={`${shared['recipe-node__ports']} ${styles['recipe-node__ports--outputs']}`}>
          <p className={`${styles['recipe-node__section-label']} ${styles['recipe-node__section-label--right']}`}>
            Outputs
          </p>
          <ul className={`${shared['recipe-node__port-list']} ${shared['recipe-node__port-list--right']}`}>
            {renderResourceRows(payload.recipe_outputs, 'output')}
          </ul>
        </section>

        {hasUtilities && (
          <>
            <section className={`${shared['recipe-node__ports']} ${styles['recipe-node__ports--inputs']} ${styles['recipe-node__ports--utility']}`}>
              <p className={`${styles['recipe-node__section-label']} ${styles['recipe-node__section-label--utility']}`}>
                Infrastructure
              </p>
              <ul className={shared['recipe-node__port-list']}>
                {renderResourceRows(payload.utility_inputs, 'input')}
              </ul>
            </section>

            <section className={`${shared['recipe-node__ports']} ${styles['recipe-node__ports--outputs']} ${styles['recipe-node__ports--utility']}`}>
              <p className={`${styles['recipe-node__section-label']} ${styles['recipe-node__section-label--right']} ${styles['recipe-node__section-label--utility']}`} />
              <ul className={`${shared['recipe-node__port-list']} ${shared['recipe-node__port-list--right']}`}>
                {renderResourceRows(payload.utility_outputs, 'output')}
              </ul>
            </section>
          </>
        )}
      </div>

      <footer className={styles['recipe-node__footer']}>
        <div className={styles['recipe-node__footer-line']}>
          <span className={styles['recipe-node__footer-label']}>
            {isLimit ? '🚧 产能上限' : '⚙️ 机器数量'}
          </span>
          <div className={styles['recipe-node__machine-field']}>
            <input
              type={isLimit ? 'number' : 'text'}
              className={`${styles['recipe-node__machine-input']} nodrag${!isLimit ? ` ${styles['recipe-node__machine-input--auto']}` : ''}`}
              value={
            isLimit
              ? draftManualMachines
              : formatMachineCount((machinesExact ?? machinesActual) ?? undefined, !!machinesExact)
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
                  manual_machines: Number.isFinite(parsed) ? parsed : undefined,
                })
              }}
            />
            {isLimit &&
              manualCap !== null &&
              manualCap > 0 &&
              runtimeMachines !== null && (
                <span className={styles['recipe-node__utilization-hint']}>
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
