import { useMemo } from 'react'
import { useResourceIndex } from '../hooks/useResourceIndex'
import { useResourceRegistry } from '../registry/resourceRegistry'
import { buildUnitSuffix } from '../registry/units'
import './ResourceRegistryPanel.css'

type ResourceIndexPanelProps = {
  onClose: () => void
  usedResourceKeys: string[]
}

export function ResourceIndexPanel({ onClose, usedResourceKeys }: ResourceIndexPanelProps) {
  const { entries, setEntry, removeEntry } = useResourceIndex()
  const registryCategories = useResourceRegistry((state) => state.categories)

  const entryList = useMemo(() => Object.entries(entries), [entries])
  const usedSet = useMemo(() => new Set(usedResourceKeys), [usedResourceKeys])

  const unusedKeys = useMemo(
    () => entryList.filter(([key]) => !usedSet.has(key)).map(([key]) => key),
    [entryList, usedSet],
  )

  const handleRemoveUnused = () => {
    for (const key of unusedKeys) {
      removeEntry(key)
    }
  }

  return (
    <div className="resource-registry__overlay" role="presentation">
      <div className="resource-registry__modal" role="dialog" aria-modal="true">
        <header className="resource-registry__header">
          <div>
            <p className="resource-registry__eyebrow">Project Data</p>
            <h3 className="resource-registry__title">资源表</h3>
          </div>
          <button className="resource-registry__icon-btn" onClick={onClose} title="关闭">✕</button>
        </header>

        <div className="resource-registry__body">
          <p className="resource-registry__hint">
            资源表自动收录项目中出现过的所有资源。可在下方补充别名、备注等信息。
          </p>

          <div className="resource-registry__list-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h4>已收录资源 ({entryList.length})</h4>
              {unusedKeys.length > 0 && (
                <button
                  className="resource-registry__btn resource-registry__btn--danger"
                  onClick={handleRemoveUnused}
                >
                  清理未使用资源 ({unusedKeys.length})
                </button>
              )}
            </div>

            <div className="resource-registry__table">
              <div className="resource-registry__table-row resource-registry__table-row--header">
                <span>标识符</span>
                <span>别名</span>
                <span>类别</span>
                <span>使用中</span>
                <span>操作</span>
              </div>
              {entryList.map(([fullId, def]) => {
                const idx = fullId.lastIndexOf(':')
                const catId = idx > 0 ? fullId.slice(0, idx) : ''
                const catDef = registryCategories[catId]
                const inUse = usedSet.has(fullId)

                return (
                  <div className="resource-registry__table-row" key={fullId}>
                    <span className="resource-registry__mono">{fullId}</span>
                    <input
                      type="text"
                      placeholder="(无别名)"
                      value={def.displayName ?? ''}
                      onChange={(e) => setEntry(fullId, { ...def, displayName: e.target.value || undefined })}
                    />
                    <span style={{ fontSize: 12, opacity: 0.7 }}>
                      {catDef?.displayName ?? catId}
                      {catDef ? ` (${catDef.base_unit})` : ''}
                    </span>
                    <span style={{ fontSize: 12, color: inUse ? '#4ade80' : 'rgba(148,163,184,0.4)' }}>
                      {inUse ? '✓' : '—'}
                    </span>
                    <button
                      className="resource-registry__btn resource-registry__btn--danger"
                      onClick={() => removeEntry(fullId)}
                    >
                      删除
                    </button>
                  </div>
                )
              })}
              {entryList.length === 0 && (
                <p className="resource-registry__empty" style={{ padding: 12, fontSize: 12, opacity: 0.5 }}>
                  暂无资源。在配方中填写资源 ID 后会自动收录。
                </p>
              )}
            </div>
          </div>
        </div>

        <footer className="resource-registry__footer">
          <button className="resource-registry__btn" onClick={onClose}>关闭</button>
        </footer>
      </div>
    </div>
  )
}
