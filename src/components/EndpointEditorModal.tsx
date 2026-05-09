import { useState, useMemo } from 'react'
import type { SourceNodeData, TargetNodeData, EndpointPort } from '../types/recipe'
import type { EndpointEditorTarget } from '../EndpointEditorContext'
import { useResourceRegistry } from '../registry/resourceRegistry'
import { normalizeEndpointPorts, emptyEndpointPort } from '../utils/endpointNorm'
import { ResourceDefinitionList, ENDPOINT_COLUMNS } from './ResourceDefinitionList'
import { useResourceIndexStore } from '../stores/resourceIndexStore'
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
  const { entries: resourceIndex } = useResourceIndexStore()
  const resourceSuggestions = useMemo(() => Object.keys(resourceIndex), [resourceIndex])

  const initialPorts = node ? normalizeEndpointPorts(node.data) : []
  const [ports, setPorts] = useState<EndpointPort[]>(
    initialPorts.length > 0
      ? initialPorts.map((p) => ({ ...p, _uid: p._uid ?? crypto.randomUUID() }))
      : [emptyEndpointPort()]
  )

  if (!node) return null

  const isSource = node.role === 'source'

  const handleUpdatePort = (index: number, patch: Partial<EndpointPort>) => {
    setPorts((prev) => prev.map((p, i) => i === index ? { ...p, ...patch } : p))
  }

  const handleAddPort = () => {
    setPorts((prev) => [...prev, emptyEndpointPort(prev[0]?.category ?? 'item')])
  }

  const handleRemovePort = (index: number) => {
    setPorts((prev) => prev.filter((_, i) => i !== index))
  }

  const handleToggleRouting = (index: number) => {
    setPorts((prev) => prev.map((p, i) => {
      if (i !== index || p.routing_locked) return p
      return { ...p, routing_mode: p.routing_mode === 'global' ? 'wired' : 'global' }
    }))
  }

  const handleSave = () => {
    const validPorts = ports.filter((p) => p.id.trim().length > 0)
    const firstPort = validPorts[0]
    onSave(node.id, {
      id: firstPort?.id ?? '',
      label: firstPort?.id ?? '',
      amount: firstPort?.amount ?? 0,
      category: firstPort?.category ?? 'item',
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
          <ResourceDefinitionList<EndpointPort>
            items={ports}
            columns={ENDPOINT_COLUMNS}
            emptyMessage="暂无资源"
            addLabel="添加资源"
            onUpdateItem={handleUpdatePort}
            onAddItem={handleAddPort}
            onRemoveItem={handleRemovePort}
            onToggleRoutingItem={handleToggleRouting}
            suggestions={resourceSuggestions}
            categoryOptions={categoryOptions}
            getCanDelete={(i) => ports.length > 1}
            getRoutingLocked={(i) => ports[i]?.routing_locked ?? false}
          />
        </div>

        <footer className="ep-editor__footer">
          <button className="ep-editor__btn ep-editor__btn--cancel" onClick={onClose}>取消</button>
          <button className="ep-editor__btn ep-editor__btn--save" onClick={handleSave}>保存</button>
        </footer>
      </div>
    </div>
  )
}
