import { useState, useMemo } from 'react'
import { useGlobalResourceTable } from '../registry/globalResourceTable'
import type { ResourceCategoryDef, UnitOverride, ResourceEntry } from '../registry/types'
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

type DraftOverride = UnitOverride & { _category?: string; _asset?: string }

type DraftState = {
  categories: Record<string, ResourceCategoryDef>
  overrides: Record<string, DraftOverride>
  entries: Record<string, ResourceEntry>
}

export function ResourceRegistryPanel({ onClose }: ResourceRegistryPanelProps) {
  const store = useGlobalResourceTable()

  const [tab, setTab] = useState<'categories' | 'overrides' | 'entries'>('categories')

  const [draft, setDraft] = useState<DraftState>(() => ({
    categories: JSON.parse(JSON.stringify(store.categories)),
    overrides: JSON.parse(JSON.stringify(store.overrides)),
    entries: JSON.parse(JSON.stringify(store.entries)),
  }))

  const [newCatIds, setNewCatIds] = useState<Record<string, string>>({})
  const [ovEdits, setOvEdits] = useState<Record<string, { cat: string; asset: string }>>({})

  const categoryEntries = useMemo(() => Object.entries(draft.categories), [draft.categories])
  const overrideEntries = useMemo(() => Object.entries(draft.overrides), [draft.overrides])
  const entryList = useMemo(() => Object.entries(draft.entries), [draft.entries])
  const categoryIds = useMemo(() => Object.keys(draft.categories), [draft.categories])
  const usedColors = useMemo(() => new Set(categoryEntries.map(([, d]) => d.themeColor)), [categoryEntries])

  // ── Categories ──
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

  // ── Overrides ──
  const updateOv = (key: string, patch: Partial<DraftOverride>) => {
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

  const addOv = (key: string, def: DraftOverride) => {
    setDraft((prev) => ({
      ...prev,
      overrides: { ...prev.overrides, [key]: def },
    }))
  }

  const handleAddOverride = () => {
    const key = `__new_ov_${crypto.randomUUID()}`
    addOv(key, {})
  }

  const commitOverrideKey = (tempKey: string) => {
    const edit = ovEdits[tempKey]
    if (!edit || !edit.cat.trim() || !edit.asset.trim()) return
    const newKey = `${edit.cat.trim()}:${edit.asset.trim()}`
    if (newKey === tempKey) return
    const def = draft.overrides[tempKey]
    if (!def) return
    removeOv(tempKey)
    addOv(newKey, { ...def })
    setOvEdits((prev) => {
      const next = { ...prev }
      delete next[tempKey]
      return next
    })
  }

  // ── Entries ──
  const updateEntry = (fullId: string, patch: Partial<ResourceEntry>) => {
    setDraft((prev) => ({
      ...prev,
      entries: { ...prev.entries, [fullId]: { ...prev.entries[fullId], ...patch, fullId } },
    }))
  }

  const removeEntry = (fullId: string) => {
    setDraft((prev) => {
      const next = { ...prev.entries }
      delete next[fullId]
      return { ...prev, entries: next }
    })
  }

  // ── Apply ──
  const handleApply = () => {
    for (const id of Object.keys(store.categories)) {
      if (!draft.categories[id]) store.removeCategory(id)
    }
    for (const fullId of Object.keys(store.overrides)) {
      if (!draft.overrides[fullId]) store.removeOverride(fullId)
    }
    for (const fullId of Object.keys(store.entries)) {
      if (!draft.entries[fullId]) store.removeEntry(fullId)
    }
    for (const [id, def] of Object.entries(draft.categories)) {
      if (id.startsWith('__new_')) continue
      if (store.categories[id]) {
        store.updateCategory(id, def)
      } else {
        store.addCategory(def)
      }
    }
    for (const [fullId, ov] of Object.entries(draft.overrides)) {
      if (fullId.startsWith('__new_ov_')) continue
      store.setOverride(fullId, { unit_override: ov.unit_override })
    }
    for (const [fullId, entry] of Object.entries(draft.entries)) {
      store.setEntry(fullId, { displayName: entry.displayName })
    }
    setDraft({
      categories: JSON.parse(JSON.stringify(store.categories)),
      overrides: JSON.parse(JSON.stringify(store.overrides)),
      entries: JSON.parse(JSON.stringify(store.entries)),
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
            单位覆盖
          </button>
          <button
            className={`resource-registry__tab${tab === 'entries' ? ' is-active' : ''}`}
            onClick={() => setTab('entries')}
          >
            全部已使用资源
          </button>
        </div>

        <div className="resource-registry__body">
          {/* ── Tab 1: 类别定义 ── */}
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

          {/* ── Tab 2: 单位覆盖 ── */}
          {tab === 'overrides' && (
            <>
              <p className="resource-registry__hint">
                为特定资源覆盖其类别的默认单位。例如 <code>energy:thermal_rf</code> 覆盖单位为 <code>RF</code>，表示不沿用 <code>energy</code> 类别的默认 EU。
              </p>

              <div className="resource-registry__list-section">
                <div className="resource-registry__table resource-registry__table--overrides">
                  <div className="resource-registry__table-row resource-registry__table-row--header">
                    <span>类别</span>
                    <span>资产 ID</span>
                    <span>覆盖单位</span>
                    <span></span>
                  </div>
                  {overrideEntries.map(([fullId, ov]) => {
                    const parsed = parseResourceId(fullId)
                    const cat = parsed.category !== parsed.id ? parsed.category : ''
                    const asset = parsed.id
                    const edit = ovEdits[fullId]
                    const displayCat = edit?.cat ?? cat
                    const displayAsset = edit?.asset ?? asset

                    const setEditCat = (v: string) => {
                      setOvEdits((prev) => ({ ...prev, [fullId]: { cat: v, asset: displayAsset } }))
                    }
                    const setEditAsset = (v: string) => {
                      setOvEdits((prev) => ({ ...prev, [fullId]: { cat: displayCat, asset: v } }))
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
                          value={ov.unit_override ?? ''}
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

          {/* ── Tab 3: 全部已使用资源 ── */}
          {tab === 'entries' && (
            <>
              <p className="resource-registry__hint">
                自动收录项目中出现过的所有资源。可在下方补充别名等信息。
              </p>

              <div className="resource-registry__list-section">
                <h4>已收录资源 ({entryList.length})</h4>

                <div className="resource-registry__table">
                  <div className="resource-registry__table-row resource-registry__table-row--header">
                    <span>标识符</span>
                    <span>别名</span>
                    <span>类别</span>
                    <span>操作</span>
                  </div>
                  {entryList.map(([fullId, def]) => {
                    const parsed = parseResourceId(fullId)
                    const catId = parsed.category !== parsed.id ? parsed.category : ''
                    const catDef = store.categories[catId]

                    return (
                      <div className="resource-registry__table-row" key={fullId}>
                        <span className="resource-registry__mono">{fullId}</span>
                        <input
                          type="text"
                          placeholder="(无别名)"
                          value={def.displayName ?? ''}
                          onChange={(e) => updateEntry(fullId, { displayName: e.target.value || undefined })}
                        />
                        <span style={{ fontSize: 12, opacity: 0.7 }}>
                          {catDef?.displayName ?? catId}
                          {catDef ? ` (${catDef.base_unit})` : ''}
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
                    <p style={{ padding: 12, fontSize: 12, opacity: 0.5 }}>
                      暂无资源。在配方中填写资源 ID 后会自动收录。
                    </p>
                  )}
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
