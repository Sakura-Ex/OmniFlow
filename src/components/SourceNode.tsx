import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useNodeData } from '../NodeDataContext'
import { useEndpointEditor } from '../EndpointEditorContext'
import type { SourceNodeData, SourceNodeMode } from '../types/recipe'
import './SourceNode.css'

function formatValue(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  // Strip float noise: round to 6 sig figs, then remove trailing zeros
  const rounded = parseFloat(value.toPrecision(6))
  return Number.isFinite(rounded) ? String(rounded) : ''
}

export function SourceNode({ id, data }: NodeProps<SourceNodeData>) {
  const { updateNodeData } = useNodeData()
  const { onEdit } = useEndpointEditor()
  // mode 优先；回退到 is_auto / is_virtual 字段（兼容旧存档）
  const mode: SourceNodeMode = data.mode ?? ((data.is_auto ?? data.is_virtual ?? true) ? 'infinite' : 'limit')
  const isLimit = mode === 'limit'
  const isFluid = (data.item_type ?? 'item') === 'fluid'
  const [draftId, setDraftId] = useState(data.label ?? data.id)
  const [draftAmount, setDraftAmount] = useState(String(data.amount))

  useEffect(() => {
    setDraftId(data.label ?? data.id)
    setDraftAmount(formatValue(data.amount) || String(data.amount))
  }, [data.id, data.label, data.amount])

  const handleSetMode = useCallback((nextMode: SourceNodeMode) => {
    if (nextMode === mode) return
    if (nextMode === 'limit') {
      const raw = data.actual_amount ?? data.amount
      const clean = parseFloat(parseFloat(String(raw)).toPrecision(6))
      updateNodeData(id, { mode: 'limit', is_auto: false, amount: clean })
      setDraftAmount(formatValue(raw) || String(raw))
    } else {
      updateNodeData(id, { mode: 'infinite', is_auto: true })
    }
  }, [mode, data.amount, data.actual_amount, id, updateNodeData])

  const commitId = useCallback(() => {
    const trimmed = draftId.trim()
    const nextId = trimmed.length > 0 ? trimmed : data.id

    updateNodeData(
      id,
      { id: nextId, label: nextId },
      nextId !== data.id
        ? { role: 'source', previousId: data.id, nextId }
        : undefined
    )

    setDraftId(nextId)
  }, [draftId, data.id, id, updateNodeData])

  const commitAmount = useCallback(() => {
    const parsed = Number.parseFloat(draftAmount)
    const nextAmount = Number.isFinite(parsed) ? parsed : data.amount

    updateNodeData(id, { amount: nextAmount })
    setDraftAmount(String(nextAmount))
  }, [draftAmount, data.amount, id, updateNodeData])

  const handleIdKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setDraftId(data.label ?? data.id)
      event.currentTarget.blur()
    }
  }, [data.id, data.label])

  const handleAmountKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setDraftAmount(String(data.amount))
      event.currentTarget.blur()
    }
  }, [data.amount])

  const displayAmount = isLimit ? draftAmount : formatValue(data.actual_amount)

  return (
    <article className={`source-node source-node--${mode}`}>
      <header className="source-node__header">
        <p className="source-node__kicker">INPUT SOURCE</p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <button
            className="source-node__edit-btn nodrag"
            onClick={() => onEdit(id, 'source', data)}
            title="设置"
          >
            ⚙
          </button>
          <div className="source-node__seg">
            <button
              className={`source-node__mode-btn nodrag${mode === 'limit' ? ' is-active' : ''}`}
              onClick={() => handleSetMode('limit')}
              title="供给上限"
            >
              🚧
            </button>
            <button
              className={`source-node__mode-btn nodrag${mode === 'infinite' ? ' is-active' : ''}`}
              onClick={() => handleSetMode('infinite')}
              title="无限供应"
            >
              ♾️
            </button>
          </div>
        </div>
      </header>

      <div className="source-node__body">
        <div className="source-node__row">
          <span className="source-node__row-label">物品 ID</span>
          <input
            type="text"
            className="source-node__input nodrag"
            value={draftId}
            onChange={(event) => setDraftId(event.target.value)}
            onBlur={commitId}
            onKeyDown={handleIdKeyDown}
            spellCheck={false}
            title="Item Id"
          />
        </div>
        <div className="source-node__row">
          <span className="source-node__row-label">
            {isLimit ? `供给上限 (${isFluid ? 'mB/s' : '/s'})` : `实际消耗量 (${isFluid ? 'mB/s' : '/s'})`}
          </span>
          <input
            type="number"
            className={`source-node__input nodrag${!isLimit ? ' source-node__input--auto' : ''}`}
            value={displayAmount}
            readOnly={!isLimit}
            onChange={(event) => { if (isLimit) setDraftAmount(event.target.value) }}
            onBlur={isLimit ? commitAmount : undefined}
            onKeyDown={isLimit ? handleAmountKeyDown : undefined}
            placeholder="[ 等待计算 ]"
          />
        </div>
      </div>

      <Handle
        id={data.id}
        type="source"
        position={Position.Right}
        className="source-node__handle"
        style={{ right: '-6px' }}
      />
    </article>
  )
}
