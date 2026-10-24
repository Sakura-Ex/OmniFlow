import { t, useTranslation } from '@/common/i18n'
import { useEditorDraft } from '@/common/components/EditorDraftContext'
import { documentKey } from '@/common/utils/saveBaseline'
import { useState, useMemo } from 'react'
import type { SourceNodeData, TargetNodeData, EndpointPort } from '@/common/types/recipe'
import type { EndpointEditorTarget } from '@/features/canvas/contexts/EndpointEditorContext'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { emptyEndpointPort, normalizeEndpointPorts } from '@/features/recipe/recipe.endpointNorm'
import { generateId } from '@/common/utils/id'
import { DEFAULT_RESOURCE_CATEGORY } from '@/common/utils/resourceId'
import { ResourceDefinitionList } from '@/features/resource-registry/components/ResourceDefinitionList'
import { ENDPOINT_COLUMNS } from '@/features/resource-registry/components/ResourceDefinitionRow.config'
import styles from './EndpointEditor.module.css'

/**
 * Props for an endpoint resource editing session.
 */
type Props = {
  node: EndpointEditorTarget | null
  onClose: () => void
  onSave: (id: string, data: Partial<SourceNodeData & TargetNodeData>) => { ok: boolean } | void
}

/**
 * Edit endpoint resource definitions inside the workspace properties panel.
 * Allows adding, removing, and modifying endpoint ports including their resource category,
 * identifier, amount, routing mode (wired/global), and other column-defined properties.
 *
 * @param props - Component props
 * @param props.node - The endpoint editor target containing the node ID, role (source/target), and current data
 * @param props.onClose - Request to leave through the container's draft guard
 * @param props.onSave - Callback invoked with the node ID and partial data patch when save is confirmed
 * @returns Embedded endpoint editor, or null if no node is provided.
 */
export function EndpointEditor({ node, onClose, onSave }: Props) {
  useTranslation()
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

  const [baseline, setBaseline] = useState(ports)
  const [error, setError] = useState(false)

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
    if (!node) return false
    if (ports.some(port => !port.id.trim() || !Number.isFinite(port.amount) || port.amount < 0)) { setError(true); return false }
    const result = onSave(node.id, { ports })
    if (result && !result.ok) return false
    setBaseline(ports)
    setError(false)
    return true
  }

  useEditorDraft({ dirty: documentKey(ports) !== documentKey(baseline), save: handleSave, discard: () => { setPorts(baseline); setError(false) } })

  if (!node) return null

  return (
      <section className={styles.editor} aria-label={t('canvas.edit_resources')}>
        <div className={styles['ep-editor__body']}>
          {error && <p role="alert" className={styles.error}>{t('workspace.invalid')}</p>}
          <ResourceDefinitionList<EndpointPort>
            items={ports}
            columns={ENDPOINT_COLUMNS}
            emptyMessage={t('canvas.no_resources')}
            addLabel={t('canvas.add_resource')}
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
          <button className={`${styles['ep-editor__btn']} ${styles['ep-editor__btn--cancel']}`} onClick={onClose}>{t('canvas.cancel')}</button>
          <button className={`${styles['ep-editor__btn']} ${styles['ep-editor__btn--save']}`} onClick={handleSave}>{t('canvas.save')}</button>
        </footer>
      </section>
  )
}
