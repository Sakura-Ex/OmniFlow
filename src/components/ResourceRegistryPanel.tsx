import { useState } from 'react'
import { useResourceRegistry } from '../registry/resourceRegistry'
import type { ResourceCategoryDef } from '../registry/types'
import './ResourceRegistryPanel.css'

type ResourceRegistryPanelProps = {
  onClose: () => void
}

function emptyDef(): ResourceCategoryDef {
  return {
    id: '',
    displayName: '',
    base_unit: '',
    themeColor: '#94a3b8',
    defaultRouting: 'wired',
  }
}

export function ResourceRegistryPanel({ onClose }: ResourceRegistryPanelProps) {
  const { categories, addCategory, updateCategory, removeCategory } = useResourceRegistry()
  const [draft, setDraft] = useState<ResourceCategoryDef>(emptyDef())

  const entries = Object.values(categories)

  const handleAdd = () => {
    const trimmed = draft.id.trim()
    if (!trimmed) return
    addCategory({ ...draft, id: trimmed })
    setDraft(emptyDef())
  }

  return (
    <div className="resource-registry__overlay" role="presentation">
      <div className="resource-registry__modal" role="dialog" aria-modal="true">
        <header className="resource-registry__header">
          <div>
            <p className="resource-registry__eyebrow">Global Settings</p>
            <h3 className="resource-registry__title">全局资源字典</h3>
          </div>
          <button className="resource-registry__icon-btn" onClick={onClose} title="关闭">✕</button>
        </header>

        <div className="resource-registry__body">
          <div className="resource-registry__add-section">
            <h4>添加新资源类型</h4>
            <div className="resource-registry__add-row">
              <input
                type="text"
                placeholder="类型 ID (如 create:su)"
                value={draft.id}
                onChange={(e) => setDraft((prev) => ({ ...prev, id: e.target.value }))}
              />
              <input
                type="text"
                placeholder="显示名称"
                value={draft.displayName}
                onChange={(e) => setDraft((prev) => ({ ...prev, displayName: e.target.value }))}
              />
              <input
                type="text"
                placeholder="单位 (如 RPM)"
                value={draft.base_unit}
                onChange={(e) => setDraft((prev) => ({ ...prev, base_unit: e.target.value }))}
              />
              <input
                type="color"
                value={draft.themeColor}
                onChange={(e) => setDraft((prev) => ({ ...prev, themeColor: e.target.value }))}
                className="resource-registry__color-input"
              />
              <select
                value={draft.defaultRouting}
                onChange={(e) => setDraft((prev) => ({ ...prev, defaultRouting: e.target.value as 'wired' | 'global' }))}
              >
                <option value="wired">有线 (Wired)</option>
                <option value="global">全局总线 (Global)</option>
              </select>
              <button className="resource-registry__btn resource-registry__btn--primary" onClick={handleAdd}>
                添加
              </button>
            </div>
          </div>

          <div className="resource-registry__list-section">
            <h4>已注册资源类型 ({entries.length})</h4>
            <div className="resource-registry__table">
              <div className="resource-registry__table-row resource-registry__table-row--header">
                <span>类型 ID</span>
                <span>显示名称</span>
                <span>单位</span>
                <span>颜色</span>
                <span>默认路由</span>
                <span>操作</span>
              </div>
              {entries.map((entry) => (
                <div className="resource-registry__table-row" key={entry.id}>
                  <span className="resource-registry__mono">{entry.id}</span>
                  <input
                    type="text"
                    value={entry.displayName}
                    onChange={(e) => updateCategory(entry.id, { displayName: e.target.value })}
                  />
                  <input
                    type="text"
                    value={entry.base_unit}
                    onChange={(e) => updateCategory(entry.id, { base_unit: e.target.value })}
                    className="resource-registry__mono"
                  />
                  <input
                    type="color"
                    value={entry.themeColor}
                    onChange={(e) => updateCategory(entry.id, { themeColor: e.target.value })}
                    className="resource-registry__color-input"
                  />
                  <select
                    value={entry.defaultRouting}
                    onChange={(e) => updateCategory(entry.id, { defaultRouting: e.target.value as 'wired' | 'global' })}
                  >
                    <option value="wired">有线</option>
                    <option value="global">全局</option>
                  </select>
                  <button
                    className="resource-registry__btn resource-registry__btn--danger"
                    onClick={() => removeCategory(entry.id)}
                  >
                    删除
                  </button>
                </div>
              ))}
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
