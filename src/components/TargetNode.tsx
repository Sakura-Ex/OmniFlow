import { useCallback, useState, type KeyboardEvent } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useNodeData } from '../NodeDataContext'
import { useEndpointEditor } from '../EndpointEditorContext'
import { useGlobalResourceTable } from '../registry/globalResourceTable'
import { buildUnitSuffix } from '../registry/units'
import { normalizeEndpointPorts, resolveCategoryDef } from '../utils/endpointNorm'
import { buildResourceId, DEFAULT_RESOURCE_CATEGORY } from '../utils/resourceIdentifier'
import { formatOpExRate } from '../utils/formatters'
import type { TargetNodeData, TargetNodeMode } from '../types/recipe'
import './TargetNode.css'

export function TargetNode({ id, data }: NodeProps<TargetNodeData>) {
  const { updateNodeData } = useNodeData()
  const { onEdit } = useEndpointEditor()
  const userCategories = useGlobalResourceTable((state) => state.categories)
  const userOverrides = useGlobalResourceTable((state) => state.overrides)
  const ports = normalizeEndpointPorts(data)
  const mode: TargetNodeMode = data.mode ?? (data.is_virtual ?? true ? 'maximize' : 'demand')
  const isEditable = mode === 'demand'
  const [draftAmounts, setDraftAmounts] = useState<Record<number, string>>({})

  const handleSetMode = useCallback((nextMode: TargetNodeMode) => {
    if (nextMode === mode) return
    if (nextMode === 'demand') {
      updateNodeData(id, { mode: 'demand' })
    } else {
      updateNodeData(id, { mode: nextMode })
    }
  }, [mode, id, updateNodeData])

  const commitAmount = useCallback((portIndex: number) => {
    const draft = draftAmounts[portIndex]
    if (draft === undefined) return
    const parsed = Number.parseFloat(draft)
    const nextAmount = Number.isFinite(parsed) ? parsed : (ports[portIndex]?.amount ?? 0)
    const nextPorts = ports.map((p, i) => i === portIndex ? { ...p, amount: nextAmount } : p)
    updateNodeData(id, { ports: nextPorts })
    setDraftAmounts((prev) => {
      const next = { ...prev }
      delete next[portIndex]
      return next
    })
  }, [draftAmounts, ports, id, updateNodeData])

  const handleAmountKeyDown = useCallback((portIndex: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setDraftAmounts((prev) => {
        const next = { ...prev }
        delete next[portIndex]
        return next
      })
      event.currentTarget.blur()
    }
  }, [])

  const modeConfig: Record<TargetNodeMode, { icon: string; title: string }> = {
    demand:   { icon: '🎯', title: '固定需求' },
    maximize: { icon: '🚀', title: '最大化产出' },
    overflow: { icon: '🗑️', title: '溢出排放' },
  }

  return (
    <article className={`target-node target-node--${mode}`}>
      <header className="target-node__header">
        <p className="target-node__kicker">OUTPUT DEMAND</p>
        <div className="target-node__header-actions">
          <button
            className="target-node__edit-btn nodrag"
            onClick={() => onEdit(id, 'target', data)}
            title="设置"
          >⚙</button>
          <div className="target-node__seg">
            {(Object.keys(modeConfig) as TargetNodeMode[]).map((m) => (
              <button
                key={m}
                className={`target-node__mode-btn nodrag${mode === m ? ' is-active' : ''}`}
                onClick={() => handleSetMode(m)}
                title={modeConfig[m].title}
              >
                {modeConfig[m].icon}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="recipe-node__ports">
        <ul className="recipe-node__port-list">
          {ports.map((port, index) => {
            const portCategory = port.category ?? DEFAULT_RESOURCE_CATEGORY
            const catDef = resolveCategoryDef(portCategory, userCategories, userOverrides)
            const unit = buildUnitSuffix(catDef.base_unit, 'rate_per_sec')
            const hexColor = catDef.themeColor
            const glowColor = hexColor.startsWith('#')
              ? `${hexColor}${Math.round(0.38 * 255).toString(16).padStart(2, '0')}`
              : hexColor.replace(')', ', 0.38)').replace('rgb', 'rgba')
            const handleId = buildResourceId(portCategory, port.id)
            const actualAmt = data.actual_amounts?.[handleId]
            const draftAmount = draftAmounts[index]
            const inputValue = isEditable
              ? (draftAmount !== undefined ? draftAmount : String(port.amount ?? ''))
              : (actualAmt !== undefined ? formatOpExRate(actualAmt) : '')

            const isGlobal = port.routing_mode === 'global'

            return (
              <li className={`recipe-node__port recipe-node__port--left${isGlobal ? ' recipe-node__port--global' : ''}`} key={port._uid ?? `${id}-port-${index}`}>
                <div className="recipe-node__port-core recipe-node__port-core--left">
                  {isGlobal ? (
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
                      className="recipe-node__handle"
                      style={{ left: '-6px', backgroundColor: hexColor, borderColor: hexColor, boxShadow: `0 0 0 4px ${glowColor}` }}
                    />
                  )}
                  <span className="recipe-node__port-type" style={{ color: hexColor, borderColor: hexColor }}>
                    {catDef.displayName}
                  </span>
                  <span className="recipe-node__port-name recipe-node__port-name--left">{port.id || '(未命名)'}</span>
                  <div className="endpoint-inline-stat">
                    <input
                      type={isEditable ? 'number' : 'text'}
                      className={`endpoint-inline-input nodrag${!isEditable ? ' endpoint-inline-input--readonly' : ''}`}
                      value={inputValue}
                      readOnly={!isEditable}
                      onChange={(e) => isEditable && setDraftAmounts((prev) => ({ ...prev, [index]: e.target.value }))}
                      onBlur={isEditable ? () => commitAmount(index) : undefined}
                      onKeyDown={isEditable ? handleAmountKeyDown(index) : undefined}
                      placeholder="等待计算"
                    />
                    <span className="endpoint-inline-unit">{unit}</span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </article>
  )
}
