import { useState, useMemo } from 'react'
import type { SourceNodeData, TargetNodeData, EndpointPort } from '@/common/types/recipe'
import type { EndpointEditorTarget } from '@/features/canvas/contexts/EndpointEditorContext'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { emptyEndpointPort, normalizeEndpointPorts } from '@/features/recipe/recipe.endpointNorm'
import { generateId } from '@/common/utils/id'
import { DEFAULT_RESOURCE_CATEGORY } from '@/common/utils/resourceId'
import { ResourceDefinitionList } from '@/features/resource-registry/components/ResourceDefinitionList'
import { ENDPOINT_COLUMNS } from '@/features/resource-registry/components/ResourceDefinitionRow.config'
import modalStyles from '@/common/components/Modal.module.css'
import styles from './EndpointEditorModal.module.css'

type Props = {
  node: EndpointEditorTarget | null
  onClose: () => void
  onSave: (id: string, data: Partial<SourceNodeData & TargetNodeData>) => void
}

export function EndpointEditorModal({ node, onClose, onSave }: Props) {
  const resourceIndex = useGlobalResourceTable((state) => state.entries)
  const registryCategories = useGlobalResourceTable((state) => state.categories)
  const categoryOptions = useMemo(
    () => Object.values(registryCategories).map((cat) => ({ id: cat.id, displayName: cat.displayName })),
    [registryCategories]
  )
  const resourceSuggestions = useMemo(() => Object.keys(resourceIndex), [resourceIndex])

  const initialPorts = node ? normalizeEndpointPorts(node.data) : []
  const [ports, setPorts] = useState<EndpointPort[]>(
    initialPorts.length > 0
      ? initialPorts.map((p) => ({ ...p, _uid: p._uid ?? generateId() }))
      : [emptyEndpointPort()]
  )

  if (!node) return null

  const isSource = node.role === 'source'

  const handleUpdatePort = (index: number, patch: Partial<EndpointPort>) => {
    setPorts((prev) => prev.map((p, i) => i === index ? { ...p, ...patch } : p))
  }

  const handleAddPort = () => {
    setPorts((prev) => [...prev, emptyEndpointPort(prev[0]?.category ?? DEFAULT_RESOURCE_CATEGORY)])
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
    onSave(node.id, {
      ports: validPorts.length > 0 ? validPorts : ports,
    })
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className={modalStyles.overlay} onClick={handleOverlayClick}>
      <div className={`${modalStyles.panel} ${styles['ep-editor__modal']}`}>
        <header className={modalStyles.header}>
          <div>
            <p className={modalStyles.eyebrow}>{isSource ? 'INPUT SOURCE' : 'OUTPUT DEMAND'}</p>
            <h3 className={styles['ep-editor__title']}>端点设置</h3>
          </div>
          <button className={modalStyles.closeBtn} onClick={onClose} title="关闭">✕</button>
        </header>

        <div className={styles['ep-editor__body']}>
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
            getCanDelete={() => ports.length > 1}
            getRoutingLocked={(i) => ports[i]?.routing_locked ?? false}
          />
        </div>

        <footer className={styles['ep-editor__footer']}>
          <button className={`${styles['ep-editor__btn']} ${styles['ep-editor__btn--cancel']}`} onClick={onClose}>取消</button>
          <button className={`${styles['ep-editor__btn']} ${styles['ep-editor__btn--save']}`} onClick={handleSave}>保存</button>
        </footer>
      </div>
    </div>
  )
}
