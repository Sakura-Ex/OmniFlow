import { useCallback, useState, type KeyboardEvent } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useNodeData } from '../NodeDataContext'
import { useEndpointEditor } from '../EndpointEditorContext'
import { useResourceRegistry } from '../registry/resourceRegistry'
import { buildUnitSuffix } from '../registry/units'
import { normalizeEndpointPorts, resolveCategoryDef } from '../utils/endpointNorm'
import type { TargetNodeData, TargetNodeMode } from '../types/recipe'
import './TargetNode.css'

function formatValue(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  const rounded = parseFloat(value.toPrecision(6))
  return Number.isFinite(rounded) ? String(rounded) : ''
}

export function TargetNode({ id, data }: NodeProps<TargetNodeData>) {
  const { updateNodeData } = useNodeData()
  const { onEdit } = useEndpointEditor()
  const registryCategories = useResourceRegistry((state) => state.categories)
  const ports = normalizeEndpointPorts(data)
  const mode: TargetNodeMode = data.mode ?? ((data.is_auto ?? data.is_virtual ?? true) ? 'maximize' : 'demand')
  const isEditable = mode === 'demand'
  const [draftAmounts, setDraftAmounts] = useState<Record<number, string>>({})

  const handleSetMode = useCallback((nextMode: TargetNodeMode) => {
    if (nextMode === mode) return
    if (nextMode === 'demand') {
      updateNodeData(id, { mode: 'demand', is_auto: false })
    } else {
      updateNodeData(id, { mode: nextMode, is_auto: true })
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
            const itemType = port.item_type ?? 'item'
            const catDef = resolveCategoryDef(registryCategories, itemType)
            const unit = buildUnitSuffix(catDef.base_unit, 'rate_per_sec')
            const hexColor = catDef.themeColor
            const glowColor = hexColor.startsWith('#')
              ? `${hexColor}${Math.round(0.38 * 255).toString(16).padStart(2, '0')}`
              : hexColor.replace(')', ', 0.38)').replace('rgb', 'rgba')
            const handleId = `${itemType}:${port.id}`
            const actualAmt = data.actual_amounts?.[port.id]
            const draftAmount = draftAmounts[index]
            const displayValue = isEditable
              ? (draftAmount !== undefined ? draftAmount : formatValue(port.amount) || String(port.amount))
              : (actualAmt !== undefined ? formatValue(actualAmt) : '')

            return (
              <li className="recipe-node__port recipe-node__port--left" key={port._uid ?? `${id}-port-${index}`}>
                <div className="recipe-node__port-core recipe-node__port-core--left">
                  <Handle
                    id={handleId}
                    type="target"
                    position={Position.Left}
                    className="recipe-node__handle"
                    style={{ left: '-6px', backgroundColor: hexColor, borderColor: hexColor, boxShadow: `0 0 0 4px ${glowColor}` }}
                  />
                  <span className="recipe-node__port-type" style={{ color: hexColor, borderColor: hexColor }}>
                    {catDef.displayName}
                  </span>
                  <span className="recipe-node__port-name recipe-node__port-name--left">{port.id || '(未命名)'}</span>
                  <div className="endpoint-inline-stat">
                    <input
                      type="number"
                      className={`endpoint-inline-input nodrag${!isEditable ? ' endpoint-inline-input--readonly' : ''}`}
                      value={displayValue}
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
