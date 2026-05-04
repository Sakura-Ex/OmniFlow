import { useState, useMemo } from 'react'
import type { SourceNodeData, TargetNodeData, EndpointPort } from '../types/recipe'
import type { EndpointEditorTarget } from '../EndpointEditorContext'
import { useResourceRegistry } from '../registry/resourceRegistry'
import { normalizeEndpointPorts, emptyEndpointPort } from '../utils/endpointNorm'
import './EndpointEditorModal.css'

type Props = {
  node: EndpointEditorTarget | null
  onClose: () => void
  onSave: (id: string, data: Partial<SourceNodeData & TargetNodeData>) => void
}

export function EndpointEditorModal({ node, onClose, onSave }: Props) {
  const registryCategories = useResourceRegistry((state) => state.categories)
  const categoryOptions = useMemo(
    () => Object.values(registryCategories).map((cat) => ({ id: cat.id, displayName: cat.displayName })),
    [registryCategories]
  )

  const initialPorts = node ? normalizeEndpointPorts(node.data) : []
  const [ports, setPorts] = useState<EndpointPort[]>(
    initialPorts.length > 0
      ? initialPorts.map((p) => ({ ...p, _uid: p._uid ?? crypto.randomUUID() }))
      : [emptyEndpointPort()]
  )

  if (!node) return null

  const isSource = node.role === 'source'

  const updatePort = (index: number, patch: Partial<EndpointPort>) => {
    setPorts((prev) => prev.map((p, i) => i === index ? { ...p, ...patch } : p))
  }

  const addPort = () => {
    setPorts((prev) => [...prev, emptyEndpointPort(prev[0]?.item_type ?? 'item')])
  }

  const removePort = (index: number) => {
    setPorts((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const handleSave = () => {
    const validPorts = ports.filter((p) => p.id.trim().length > 0)
    const firstPort = validPorts[0]
    onSave(node.id, {
      // Keep backward compat fields
      id: firstPort?.id ?? '',
      label: firstPort?.id ?? '',
      amount: firstPort?.amount ?? 0,
      item_type: firstPort?.item_type ?? 'item',
      // Main data shape
      ports: validPorts.length > 0 ? validPorts : ports,
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
          <div className="ep-editor__port-table">
            <div className="ep-editor__port-table-header">
              <span>资源 ID</span>
              <span>类型</span>
              <span></span>
            </div>
            {ports.map((port, index) => (
              <div className="ep-editor__port-row" key={port._uid ?? index}>
                  <input
                    type="text"
                    value={port.id}
                    onChange={(e) => updatePort(index, { id: e.target.value })}
                    spellCheck={false}
                    placeholder="例：iron_ingot"
                  />
                  <select
                    value={port.item_type}
                    onChange={(e) => updatePort(index, { item_type: e.target.value })}
                  >
                    {categoryOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.displayName}</option>
                    ))}
                  </select>
                  <button
                    className="ep-editor__port-remove-btn"
                    onClick={() => removePort(index)}
                    disabled={ports.length <= 1}
                    title="删除此行"
                  >✕</button>
                </div>
            ))}
            <button className="ep-editor__add-port-btn" onClick={addPort}>+ 添加资源</button>
          </div>
        </div>

        <footer className="ep-editor__footer">
          <button className="ep-editor__btn ep-editor__btn--cancel" onClick={onClose}>取消</button>
          <button className="ep-editor__btn ep-editor__btn--save" onClick={handleSave}>保存</button>
        </footer>
      </div>
    </div>
  )
}
