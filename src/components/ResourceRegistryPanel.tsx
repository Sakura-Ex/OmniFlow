import { useState, useMemo } from 'react'
import { useResourceRegistry } from '../registry/resourceRegistry'
import type { ResourceCategoryDef, ResourceOverride } from '../registry/types'
import type { TimeBase } from '../types/types'
import { parseResourceId } from '../utils/resourceIdentifier'
import './ResourceRegistryPanel.css'

type ResourceRegistryPanelProps = {
  onClose: () => void
}

const COLOR_PALETTE = [
  '#e5e7eb', '#4ddcff', '#f59e0b', '#c084fc', '#fb7185',
  '#fbbf24', '#38bdf8', '#ef4444', '#22c55e', '#a78bfa',
  '#f472b6', '#34d399', '#818cf8', '#fb923c', '#2dd4bf',
  '#f87171', '#a3e635', '#cbd5e1', '#67e8f9', '#d4d4d8',
]

function unusedColor(used: Set<string>): string {
  for (const c of COLOR_PALETTE) {
    if (!used.has(c)) return c
  }
  return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`
}

type DraftState = {
  categories: Record<string, ResourceCategoryDef>
  overrides: Record<string, ResourceOverride>
}

export function ResourceRegistryPanel({ onClose }: ResourceRegistryPanelProps) {
  const store = useResourceRegistry()

  const [tab, setTab] = useState<'categories' | 'overrides'>('categories')

  const [draft, setDraft] = useState<DraftState>(() => ({
    categories: JSON.parse(JSON.stringify(store.categories)),
    overrides: JSON.parse(JSON.stringify(store.overrides)),
  }))

  const [newCatIds, setNewCatIds] = useState<Record<string, string>>({})
  const [overrideEdits, setOverrideEdits] = useState<Record<string, { cat: string; asset: string }>>({})

  const categoryEntries = useMemo(() => Object.entries(draft.categories), [draft.categories])
  const overrideEntries = useMemo(() => Object.entries(draft.overrides), [draft.overrides])
  const categoryIds = useMemo(() => Object.keys(draft.categories), [draft.categories])
  const usedColors = useMemo(() => new Set(categoryEntries.map(([, d]) => d.themeColor)), [categoryEntries])

  const updateCat = (id: string, patch: Partial<ResourceCategoryDef>) => {
    setDraft((prev) => ({
      ...prev,
      categories: { ...prev.categories, [id]: { ...prev.categories[id], ...patch } },
    }))
  }

  const removeCat = (id: string) => {
    setDraft((prev) => {
      const next = { ...prev.categories }
      delete next[id]
      return { ...prev, categories: next }
    })
  }

  const addCat = (def: ResourceCategoryDef) => {
    setDraft((prev) => ({
      ...prev,
      categories: { ...prev.categories, [def.id]: def },
    }))
  }

  const updateOv = (key: string, patch: Partial<ResourceOverride>) => {
    setDraft((prev) => ({
      ...prev,
      overrides: { ...prev.overrides, [key]: { ...prev.overrides[key], ...patch } },
    }))
  }

  const removeOv = (key: string) => {
    setDraft((prev) => {
      const next = { ...prev.overrides }
      delete next[key]
      return { ...prev, overrides: next }
    })
  }

  const addOv = (key: string, def: ResourceOverride) => {
    setDraft((prev) => ({
      ...prev,
      overrides: { ...prev.overrides, [key]: def },
    }))
  }

  const handleAddCategory = () => {
    const key = `__new_${crypto.randomUUID()}`
    addCat({
      id: key,
      displayName: '',
      base_unit: '',
      themeColor: unusedColor(usedColors),
      preferred_time_base: 'rate_per_sec',
    })
  }

  const handleAddOverride = () => {
    const key = `__new_${crypto.randomUUID()}`
    addOv(key, {})
  }

  const commitCategoryId = (tempKey: string) => {
    const newId = newCatIds[tempKey]?.trim()
    if (!newId || newId === tempKey) return
    const def = draft.categories[tempKey]
    if (!def) return
    removeCat(tempKey)
    addCat({ ...def, id: newId })
    setNewCatIds((prev) => {
      const next = { ...prev }
      delete next[tempKey]
      return next
    })
  }

  const commitOverrideKey = (tempKey: string) => {
    const edit = overrideEdits[tempKey]
    if (!edit || !edit.cat.trim() || !edit.asset.trim()) return
    const newKey = `${edit.cat.trim()}:${edit.asset.trim()}`
    if (newKey === tempKey) return
    const def = draft.overrides[tempKey]
    if (!def) return
    removeOv(tempKey)
    addOv(newKey, { ...def })
    setOverrideEdits((prev) => {
      const next = { ...prev }
      delete next[tempKey]
      return next
    })
  }

  // ── 按钮 ──
  const handleApply = () => {
    for (const id of Object.keys(store.categories)) {
      if (!draft.categories[id]) store.removeCategory(id)
    }
    for (const id of Object.keys(store.overrides)) {
      if (!draft.overrides[id]) store.removeOverride(id)
    }
    for (const [id, def] of Object.entries(draft.categories)) {
      if (store.getCategory(id)) {
        store.updateCategory(id, def)
      } else {
        store.addCategory(def)
      }
    }
    for (const [id, def] of Object.entries(draft.overrides)) {
      store.setOverride(id, def)
    }
    setDraft({
      categories: JSON.parse(JSON.stringify(store.categories)),
      overrides: JSON.parse(JSON.stringify(store.overrides)),
    })
  }

  const handleConfirm = () => {
    handleApply()
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  return (
    <div className="resource-registry__overlay" role="presentation">
      <div className="resource-registry__modal" role="dialog" aria-modal="true">
        <header className="resource-registry__header">
          <div>
            <p className="resource-registry__eyebrow">Global Settings</p>
            <h3 className="resource-registry__title">全局资源注册表</h3>
          </div>
        </header>

        <div className="resource-registry__tabs">
          <button
            className={`resource-registry__tab${tab === 'categories' ? ' is-active' : ''}`}
            onClick={() => setTab('categories')}
          >
            类别定义
          </button>
          <button
            className={`resource-registry__tab${tab === 'overrides' ? ' is-active' : ''}`}
            onClick={() => setTab('overrides')}
          >
            特化覆盖表
          </button>
        </div>

        <div className="resource-registry__body">
          {tab === 'categories' && (
            <>
              <p className="resource-registry__hint">
                类别定义资源的默认单位、偏好基准与颜色标识。所有 <code>category:asset</code> 形式的资源继承此处的设定。
              </p>

              <div className="resource-registry__list-section">
                <div className="resource-registry__table resource-registry__table--cats">
                  <div className="resource-registry__table-row resource-registry__table-row--header">
                    <span>类别 ID</span>
                    <span>显示名</span>
                    <span>默认单位</span>
                    <span>偏好基准</span>
                    <span>颜色</span>
                    <span></span>
                  </div>
                  {categoryEntries.map(([id, def]) => {
                    const isNew = id.startsWith('__new_')
                    const draftId = newCatIds[id] ?? ''
                    return (
                      <div className="resource-registry__table-row" key={id}>
                        {isNew ? (
                          <input
                            type="text"
                            placeholder="ID"
                            value={draftId}
                            onChange={(e) => setNewCatIds((prev) => ({ ...prev, [id]: e.target.value }))}
                            onBlur={() => commitCategoryId(id)}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitCategoryId(id) }}
                            className="resource-registry__mono"
                          />
                        ) : (
                          <span className="resource-registry__mono">{id}</span>
                        )}
                        <input
                          type="text"
                          value={def.displayName}
                          onChange={(e) => updateCat(id, { displayName: e.target.value })}
                        />
                        <input
                          type="text"
                          value={def.base_unit}
                          onChange={(e) => updateCat(id, { base_unit: e.target.value })}
                          className="resource-registry__mono"
                        />
                        <select
                          value={def.preferred_time_base}
                          onChange={(e) => updateCat(id, { preferred_time_base: e.target.value as TimeBase })}
                        >
                          <option value="rate_per_sec">/秒</option>
                          <option value="rate_per_tick">/tick</option>
                          <option value="per_cycle">/配方</option>
                        </select>
                        <input
                          type="color"
                          value={def.themeColor}
                          onChange={(e) => updateCat(id, { themeColor: e.target.value })}
                          className="resource-registry__color-input"
                        />
                        <button
                          className="resource-registry__btn resource-registry__btn--danger"
                          onClick={() => removeCat(id)}
                        >
                          删除
                        </button>
                      </div>
                    )
                  })}

                  <button
                    className="resource-registry__btn resource-registry__btn--primary"
                    onClick={handleAddCategory}
                    style={{ justifySelf: 'start' }}
                  >
                    + 添加类别
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === 'overrides' && (
            <>
              <p className="resource-registry__hint">
                资源覆盖表为特定资产的单位提供覆盖值。对 <code>energy:thermal_rf</code> 覆盖单位为 <code>RF</code> 意味着：资源标识符为 <code>energy:thermal_rf</code> 时，不使用 <code>energy</code> 类别的默认单位，而使用此处的 <code>RF</code>。
              </p>

              <div className="resource-registry__list-section">
                <div className="resource-registry__table resource-registry__table--overrides">
                  <div className="resource-registry__table-row resource-registry__table-row--header">
                    <span>类别</span>
                    <span>资产 ID</span>
                    <span>覆盖单位</span>
                    <span></span>
                  </div>
                  {overrideEntries.map(([fullId, def]) => {
                    const parsed = parseResourceId(fullId)
                    const cat = parsed.category !== parsed.id ? parsed.category : ''
                    const asset = parsed.id
                    const edit = overrideEdits[fullId]
                    const displayCat = edit?.cat ?? cat
                    const displayAsset = edit?.asset ?? asset

                    const setEditCat = (v: string) => {
                      setOverrideEdits((prev) => ({ ...prev, [fullId]: { cat: v, asset: displayAsset } }))
                    }
                    const setEditAsset = (v: string) => {
                      setOverrideEdits((prev) => ({ ...prev, [fullId]: { cat: displayCat, asset: v } }))
                    }

                    return (
                      <div className="resource-registry__table-row" key={fullId}>
                        <select
                          value={displayCat}
                          onChange={(e) => setEditCat(e.target.value)}
                          onBlur={() => commitOverrideKey(fullId)}
                        >
                          <option value="">—</option>
                          {categoryIds.map((cid) => (
                            <option key={cid} value={cid}>{cid}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="资产 ID"
                          value={displayAsset}
                          onChange={(e) => setEditAsset(e.target.value)}
                          onBlur={() => commitOverrideKey(fullId)}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitOverrideKey(fullId) }}
                          className="resource-registry__mono"
                        />
                        <input
                          type="text"
                          placeholder="(无覆盖)"
                          value={def.unit_override ?? ''}
                          onChange={(e) => updateOv(fullId, { unit_override: e.target.value || undefined })}
                          className="resource-registry__mono"
                        />
                        <button
                          className="resource-registry__btn resource-registry__btn--danger"
                          onClick={() => removeOv(fullId)}
                        >
                          删除
                        </button>
                      </div>
                    )
                  })}

                  <button
                    className="resource-registry__btn resource-registry__btn--primary"
                    onClick={handleAddOverride}
                    style={{ justifySelf: 'start' }}
                  >
                    + 添加覆盖
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <footer className="resource-registry__footer">
          <button className="resource-registry__btn" onClick={handleCancel}>
            取消
          </button>
          <button className="resource-registry__btn" onClick={handleApply}>
            应用
          </button>
          <button className="resource-registry__btn resource-registry__btn--primary" onClick={handleConfirm}>
            确定
          </button>
        </footer>
      </div>
    </div>
  )
}
