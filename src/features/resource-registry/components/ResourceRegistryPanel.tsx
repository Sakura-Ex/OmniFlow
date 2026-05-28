import { useState, useMemo } from 'react'
import type { ValueOf } from '@/common/types/common'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import type { ResourceCategoryDef, UnitOverride, ResourceEntry } from '@/common/types/registry'
import type { TimeBase } from '@/common/types/resource'
import { parseResourceId } from '@/common/utils/resourceId'
import { generateId } from '@/common/utils/id'
import modalStyles from '@/common/components/Modal.module.css'
import styles from './ResourceRegistryPanel.module.css'

/** Props for the `ResourceRegistryPanel` component. */
type ResourceRegistryPanelProps = {
  onClose: () => void
}

/** Available tabs in the resource registry panel. */
const ResourceRegistryTab = {
  Categories: 'categories',
  Overrides: 'overrides',
  Entries: 'entries',
} as const satisfies Record<string, string>

/**
 *
 */
type ResourceRegistryTab = ValueOf<typeof ResourceRegistryTab>

const COLOR_PALETTE = [
  '#e5e7eb', '#4ddcff', '#f59e0b', '#c084fc', '#fb7185',
  '#fbbf24', '#38bdf8', '#ef4444', '#22c55e', '#a78bfa',
  '#f472b6', '#34d399', '#818cf8', '#fb923c', '#2dd4bf',
  '#f87171', '#a3e635', '#cbd5e1', '#67e8f9', '#d4d4d8',
]

/**
 * Pick the first unused colour from the palette.
 * @param used - Set of already-used colour strings.
 * @returns An unused colour string.
 */
