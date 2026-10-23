import { useTranslation } from '@/common/i18n'
import { useDocumentEdit } from '@/common/components/DocumentEditContext'
import { useDraftState } from '@/common/components/DraftStateContext'
import { documentKey } from '@/common/utils/saveBaseline'
import { categoryDisplayName } from '@/common/i18n/resourceLabels'
import { translateDiagnostic } from '@/common/i18n/translateDiagnostic'
import { Icon } from '@/common/components/Icon'
import { RESOURCE_COLOR_PALETTE } from '@/common/utils/resourcePalette'
import { Combobox } from '@/common/components/Combobox'
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
  embedded?: boolean
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

/**
 * Pick the first unused colour from the palette.
 * @param used - Set of already-used colour strings.
 * @returns An unused colour, or a reused palette colour when all are assigned.
 */
function unusedColor(used: Set<string>): string {
  for (const c of RESOURCE_COLOR_PALETTE) {
    if (!used.has(c)) return c
  }
  return RESOURCE_COLOR_PALETTE[used.size % RESOURCE_COLOR_PALETTE.length]
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
 * @param props.embedded - Reuse the staged editor inside the full settings page.
 * @returns Rendered JSX element for the resource registry panel.
 */
export function ResourceRegistryPanel({ onClose, embedded }: ResourceRegistryPanelProps) {
  const commitEdit = useDocumentEdit()
  const { t } = useTranslation()
  const categories = useGlobalResourceTable((state) => state.categories)
  const overrides = useGlobalResourceTable((state) => state.overrides)
  const entries = useGlobalResourceTable((state) => state.entries)
  const apply = useGlobalResourceTable((state) => state.apply)
  const [error, setError] = useState('')

  const [tab, setTab] = useState<ResourceRegistryTab>('categories')

  const [draft, setDraft] = useState<DraftState>(() => ({
    categories: JSON.parse(JSON.stringify(categories)),
    overrides: JSON.parse(JSON.stringify(overrides)),
    entries: JSON.parse(JSON.stringify(entries)),
  }))

  const [newCatIds, setNewCatIds] = useState<Record<string, string>>({})
  const [ovEdits, setOvEdits] = useState<Record<string, { cat: string; asset: string }>>({})
  useDraftState(documentKey(draft) !== documentKey({ categories, overrides, entries }) || Object.keys(newCatIds).length > 0 || Object.keys(ovEdits).length > 0)

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
    if (Object.hasOwn(draft.categories, newId)) { setError(t('editor.categoryExists')); return }
    setError('')
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
    if (Object.hasOwn(draft.overrides, newKey)) { setError(t('editor.overrideExists')); return }
    setError('')
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
    try {
      commitEdit(() => apply(draft))
      const { categories, overrides, entries } = useGlobalResourceTable.getState()
      setDraft(structuredClone({ categories, overrides, entries }))
      setNewCatIds({})
      setOvEdits({})
      setError('')
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      return false
    }
  }

  const handleConfirm = () => {
    if (handleApply() && !embedded) onClose()
  }

  const handleCancel = () => {
    if (embedded) {
      const { categories, overrides, entries } = useGlobalResourceTable.getState()
      setDraft(structuredClone({ categories, overrides, entries }))
      setNewCatIds({})
      setOvEdits({})
      setError('')
    } else onClose()
  }

  return (
    <div className={embedded ? styles.embeddedHost : modalStyles.overlay} role="presentation">
      <div className={`${embedded ? styles.embedded : modalStyles.panel} ${styles['resource-registry__modal']}`} role={embedded ? undefined : 'dialog'} aria-modal={embedded ? undefined : true}>
        {error && <p role="alert">{translateDiagnostic(error)}</p>}
        {!embedded && <header className={modalStyles.header}>
          <div>
            <p className={modalStyles.eyebrow}>{t('editor.globalSettings')}</p>
            <h3 className={styles['resource-registry__title']}>{t('editor.registry')}</h3>
          </div>
        </header>}

        <div className={styles['resource-registry__tabs']}>
          <button
            className={`${styles['resource-registry__tab']}${tab === 'categories' ? ` ${styles['resource-registry__tab--active']}` : ''}`}
            onClick={() => setTab('categories')}
          >
            {t('editor.categories')}
          </button>
          <button
            className={`${styles['resource-registry__tab']}${tab === 'overrides' ? ` ${styles['resource-registry__tab--active']}` : ''}`}
            onClick={() => setTab('overrides')}
          >
            {t('editor.overrides')}
          </button>
          <button
            className={`${styles['resource-registry__tab']}${tab === 'entries' ? ` ${styles['resource-registry__tab--active']}` : ''}`}
            onClick={() => setTab('entries')}
          >
            {t('editor.usedResources')}
          </button>
        </div>

        <div className={styles['resource-registry__body']}>
          {tab === 'categories' && (
            <>
              <p className={styles['resource-registry__hint']}>
                {t('editor.categoryHint')}
              </p>

              <div className={styles['resource-registry__list-section']}>
                <div className={`${styles['resource-registry__table']} ${styles['resource-registry__table--cats']}`}>
                  <div className={`${styles['resource-registry__table-row']} ${styles['resource-registry__table-row--header']}`}>
                    <span>{t('editor.categoryId')}</span>
                    <span>{t('editor.displayName')}</span>
                    <span>{t('editor.defaultUnit')}</span>
                    <span>{t('editor.preferredBasis')}</span>
                    <span>{t('editor.color')}</span>
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
                        <Combobox
                          aria-label={t('editor.preferredMeasure')}
                          value={def.preferred_time_base}
                          onChange={value => updateCatDraft(id, { preferred_time_base: value as TimeBase })}
                          options={[{ value: 'rate_per_sec', label: t('editor.perSecond') }, { value: 'rate_per_tick', label: t('editor.perTick') }, { value: 'per_cycle', label: t('editor.perCycle') }]}
                        />
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
                          {t('editor.delete')}
                        </button>
                      </div>
                    )
                  })}

                  <button
                    className={`${styles['resource-registry__btn']} ${styles['resource-registry__btn--primary']}`}
                    onClick={handleAddCategory}
                    style={{ justifySelf: 'start' }}
                  >
                    <Icon name="plus" size={14} /> {t('editor.addCategory')}
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === 'overrides' && (
            <>
              <p className={styles['resource-registry__hint']}>
                {t('editor.overrideHint')}
              </p>

              <div className={styles['resource-registry__list-section']}>
                <div className={`${styles['resource-registry__table']} ${styles['resource-registry__table--overrides']}`}>
                  <div className={`${styles['resource-registry__table-row']} ${styles['resource-registry__table-row--header']}`}>
                    <span>{t('editor.category')}</span>
                    <span>{t('editor.assetId')}</span>
                    <span>{t('editor.overrideUnit')}</span>
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
                        <Combobox value={displayCat} onChange={setEditCat} onBlur={() => commitOverrideKey(fullId)} aria-label={t('editor.overrideCategory')} options={[{ value: '', label: '—' }, ...categoryIds.map(cid => ({ value: cid, label: cid }))]} />
                        <input
                          type="text"
                          placeholder={t('editor.assetId')}
                          value={displayAsset}
                          onChange={(e) => setEditAsset(e.target.value)}
                          onBlur={() => commitOverrideKey(fullId)}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitOverrideKey(fullId) }}
                          className={styles['resource-registry__mono']}
                        />
                        <input
                          type="text"
                          placeholder={t('editor.noOverride')}
                          value={ov.unit_override ?? ''}
                          onChange={(e) => updateOvDraft(fullId, { unit_override: e.target.value || undefined })}
                          className={styles['resource-registry__mono']}
                        />
                        <button
                          className={`${styles['resource-registry__btn']} ${styles['resource-registry__btn--danger']}`}
                          onClick={() => removeOvDraft(fullId)}
                        >
                          {t('editor.delete')}
                        </button>
                      </div>
                    )
                  })}

                  <button
                    className={`${styles['resource-registry__btn']} ${styles['resource-registry__btn--primary']}`}
                    onClick={handleAddOverride}
                    style={{ justifySelf: 'start' }}
                  >
                    <Icon name="plus" size={14} /> {t('editor.addOverride')}
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === 'entries' && (
            <>
              <p className={styles['resource-registry__hint']}>
                {t('editor.entriesHint')}
              </p>

              <div className={styles['resource-registry__list-section']}>
                <h4>{t('editor.entryCount', { count: entryList.length })}</h4>

                <div className={styles['resource-registry__table']}>
                  <div className={`${styles['resource-registry__table-row']} ${styles['resource-registry__table-row--header']}`}>
                    <span>{t('editor.identifier')}</span>
                    <span>{t('editor.alias')}</span>
                    <span>{t('editor.category')}</span>
                    <span>{t('editor.actions')}</span>
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
                          placeholder={t('editor.noAlias')}
                          value={def.displayName ?? ''}
                          onChange={(e) => updateEntryDraft(fullId, { displayName: e.target.value || undefined })}
                        />
                        <span style={{ fontSize: 12, opacity: 0.7 }}>
                          {categoryDisplayName(catId, catDef?.displayName ?? catId)}
                          {catDef ? ` (${catDef.base_unit})` : ''}
                        </span>
                        <button
                          className={`${styles['resource-registry__btn']} ${styles['resource-registry__btn--danger']}`}
                          onClick={() => removeEntryDraft(fullId)}
                        >
                          {t('editor.delete')}
                        </button>
                      </div>
                    )
                  })}
                  {entryList.length === 0 && (
                    <p style={{ padding: 12, fontSize: 12, opacity: 0.5 }}>
                      {t('editor.registryEmpty')}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <footer className={styles['resource-registry__footer']}>
          <button className={styles['resource-registry__btn']} onClick={handleCancel}>
            {t(embedded ? 'settings.reset' : 'editor.cancel')}
          </button>
          <button className={styles['resource-registry__btn']} onClick={handleApply}>
            {t('editor.apply')}
          </button>
          {!embedded && <button className={`${styles['resource-registry__btn']} ${styles['resource-registry__btn--primary']}`} onClick={handleConfirm}>
            {t('editor.confirm')}
          </button>}
        </footer>
      </div>
    </div>
  )
}
