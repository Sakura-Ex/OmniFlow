import { useState } from 'react'
import { useResourceRegistry } from '../registry/resourceRegistry'
import type { DimensionDef, ResourceOverride } from '../registry/types'
import { DimensionRegistry } from '../registry/defaults'
import './ResourceRegistryPanel.css'

type ResourceRegistryPanelProps = {
  onClose: () => void
}

function emptyDim(): DimensionDef {
  return { default_unit: '', display_mode: 'rate_per_sec', themeColor: '#94a3b8' }
}

function emptyOverride(): ResourceOverride {
  return {}
}

export function ResourceRegistryPanel({ onClose }: ResourceRegistryPanelProps) {
  const { dimensions, overrides, setDimension, setOverride, removeOverride } = useResourceRegistry()
  const [tab, setTab] = useState<'dimensions' | 'overrides'>('dimensions')
  const [newDimId, setNewDimId] = useState('')
  const [newOverrideId, setNewOverrideId] = useState('')

  const dimEntries = Object.entries(dimensions)
  const overrideEntries = Object.entries(overrides)

  const handleAddDim = () => {
    const id = newDimId.trim()
    if (!id || id.includes(':')) return
    setDimension(id, emptyDim())
    setNewDimId('')
  }

  const handleAddOverride = () => {
    const id = newOverrideId.trim()
    if (!id || id.includes(':')) return
    setOverride(id, emptyOverride())
    setNewOverrideId('')
  }

  return (
    <div className="resource-registry__overlay" role="presentation">
      <div className="resource-registry__modal" role="dialog" aria-modal="true">
        <header className="resource-registry__header">
          <div>
            <p className="resource-registry__eyebrow">Global Settings</p>
            <h3 className="resource-registry__title">全局资源注册表</h3>
          </div>
          <button className="resource-registry__icon-btn" onClick={onClose} title="关闭">✕</button>
        </header>

        <div className="resource-registry__tabs">
          <button
            className={`resource-registry__tab${tab === 'dimensions' ? ' is-active' : ''}`}
            onClick={() => setTab('dimensions')}
          >
            量纲表 (Dimensions)
          </button>
          <button
            className={`resource-registry__tab${tab === 'overrides' ? ' is-active' : ''}`}
            onClick={() => setTab('overrides')}
          >
            特化覆盖表 (Overrides)
          </button>
        </div>

        <div className="resource-registry__body">
          {tab === 'dimensions' && (
            <>
              <p className="resource-registry__hint">
                量纲定义资源的基础物理单位与显示模式。新增量纲后，所有 <code>dimension:asset</code> 格式的资源将自动继承此处设定的默认值。
              </p>
              <div className="resource-registry__add-section">
                <h4>注册新量纲</h4>
                <div className="resource-registry__add-row">
                  <input
                    type="text"
                    placeholder="量纲 ID (如 mana)"
                    value={newDimId}
                    onChange={(e) => setNewDimId(e.target.value)}
                  />
                  <button className="resource-registry__btn resource-registry__btn--primary" onClick={handleAddDim}>
                    添加
                  </button>
                </div>
              </div>

              <div className="resource-registry__list-section">
                <h4>已注册量纲 ({dimEntries.length})</h4>
                <div className="resource-registry__table">
                  <div className="resource-registry__table-row resource-registry__table-row--header">
                    <span>量纲 ID</span>
                    <span>默认单位</span>
                    <span>显示模式</span>
                    <span>颜色</span>
                    <span>来源</span>
                  </div>
                  {dimEntries.map(([id, def]) => {
                    const isBuiltin = id in DimensionRegistry
                    return (
                      <div className="resource-registry__table-row" key={id}>
                        <span className="resource-registry__mono">{id}</span>
                        <input
                          type="text"
                          value={def.default_unit}
                          onChange={(e) => setDimension(id, { ...def, default_unit: e.target.value })}
                          className="resource-registry__mono"
                        />
                        <select
                          value={def.display_mode}
                          onChange={(e) => setDimension(id, { ...def, display_mode: e.target.value as DimensionDef['display_mode'] })}
                        >
                          <option value="rate_per_sec">/s</option>
                          <option value="rate_per_tick">/t</option>
                          <option value="per_cycle">/次</option>
                        </select>
                        <input
                          type="color"
                          value={def.themeColor}
                          onChange={(e) => setDimension(id, { ...def, themeColor: e.target.value })}
                          className="resource-registry__color-input"
                        />
                        <span className="resource-registry__source-tag">{isBuiltin ? '内置' : '自定义'}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {tab === 'overrides' && (
            <>
              <p className="resource-registry__hint">
                特化覆盖表仅记录需要推翻默认量纲法则的具体资产。例如 <code>energy:gt_eu</code> 中的 <code>gt_eu</code> 在此处覆盖单位为 <code>EU</code>。
              </p>
              <div className="resource-registry__add-section">
                <h4>注册新覆盖</h4>
                <div className="resource-registry__add-row">
                  <input
                    type="text"
                    placeholder="资产 ID (如 gt_eu)"
                    value={newOverrideId}
                    onChange={(e) => setNewOverrideId(e.target.value)}
                  />
                  <button className="resource-registry__btn resource-registry__btn--primary" onClick={handleAddOverride}>
                    添加
                  </button>
                </div>
              </div>

              <div className="resource-registry__list-section">
                <h4>已注册覆盖 ({overrideEntries.length})</h4>
                <div className="resource-registry__table resource-registry__table--override">
                  <div className="resource-registry__table-row resource-registry__table-row--header">
                    <span>资产 ID</span>
                    <span>单位覆盖</span>
                    <span>显示模式覆盖</span>
                    <span>操作</span>
                  </div>
                  {overrideEntries.map(([id, def]) => (
                      <div className="resource-registry__table-row" key={id}>
                        <span className="resource-registry__mono">{id}</span>
                        <input
                          type="text"
                          placeholder="继承量纲默认"
                          value={def.unit_override ?? ''}
                          onChange={(e) => {
                            const val = e.target.value.trim()
                            setOverride(id, { ...def, unit_override: val || undefined })
                          }}
                          className="resource-registry__mono"
                        />
                        <select
                          value={def.display_mode_override ?? ''}
                          onChange={(e) => {
                            const val = e.target.value
                            setOverride(id, {
                              ...def,
                              display_mode_override: (val || undefined) as DimensionDef['display_mode'] | undefined,
                            })
                          }}
                        >
                          <option value="">继承量纲</option>
                          <option value="rate_per_sec">/s</option>
                          <option value="rate_per_tick">/t</option>
                          <option value="per_cycle">/次</option>
                        </select>
                        <button
                          className="resource-registry__btn resource-registry__btn--danger"
                          onClick={() => removeOverride(id)}
                        >
                          删除
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>

        <footer className="resource-registry__footer">
          <button className="resource-registry__btn" onClick={onClose}>关闭</button>
        </footer>
      </div>
    </div>
  )
}
