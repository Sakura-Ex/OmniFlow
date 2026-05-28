import { useState, useMemo } from 'react'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { resolveCategoryDef } from '@/features/recipe/recipe.endpointNorm'
import { formatSimpleRate } from '@/common/utils/rateFormat'
import { normalizeResourceKey, parseNormalizedKey, stripNetPrefix, isVirtualGlobal } from '@/common/utils/resourceId'
import { IntermediateProductsPanel } from './IntermediateProductsPanel'
import styles from './SystemHUD.module.css'

/**
 *
 */
type SystemHUDProps = {
  systemInputs: Record<string, number>
  systemOutputs: Record<string, number>
  globalInputIds: string[]
  globalOutputIds: string[]
  capexList: Record<string, number>
}

/**
 * Split a normalized resource key into its category and name parts.
 * @param item - The normalized resource key.
 * @returns An object with `category` and `name`.
 */
function parseItemKey(item: string): { category: string; name: string } {
  const { category, id } = parseNormalizedKey(item)
  return { category, name: id }
}

/**
 * Normalize a resource key for global bus matching.
 * @param item - The resource key to normalize.
 * @returns The normalized resource key.
 */
function getGlobalKey(item: string): string {
  return normalizeResourceKey(item)
}

/**
 * Renders a single resource row within the system HUD.
 * @param root0 - Component props.
 * @param root0.item - The normalized resource key.
 * @param root0.value - The numeric rate value.
 * @param root0.isGlobal - Whether this resource uses global bus routing.
 * @returns Rendered JSX for the resource row.
 */
function HUDResourceRow({ item, value, isGlobal }: { item: string; value: number; isGlobal: boolean }) {
  const userCategories = useGlobalResourceTable((state) => state.categories)
  const userOverrides = useGlobalResourceTable((state) => state.overrides)
  const { category, name } = parseItemKey(item)
  const catDef = resolveCategoryDef(category, userCategories, userOverrides)
  const hexColor = catDef.themeColor

  return (
    <div className={`${styles['system-hud__row']}${isGlobal ? ` ${styles['system-hud__row--global']}` : ''}`}>
      <span className={styles['system-hud__item']}>
        <span className={styles['system-hud__badge']} style={{ color: hexColor, borderColor: hexColor }}>
          {catDef.displayName}
        </span>
        <span className={styles['system-hud__name']}>{name}</span>
      </span>
      <span className={styles['system-hud__value']}>{formatSimpleRate(value)}</span>
    </div>
  )
}

