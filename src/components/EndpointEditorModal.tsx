import { useState } from 'react'
import type { SourceNodeData, TargetNodeData } from '../types/recipe'
import type { EndpointEditorTarget } from '../EndpointEditorContext'
import './EndpointEditorModal.css'

type Props = {
  node: EndpointEditorTarget | null
  onClose: () => void
  onSave: (id: string, data: Partial<SourceNodeData & TargetNodeData>) => void
}

export function EndpointEditorModal({ node, onClose, onSave }: Props) {
  const [itemId, setItemId] = useState(node?.data.label ?? node?.data.id ?? '')
  const [itemType, setItemType] = useState<'item' | 'fluid'>(node?.data.item_type ?? 'item')
  const [amount, setAmount] = useState(String(node?.data.amount ?? ''))

  if (!node) return null

  const isSource = node.role === 'source'
  const isFluid = itemType === 'fluid'
  const unit = isFluid ? 'mB/s' : '/s'
  const rateLabel = isSource ? `最大供应速率 (${unit})` : `需求速率 (${unit})`

  const handleSave = () => {
    const parsed = parseFloat(amount)
    onSave(node.id, {
      id: itemId.trim() || node.data.id,
      label: itemId.trim() || node.data.id,
      item_type: itemType,
      amount: Number.isFinite(parsed) ? parsed : node.data.amount,
    })
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="ep-editor__overlay" onClick={handleOverlayClick}>
      <div className="ep-editor__modal">
        <header className="ep-editor__header">
          <div>
            <p className="ep-editor__eyebrow">{isSource ? 'INPUT SOURCE' : 'OUTPUT DEMAND'}</p>
            <h3 className="ep-editor__title">端点设置</h3>
          </div>
          <button className="ep-editor__icon-btn" onClick={onClose} title="关闭">✕</button>
        </header>

        <div className="ep-editor__body">
          <div className="ep-editor__field">
            <label>物品 / 流体 ID</label>
            <input
              type="text"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              spellCheck={false}
              placeholder="例：minecraft:water"
            />
          </div>

          <div className="ep-editor__field">
            <label>类型</label>
            <div className="ep-editor__type-row">
              <button
                className={`ep-editor__type-btn${itemType === 'item' ? ' is-active' : ''}`}
                onClick={() => setItemType('item')}
              >
                📦 物品
              </button>
              <button
                className={`ep-editor__type-btn${itemType === 'fluid' ? ' is-active' : ''}`}
                onClick={() => setItemType('fluid')}
              >
                💧 流体
              </button>
            </div>
          </div>

          {!node.data.is_auto && (
            <div className="ep-editor__field">
              <label>{rateLabel}</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={0}
              />
            </div>
          )}
        </div>

        <footer className="ep-editor__footer">
          <button className="ep-editor__btn ep-editor__btn--cancel" onClick={onClose}>取消</button>
          <button className="ep-editor__btn ep-editor__btn--save" onClick={handleSave}>保存</button>
        </footer>
      </div>
    </div>
  )
}
