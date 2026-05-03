import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useNodeData } from '../NodeDataContext'
import { useEndpointEditor } from '../EndpointEditorContext'
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
  // mode 优先；字段回退：is_auto=true 映射 maximize，is_auto=false 映射 demand
  const mode: TargetNodeMode = data.mode ?? ((data.is_auto ?? data.is_virtual ?? true) ? 'maximize' : 'demand')
  const isDemand = mode === 'demand'
  const isFluid = (data.item_type ?? 'item') === 'fluid'
  const [draftId, setDraftId] = useState(data.label ?? data.id)
  const [draftAmount, setDraftAmount] = useState(String(data.amount))

  useEffect(() => {
    setDraftId(data.label ?? data.id)
    setDraftAmount(formatValue(data.amount) || String(data.amount))
  }, [data.id, data.label, data.amount])

  const handleSetMode = useCallback((nextMode: TargetNodeMode) => {
    if (nextMode === mode) return
    if (nextMode === 'demand') {
      const raw = data.actual_amount ?? data.amount
      const clean = parseFloat(parseFloat(String(raw)).toPrecision(6))
      updateNodeData(id, { mode: 'demand', is_auto: false, amount: clean })
      setDraftAmount(formatValue(raw) || String(raw))
    } else {
      updateNodeData(id, { mode: nextMode, is_auto: true })
    }
  }, [mode, data.amount, data.actual_amount, id, updateNodeData])

  const commitId = useCallback(() => {
    const trimmed = draftId.trim()
    const nextId = trimmed.length > 0 ? trimmed : data.id

    updateNodeData(
      id,
      { id: nextId, label: nextId },
      nextId !== data.id
        ? { role: 'target', previousId: data.id, nextId }
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

  const displayAmount = isDemand ? draftAmount : formatValue(data.actual_amount)

  const modeConfig: Record<TargetNodeMode, { icon: string; title: string }> = {
    demand:   { icon: '🎯', title: '固定需求' },
    maximize: { icon: '🚀', title: '最大化产出' },
    overflow: { icon: '🗑️', title: '溢出排放' },
  }

  return (
    <article className={`target-node target-node--${mode}`}>
      <header className="target-node__header">
        <p className="target-node__kicker">OUTPUT DEMAND</p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <button
            className="target-node__edit-btn nodrag"
            onClick={() => onEdit(id, 'target', data)}
            title="设置"
          >
            ⚙
          </button>
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

      <div className="target-node__body">
        <div className="target-node__row">
          <span className="target-node__row-label">物品 ID</span>
          <input
            type="text"
            className="target-node__input nodrag"
            value={draftId}
            onChange={(event) => setDraftId(event.target.value)}
            onBlur={commitId}
            onKeyDown={handleIdKeyDown}
            spellCheck={false}
            title="Item Id"
          />
        </div>
        <div className="target-node__row">
          <span className="target-node__row-label">
            {isDemand ? `需求速率 (${isFluid ? 'mB/s' : '/s'})` : `实际产出 (${isFluid ? 'mB/s' : '/s'})`}
          </span>
          <input
            type="number"
            className={`target-node__input nodrag${!isDemand ? ' target-node__input--auto' : ''}`}
            value={displayAmount}
            readOnly={!isDemand}
            onChange={(event) => { if (isDemand) setDraftAmount(event.target.value) }}
            onBlur={isDemand ? commitAmount : undefined}
            onKeyDown={isDemand ? handleAmountKeyDown : undefined}
            placeholder="[ 等待计算 ]"
          />
        </div>
      </div>

      <Handle
        id={data.id}
        type="target"
        position={Position.Left}
        className="target-node__handle"
        style={{ left: '-6px' }}
      />
    </article>
  )
}
