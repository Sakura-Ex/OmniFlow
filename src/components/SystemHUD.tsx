import { useState } from 'react'
import './SystemHUD.css'

type SystemHUDProps = {
  systemInputs: Record<string, number>
  systemOutputs: Record<string, number>
  globalInputIds: string[]
  globalOutputIds: string[]
}

function formatAmount(value: number) {
  return value.toFixed(2)
}

export function SystemHUD({
  systemInputs,
  systemOutputs,
  globalInputIds,
  globalOutputIds,
}: SystemHUDProps) {
  const [inputsCollapsed, setInputsCollapsed] = useState(false)
  const [outputsCollapsed, setOutputsCollapsed] = useState(false)
  const globalInputSet = new Set(globalInputIds)
  const globalOutputSet = new Set(globalOutputIds)

  const allInputEntries = Object.entries(systemInputs)
    .filter(([item]) => !item.startsWith('Virtual_Global_'))
  const allOutputEntries = Object.entries(systemOutputs)
    .filter(([item]) => !item.startsWith('Virtual_Global_'))

  const wiredInputEntries = allInputEntries.filter(([item]) => !globalInputSet.has(item))
  const globalInputEntries = allInputEntries.filter(([item]) => globalInputSet.has(item))
  const wiredOutputEntries = allOutputEntries.filter(([item]) => !globalOutputSet.has(item))
  const globalOutputEntries = allOutputEntries.filter(([item]) => globalOutputSet.has(item))

  return (
    <div className="system-hud">
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
                <div className="system-hud__row" key={item}>
                  <span className="system-hud__item">{item}</span>
                  <span className="system-hud__value">{formatAmount(value)}</span>
                </div>
              ))
            ) : (
              <div className="system-hud__empty">有线输入暂无数据</div>
            )}

            <div className="system-hud__divider" />
            <div className="system-hud__subhead">GLOBAL BUS</div>

            {globalInputEntries.length > 0 ? (
              globalInputEntries.map(([item, value]) => (
                <div className="system-hud__row system-hud__row--global" key={`g-in-${item}`}>
                  <span className="system-hud__item">{item}</span>
                  <span className="system-hud__value">{formatAmount(value)}</span>
                </div>
              ))
            ) : (
              <div className="system-hud__empty">全局管网输入暂无数据</div>
            )}
          </div>
        )}
      </section>

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
                <div className="system-hud__row" key={item}>
                  <span className="system-hud__item">{item}</span>
                  <span className="system-hud__value">{formatAmount(value)}</span>
                </div>
              ))
            ) : (
              <div className="system-hud__empty">有线输出暂无数据</div>
            )}

            <div className="system-hud__divider" />
            <div className="system-hud__subhead">GLOBAL BUS</div>

            {globalOutputEntries.length > 0 ? (
              globalOutputEntries.map(([item, value]) => (
                <div className="system-hud__row system-hud__row--global" key={`g-out-${item}`}>
                  <span className="system-hud__item">{item}</span>
                  <span className="system-hud__value">{formatAmount(value)}</span>
                </div>
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
