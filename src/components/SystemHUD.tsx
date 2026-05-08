import { useState } from 'react'
import { useResourceRegistry } from '../registry/resourceRegistry'
import { resolveCategoryDef } from '../utils/endpointNorm'
import { formatSimpleRate } from '../utils/resourceFormat'
import { parseResourceId, stripNetPrefix, isVirtualGlobal } from '../utils/resourceIdentifier'
import './SystemHUD.css'

type SystemHUDProps = {
  systemInputs: Record<string, number>
  systemOutputs: Record<string, number>
  globalInputIds: string[]
  globalOutputIds: string[]
  capexList: Record<string, number>
}

function stripNetKey(item: string): { baseId: string; category: string; name: string } {
  const raw = stripNetPrefix(item)
  if (raw === item) return { baseId: item, category: 'item', name: item }
  const parsed = parseResourceId(raw)
  return { baseId: raw, category: parsed.category, name: parsed.id }
}

function parseItemKey(item: string): { category: string; name: string } {
  const { category, name } = stripNetKey(item)
  return { category, name }
}

function getGlobalKey(item: string): string {
  return stripNetKey(item).baseId
}

function HUDResourceRow({ item, value, isGlobal }: { item: string; value: number; isGlobal: boolean }) {
  const userCategories = useResourceRegistry((state) => state.categories)
  const userOverrides = useResourceRegistry((state) => state.overrides)
  const { category, name } = parseItemKey(item)
  const catDef = resolveCategoryDef(category, userCategories, userOverrides)
  const hexColor = catDef.themeColor

  return (
    <div className={`system-hud__row${isGlobal ? ' system-hud__row--global' : ''}`}>
      <span className="system-hud__item">
        <span className="system-hud__badge" style={{ color: hexColor, borderColor: hexColor }}>
          {catDef.displayName}
        </span>
        <span className="system-hud__name">{name}</span>
      </span>
      <span className="system-hud__value">{formatSimpleRate(value)}</span>
    </div>
  )
}

export function SystemHUD({
  systemInputs,
  systemOutputs,
  globalInputIds,
  globalOutputIds,
  capexList,
}: SystemHUDProps) {
  const [inputsCollapsed, setInputsCollapsed] = useState(false)
  const [outputsCollapsed, setOutputsCollapsed] = useState(false)
  const [capexCollapsed, setCapexCollapsed] = useState(false)
  const globalInputSet = new Set(globalInputIds)
  const globalOutputSet = new Set(globalOutputIds)

  const allInputEntries = Object.entries(systemInputs)
    .filter(([item]) => !isVirtualGlobal(item))
  const allOutputEntries = Object.entries(systemOutputs)
    .filter(([item]) => !isVirtualGlobal(item))
  const wiredInputEntries = allInputEntries.filter(([item]) => !globalInputSet.has(getGlobalKey(item)))
  const globalInputEntries = allInputEntries.filter(([item]) => globalInputSet.has(getGlobalKey(item)))
  const wiredOutputEntries = allOutputEntries.filter(([item]) => !globalOutputSet.has(getGlobalKey(item)))
  const globalOutputEntries = allOutputEntries.filter(([item]) => globalOutputSet.has(getGlobalKey(item)))

  return (
    <div className="system-hud">
      <div className="system-hud__left-col">
      <section className="system-hud__panel system-hud__panel--inputs">
        <header className="system-hud__header">
          <span className="system-hud__title system-hud__title--inputs">
            ⬇️ SYSTEM INPUTS (/s)
          </span>
          <button
            className={`system-hud__toggle${inputsCollapsed ? ' is-collapsed' : ''}`}
            type="button"
            onClick={() => setInputsCollapsed((prev) => !prev)}
            aria-label="Toggle inputs panel"
          >
            ▾
          </button>
        </header>
        {!inputsCollapsed && (
          <div className="system-hud__list">
            {wiredInputEntries.length > 0 ? (
              wiredInputEntries.map(([item, value]) => (
                <HUDResourceRow key={item} item={item} value={value} isGlobal={false} />
              ))
            ) : (
              <div className="system-hud__empty">有线输入暂无数据</div>
            )}

            <div className="system-hud__divider" />
            <div className="system-hud__subhead">GLOBAL BUS</div>

            {globalInputEntries.length > 0 ? (
              globalInputEntries.map(([item, value]) => (
                <HUDResourceRow key={`g-in-${item}`} item={item} value={value} isGlobal={true} />
              ))
            ) : (
              <div className="system-hud__empty">全局管网输入暂无数据</div>
            )}
          </div>
        )}
      </section>

      <section className="system-hud__panel system-hud__panel--capex">
        <header className="system-hud__header">
          <span className="system-hud__title system-hud__title--capex">
            🏗️ BUILD LIST (CapEx)
          </span>
          <button
            className={`system-hud__toggle${capexCollapsed ? ' is-collapsed' : ''}`}
            type="button"
            onClick={() => setCapexCollapsed((prev) => !prev)}
            aria-label="Toggle CapEx panel"
          >
            ▾
          </button>
        </header>
        {!capexCollapsed && (
          <div className="system-hud__list">
            {Object.keys(capexList).length > 0 ? (
              Object.entries(capexList).map(([item, value]) => (
                <HUDResourceRow key={`capex-${item}`} item={item} value={value} isGlobal={false} />
              ))
            ) : (
              <div className="system-hud__empty">暂无数据 / 请运行计算</div>
            )}
          </div>
        )}
      </section>
      </div>

      <section className="system-hud__panel system-hud__panel--outputs">
        <header className="system-hud__header system-hud__header--right">
          <span className="system-hud__title system-hud__title--outputs">
            ⬆️ SYSTEM OUTPUTS (/s)
          </span>
          <button
            className={`system-hud__toggle${outputsCollapsed ? ' is-collapsed' : ''}`}
            type="button"
            onClick={() => setOutputsCollapsed((prev) => !prev)}
            aria-label="Toggle outputs panel"
          >
            ▾
          </button>
        </header>
        {!outputsCollapsed && (
          <div className="system-hud__list">
            {wiredOutputEntries.length > 0 ? (
              wiredOutputEntries.map(([item, value]) => (
                <HUDResourceRow key={item} item={item} value={value} isGlobal={false} />
              ))
            ) : (
              <div className="system-hud__empty">有线输出暂无数据</div>
            )}

            <div className="system-hud__divider" />
            <div className="system-hud__subhead">GLOBAL BUS</div>

            {globalOutputEntries.length > 0 ? (
              globalOutputEntries.map(([item, value]) => (
                <HUDResourceRow key={`g-out-${item}`} item={item} value={value} isGlobal={true} />
              ))
            ) : (
              <div className="system-hud__empty">全局管网输出暂无数据</div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
