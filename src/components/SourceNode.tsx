import { useCallback, useState, type KeyboardEvent } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useNodeData } from '../NodeDataContext'
import { useEndpointEditor } from '../EndpointEditorContext'
import { useResourceRegistry } from '../registry/resourceRegistry'
import { buildUnitSuffix } from '../registry/units'
import { normalizeEndpointPorts, resolveCategoryDef } from '../utils/endpointNorm'
import type { SourceNodeData, SourceNodeMode } from '../types/recipe'
import './SourceNode.css'

function formatValue(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  const rounded = parseFloat(value.toPrecision(6))
  return Number.isFinite(rounded) ? String(rounded) : ''
}

export function SourceNode({ id, data }: NodeProps<SourceNodeData>) {
  const { updateNodeData } = useNodeData()
  const { onEdit } = useEndpointEditor()
  const userCategories = useResourceRegistry((state) => state.categories)
  const userOverrides = useResourceRegistry((state) => state.overrides)
  const ports = normalizeEndpointPorts(data)
  const mode: SourceNodeMode = data.mode ?? ((data.is_auto ?? data.is_virtual ?? true) ? 'infinite' : 'limit')
  const isEditable = mode === 'limit'
  const [draftAmounts, setDraftAmounts] = useState<Record<number, string>>({})

  const handleSetMode = useCallback((nextMode: SourceNodeMode) => {
    if (nextMode === mode) return
    if (nextMode === 'limit') {
      updateNodeData(id, { mode: 'limit', is_auto: false })
    } else {
      updateNodeData(id, { mode: 'infinite', is_auto: true })
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

  return (
    <article className={`source-node source-node--${mode}`}>
      <header className="source-node__header">
        <p className="source-node__kicker">INPUT SOURCE</p>
        <div className="source-node__header-actions">
          <button
            className="source-node__edit-btn nodrag"
            onClick={() => onEdit(id, 'source', data)}
            title="设置"
          >⚙</button>
          <div className="source-node__seg">
            <button
              className={`source-node__mode-btn nodrag${mode === 'limit' ? ' is-active' : ''}`}
              onClick={() => handleSetMode('limit')} title="供给上限"
            >🚧</button>
            <button
              className={`source-node__mode-btn nodrag${mode === 'infinite' ? ' is-active' : ''}`}
              onClick={() => handleSetMode('infinite')} title="无限供应"
            >♾️</button>
          </div>
        </div>
      </header>

      <section className="recipe-node__ports">
        <ul className="recipe-node__port-list recipe-node__port-list--right">
          {ports.map((port, index) => {
            const itemType = port.item_type ?? 'item'
            const catDef = resolveCategoryDef(itemType, userCategories, userOverrides)
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
              <li className="recipe-node__port recipe-node__port--right" key={port._uid ?? `${id}-port-${index}`}>
                <div className="recipe-node__port-core recipe-node__port-core--right">
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
                  <span className="recipe-node__port-name recipe-node__port-name--right">{port.id || '(未命名)'}</span>
                  <span className="recipe-node__port-type" style={{ color: hexColor, borderColor: hexColor }}>
                    {catDef.displayName}
                  </span>
                  <Handle
                    id={handleId}
                    type="source"
                    position={Position.Right}
                    className="recipe-node__handle"
                    style={{ right: '-6px', backgroundColor: hexColor, borderColor: hexColor, boxShadow: `0 0 0 4px ${glowColor}` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </article>
  )
}