function unusedColor(used: Set<string>): string {
  for (const c of COLOR_PALETTE) {
    if (!used.has(c)) return c
  }
  return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`
}

/** Draft override entry used within the registry editor before committing changes. */
type DraftOverride = UnitOverride & { _category?: string; _asset?: string }

/** Complete draft state for the resource registry editor. */
type DraftState = {
  categories: Record<string, ResourceCategoryDef>
  overrides: Record<string, DraftOverride>
  entries: Record<string, ResourceEntry>
}

/**
 * Full-screen modal panel for managing the global resource registry.
 * Provides three tabs:
 *  - **Categories** – define resource categories (id, display name, base unit, time base, color).
 *  - **Overrides** – override the unit for specific `category:asset` pairs.
 *  - **Entries** – view and annotate every resource that has appeared in the project.
 *
 * Changes are staged in a local draft and committed to the global store when the user
 * clicks "Apply" or "Confirm".
 *
 * @param props - Component props.
 * @param props.onClose – Callback fired when the panel is dismissed.
 * @returns Rendered JSX element for the resource registry panel.
 */
export function ResourceRegistryPanel({ onClose }: ResourceRegistryPanelProps) {
  const categories = useGlobalResourceTable((state) => state.categories)
  const overrides = useGlobalResourceTable((state) => state.overrides)
  const entries = useGlobalResourceTable((state) => state.entries)
  const removeCategory = useGlobalResourceTable((state) => state.removeCategory)
  const removeOverride = useGlobalResourceTable((state) => state.removeOverride)
  const removeEntry = useGlobalResourceTable((state) => state.removeEntry)
  const updateCategory = useGlobalResourceTable((state) => state.updateCategory)
  const addCategory = useGlobalResourceTable((state) => state.addCategory)
  const setOverride = useGlobalResourceTable((state) => state.setOverride)
  const setEntry = useGlobalResourceTable((state) => state.setEntry)

  const [tab, setTab] = useState<ResourceRegistryTab>('categories')

  const [draft, setDraft] = useState<DraftState>(() => ({
    categories: JSON.parse(JSON.stringify(categories)),
    overrides: JSON.parse(JSON.stringify(overrides)),
    entries: JSON.parse(JSON.stringify(entries)),
  }))

  const [newCatIds, setNewCatIds] = useState<Record<string, string>>({})
  const [ovEdits, setOvEdits] = useState<Record<string, { cat: string; asset: string }>>({})

  const categoryEntries = useMemo(() => Object.entries(draft.categories), [draft.categories])
  const overrideEntries = useMemo(() => Object.entries(draft.overrides), [draft.overrides])
  const entryList = useMemo(() => Object.entries(draft.entries), [draft.entries])
  const categoryIds = useMemo(() => Object.keys(draft.categories), [draft.categories])
  const usedColors = useMemo(() => new Set(categoryEntries.map(([, d]) => d.themeColor)), [categoryEntries])

  const updateCatDraft = (id: string, patch: Partial<ResourceCategoryDef>) => {
    setDraft((prev) => ({
      ...prev,
      categories: { ...prev.categories, [id]: { ...prev.categories[id], ...patch } },
    }))
  }

  const removeCatDraft = (id: string) => {
    setDraft((prev) => {
      const next = { ...prev.categories }
      delete next[id]
      return { ...prev, categories: next }
    })
  }

  const addCatDraft = (def: ResourceCategoryDef) => {
    setDraft((prev) => ({
      ...prev,
      categories: { ...prev.categories, [def.id]: def },
    }))
  }

  const handleAddCategory = () => {
    const key = `__new_${generateId()}`
    addCatDraft({
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
    removeCatDraft(tempKey)
    addCatDraft({ ...def, id: newId })
    setNewCatIds((prev) => {
      const next = { ...prev }
      delete next[tempKey]
      return next
    })
  }

  const updateOvDraft = (key: string, patch: Partial<DraftOverride>) => {
    setDraft((prev) => ({
      ...prev,
      overrides: { ...prev.overrides, [key]: { ...prev.overrides[key], ...patch } },
    }))
  }

  const removeOvDraft = (key: string) => {
    setDraft((prev) => {
      const next = { ...prev.overrides }
      delete next[key]
      return { ...prev, overrides: next }
    })
  }

  const addOvDraft = (key: string, def: DraftOverride) => {
    setDraft((prev) => ({
      ...prev,
      overrides: { ...prev.overrides, [key]: def },
    }))
  }

  const handleAddOverride = () => {
    const key = `__new_ov_${generateId()}`
    addOvDraft(key, {})
  }

  const commitOverrideKey = (tempKey: string) => {
    const edit = ovEdits[tempKey]
    if (!edit || !edit.cat.trim() || !edit.asset.trim()) return
    const newKey = `${edit.cat.trim()}:${edit.asset.trim()}`
    if (newKey === tempKey) return
    const def = draft.overrides[tempKey]
    if (!def) return
    removeOvDraft(tempKey)
    addOvDraft(newKey, { ...def })
    setOvEdits((prev) => {
      const next = { ...prev }
      delete next[tempKey]
      return next
    })
  }

  const updateEntryDraft = (fullId: string, patch: Partial<ResourceEntry>) => {
    setDraft((prev) => ({
      ...prev,
      entries: { ...prev.entries, [fullId]: { ...prev.entries[fullId], ...patch, fullId } },
    }))
  }

  const removeEntryDraft = (fullId: string) => {
    setDraft((prev) => {
      const next = { ...prev.entries }
      delete next[fullId]
      return { ...prev, entries: next }
    })
  }

  const handleApply = () => {
    for (const id of Object.keys(categories)) {
      if (!draft.categories[id]) removeCategory(id)
    }
    for (const fullId of Object.keys(overrides)) {
      if (!draft.overrides[fullId]) removeOverride(fullId)
    }
    for (const fullId of Object.keys(entries)) {
      if (!draft.entries[fullId]) removeEntry(fullId)
    }
    for (const [id, def] of Object.entries(draft.categories)) {
      if (id.startsWith('__new_')) continue
      if (categories[id]) {
        updateCategory(id, def)
      } else {
        addCategory(def)
      }
    }
    for (const [fullId, ov] of Object.entries(draft.overrides)) {
      if (fullId.startsWith('__new_ov_')) continue
      setOverride(fullId, { unit_override: ov.unit_override })
    }
    for (const [fullId, entry] of Object.entries(draft.entries)) {
      setEntry(fullId, { displayName: entry.displayName })
    }
    setDraft({
      categories: JSON.parse(JSON.stringify(categories)),
      overrides: JSON.parse(JSON.stringify(overrides)),
      entries: JSON.parse(JSON.stringify(entries)),
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
    <div className={modalStyles.overlay} role="presentation">
      <div className={`${modalStyles.panel} ${styles['resource-registry__modal']}`} role="dialog" aria-modal="true">
        <header className={modalStyles.header}>
          <div>
            <p className={modalStyles.eyebrow}>Global Settings</p>
            <h3 className={styles['resource-registry__title']}>全局资源注册表</h3>
          </div>
        </header>

        <div className={styles['resource-registry__tabs']}>
          <button
            className={`${styles['resource-registry__tab']}${tab === 'categories' ? ` ${styles['resource-registry__tab--active']}` : ''}`}
            onClick={() => setTab('categories')}
          >
            类别定义
          </button>
          <button
            className={`${styles['resource-registry__tab']}${tab === 'overrides' ? ` ${styles['resource-registry__tab--active']}` : ''}`}
            onClick={() => setTab('overrides')}
          >
            单位覆盖
          </button>
          <button
            className={`${styles['resource-registry__tab']}${tab === 'entries' ? ` ${styles['resource-registry__tab--active']}` : ''}`}
            onClick={() => setTab('entries')}
          >
            全部已使用资源
          </button>
        </div>

        <div className={styles['resource-registry__body']}>
          {tab === 'categories' && (
            <>
              <p className={styles['resource-registry__hint']}>
                类别定义资源的默认单位、偏好基准与颜色标识。所有 <code>category:asset</code> 形式的资源继承此处的设定。
              </p>

              <div className={styles['resource-registry__list-section']}>
                <div className={`${styles['resource-registry__table']} ${styles['resource-registry__table--cats']}`}>
                  <div className={`${styles['resource-registry__table-row']} ${styles['resource-registry__table-row--header']}`}>
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
                      <div className={styles['resource-registry__table-row']} key={id}>
                        {isNew ? (
                          <input
                            type="text"
                            placeholder="ID"
                            value={draftId}
                            onChange={(e) => setNewCatIds((prev) => ({ ...prev, [id]: e.target.value }))}
                            onBlur={() => commitCategoryId(id)}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitCategoryId(id) }}
                            className={styles['resource-registry__mono']}
                          />
                        ) : (
                          <span className={styles['resource-registry__mono']}>{id}</span>
                        )}
                        <input
                          type="text"
                          value={def.displayName}
                          onChange={(e) => updateCatDraft(id, { displayName: e.target.value })}
                        />
                        <input
                          type="text"
                          value={def.base_unit}
                          onChange={(e) => updateCatDraft(id, { base_unit: e.target.value })}
                          className={styles['resource-registry__mono']}
                        />
                        <select
                          value={def.preferred_time_base}
                          onChange={(e) => updateCatDraft(id, { preferred_time_base: e.target.value as TimeBase })}
                        >
                          <option value="rate_per_sec">/秒</option>
                          <option value="rate_per_tick">/tick</option>
                          <option value="per_cycle">/配方</option>
                        </select>
                        <input
                          type="color"
                          value={def.themeColor}
                          onChange={(e) => updateCatDraft(id, { themeColor: e.target.value })}
                          className={styles['resource-registry__color-input']}
                        />
                        <button
                          className={`${styles['resource-registry__btn']} ${styles['resource-registry__btn--danger']}`}
                          onClick={() => removeCatDraft(id)}
                        >
                          删除
                        </button>
                      </div>
                    )
                  })}

                  <button
                    className={`${styles['resource-registry__btn']} ${styles['resource-registry__btn--primary']}`}
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
              <p className={styles['resource-registry__hint']}>
                为特定资源覆盖其类别的默认单位。例如 <code>energy:thermal_rf</code> 覆盖单位为 <code>RF</code>，表示不沿用 <code>energy</code> 类别的默认 EU。
              </p>

              <div className={styles['resource-registry__list-section']}>
                <div className={`${styles['resource-registry__table']} ${styles['resource-registry__table--overrides']}`}>
                  <div className={`${styles['resource-registry__table-row']} ${styles['resource-registry__table-row--header']}`}>
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
                      <div className={styles['resource-registry__table-row']} key={fullId}>
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
                          className={styles['resource-registry__mono']}
                        />
                        <input
                          type="text"
                          placeholder="(无覆盖)"
                          value={ov.unit_override ?? ''}
                          onChange={(e) => updateOvDraft(fullId, { unit_override: e.target.value || undefined })}
                          className={styles['resource-registry__mono']}
                        />
                        <button
                          className={`${styles['resource-registry__btn']} ${styles['resource-registry__btn--danger']}`}
                          onClick={() => removeOvDraft(fullId)}
                        >
                          删除
                        </button>
                      </div>
                    )
                  })}

                  <button
                    className={`${styles['resource-registry__btn']} ${styles['resource-registry__btn--primary']}`}
                    onClick={handleAddOverride}
                    style={{ justifySelf: 'start' }}
                  >
                    + 添加覆盖
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === 'entries' && (
            <>
              <p className={styles['resource-registry__hint']}>
                自动收录项目中出现过的所有资源。可在下方补充别名等信息。
              </p>

              <div className={styles['resource-registry__list-section']}>
                <h4>已收录资源 ({entryList.length})</h4>

                <div className={styles['resource-registry__table']}>
                  <div className={`${styles['resource-registry__table-row']} ${styles['resource-registry__table-row--header']}`}>
                    <span>标识符</span>
                    <span>别名</span>
                    <span>类别</span>
                    <span>操作</span>
                  </div>
                  {entryList.map(([fullId, def]) => {
                    const parsed = parseResourceId(fullId)
                    const catId = parsed.category !== parsed.id ? parsed.category : ''
                    const catDef = categories[catId]

                    return (
                      <div className={styles['resource-registry__table-row']} key={fullId}>
                        <span className={styles['resource-registry__mono']}>{fullId}</span>
                        <input
                          type="text"
                          placeholder="(无别名)"
                          value={def.displayName ?? ''}
                          onChange={(e) => updateEntryDraft(fullId, { displayName: e.target.value || undefined })}
                        />
                        <span style={{ fontSize: 12, opacity: 0.7 }}>
                          {catDef?.displayName ?? catId}
                          {catDef ? ` (${catDef.base_unit})` : ''}
                        </span>
                        <button
                          className={`${styles['resource-registry__btn']} ${styles['resource-registry__btn--danger']}`}
                          onClick={() => removeEntryDraft(fullId)}
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

        <footer className={styles['resource-registry__footer']}>
          <button className={styles['resource-registry__btn']} onClick={handleCancel}>
            取消
          </button>
          <button className={styles['resource-registry__btn']} onClick={handleApply}>
            应用
          </button>
          <button className={`${styles['resource-registry__btn']} ${styles['resource-registry__btn--primary']}`} onClick={handleConfirm}>
            确定
          </button>
        </footer>
      </div>
    </div>
  )
}