/**
 * System-level heads-up display showing real-time material balances.
 * Displays system inputs (wired and global), system outputs (wired and global),
 * and a build-list (CapEx) panel. Each section can be collapsed independently.
 * Material rates are computed from the net difference between system inputs and outputs.
 *
 * @param props - Component props
 * @param props.systemInputs - Raw map of resource keys to input rates across the canvas
 * @param props.systemOutputs - Raw map of resource keys to output rates across the canvas
 * @param props.globalInputIds - Set of resource IDs designated as global bus inputs
 * @param props.globalOutputIds - Set of resource IDs designated as global bus outputs
 * @param props.capexList - Map of resource keys to their capital expenditure (build) quantities
 * @returns Rendered JSX element for the system HUD.
 */
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

  const { displayInputs, displayOutputs } = useMemo(() => {
    const net: Record<string, number> = {}
    for (const [key, rate] of Object.entries(systemInputs)) {
      const baseId = stripNetPrefix(key)
      net[baseId] = (net[baseId] ?? 0) - rate
    }
    for (const [key, rate] of Object.entries(systemOutputs)) {
      const baseId = stripNetPrefix(key)
      net[baseId] = (net[baseId] ?? 0) + rate
    }
    const inputs: Record<string, number> = {}
    const outputs: Record<string, number> = {}
    for (const [baseId, netRate] of Object.entries(net)) {
      if (netRate > 1e-9) {
        outputs[baseId] = netRate
      } else if (netRate < -1e-9) {
        inputs[baseId] = -netRate
      }
    }
    return { displayInputs: inputs, displayOutputs: outputs }
  }, [systemInputs, systemOutputs])

  const allInputEntries = Object.entries(displayInputs)
    .filter(([item]) => !isVirtualGlobal(item))
  const allOutputEntries = Object.entries(displayOutputs)
    .filter(([item]) => !isVirtualGlobal(item))
  const wiredInputEntries = allInputEntries.filter(([item]) => !globalInputSet.has(getGlobalKey(item)))
  const globalInputEntries = allInputEntries.filter(([item]) => globalInputSet.has(getGlobalKey(item)))
  const wiredOutputEntries = allOutputEntries.filter(([item]) => !globalOutputSet.has(getGlobalKey(item)))
  const globalOutputEntries = allOutputEntries.filter(([item]) => globalOutputSet.has(getGlobalKey(item)))

  return (
    <div className={styles['system-hud']}>
      <div className={styles['system-hud__left-col']}>
      <section className={`${styles['system-hud__panel']} ${styles['system-hud__panel--inputs']}`}>
        <header className={styles['system-hud__header']}>
          <span className={`${styles['system-hud__title']} ${styles['system-hud__title--inputs']}`}>
            ⬇️ SYSTEM INPUTS (/s)
          </span>
          <button
            className={`${styles['system-hud__toggle']}${inputsCollapsed ? ` ${styles['system-hud__toggle--collapsed']}` : ''}`}
            type="button"
            onClick={() => setInputsCollapsed((prev) => !prev)}
            aria-label="Toggle inputs panel"
          >
            ▾
          </button>
        </header>
        {!inputsCollapsed && (
          <div className={styles['system-hud__list']}>
            {wiredInputEntries.length > 0 ? (
              wiredInputEntries.map(([item, value]) => (
                <HUDResourceRow key={item} item={item} value={value} isGlobal={false} />
              ))
            ) : (
              <div className={styles['system-hud__empty']}>有线输入暂无数据</div>
            )}

            <div className={styles['system-hud__divider']} />
            <div className={styles['system-hud__subhead']}>GLOBAL BUS</div>

            {globalInputEntries.length > 0 ? (
              globalInputEntries.map(([item, value]) => (
                <HUDResourceRow key={`g-in-${item}`} item={item} value={value} isGlobal={true} />
              ))
            ) : (
              <div className={styles['system-hud__empty']}>全局管网输入暂无数据</div>
            )}
          </div>
        )}
      </section>

      <section className={`${styles['system-hud__panel']} ${styles['system-hud__panel--capex']}`}>
        <header className={styles['system-hud__header']}>
          <span className={`${styles['system-hud__title']} ${styles['system-hud__title--capex']}`}>
            🏗️ BUILD LIST (CapEx)
          </span>
          <button
            className={`${styles['system-hud__toggle']}${capexCollapsed ? ` ${styles['system-hud__toggle--collapsed']}` : ''}`}
            type="button"
            onClick={() => setCapexCollapsed((prev) => !prev)}
            aria-label="Toggle CapEx panel"
          >
            ▾
          </button>
        </header>
        {!capexCollapsed && (
          <div className={styles['system-hud__list']}>
            {Object.keys(capexList).length > 0 ? (
              Object.entries(capexList).map(([item, value]) => (
                <HUDResourceRow key={`capex-${item}`} item={item} value={value} isGlobal={false} />
              ))
            ) : (
              <div className={styles['system-hud__empty']}>暂无数据 / 请运行计算</div>
            )}
          </div>
        )}
      </section>
      </div>

      <div className={styles['system-hud__right-col']}>
      <section className={`${styles['system-hud__panel']} ${styles['system-hud__panel--outputs']}`}>
        <header className={`${styles['system-hud__header']} ${styles['system-hud__header--right']}`}>
          <span className={`${styles['system-hud__title']} ${styles['system-hud__title--outputs']}`}>
            ⬆️ SYSTEM OUTPUTS (/s)
          </span>
          <button
            className={`${styles['system-hud__toggle']}${outputsCollapsed ? ` ${styles['system-hud__toggle--collapsed']}` : ''}`}
            type="button"
            onClick={() => setOutputsCollapsed((prev) => !prev)}
            aria-label="Toggle outputs panel"
          >
            ▾
          </button>
        </header>
        {!outputsCollapsed && (
          <div className={styles['system-hud__list']}>
            {wiredOutputEntries.length > 0 ? (
              wiredOutputEntries.map(([item, value]) => (
                <HUDResourceRow key={item} item={item} value={value} isGlobal={false} />
              ))
            ) : (
              <div className={styles['system-hud__empty']}>有线输出暂无数据</div>
            )}

            <div className={styles['system-hud__divider']} />
            <div className={styles['system-hud__subhead']}>GLOBAL BUS</div>

            {globalOutputEntries.length > 0 ? (
              globalOutputEntries.map(([item, value]) => (
                <HUDResourceRow key={`g-out-${item}`} item={item} value={value} isGlobal={true} />
              ))
            ) : (
              <div className={styles['system-hud__empty']}>全局管网输出暂无数据</div>
            )}
          </div>
        )}
      </section>

      <IntermediateProductsPanel
        systemInputs={systemInputs}
        systemOutputs={systemOutputs}
      />
      </div>
    </div>
  )
}
