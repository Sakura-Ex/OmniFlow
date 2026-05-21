import { useState, useMemo } from 'react'
import { useGlobalResourceTable } from '../registry/globalResourceTable'
import { resolveCategoryDef, normalizeEndpointPorts } from '../utils/endpointNorm'
import { formatSimpleRate } from '../utils/resourceFormat'
import { parseNormalizedKey, stripNetPrefix, buildResourceId } from '../utils/resourceIdentifier'
import { useRecipeStore } from '../stores/recipeStore'
import { useCanvasStore } from '../stores/canvasStore'
import type { SourceNodeData, TargetNodeData } from '../types/recipe'
import './SystemHUD.css'
import './IntermediateProductsPanel.css'

type IntermediateProductsPanelProps = {
  systemInputs: Record<string, number>
  systemOutputs: Record<string, number>
}

function parseItemKey(item: string): { category: string; name: string } {
  const { category, id } = parseNormalizedKey(item)
  return { category, name: id }
}

function HUDResourceRow({ item, value, isGlobal }: { item: string; value: number; isGlobal: boolean }) {
  const userCategories = useGlobalResourceTable((state) => state.categories)
  const userOverrides = useGlobalResourceTable((state) => state.overrides)
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

export function IntermediateProductsPanel({
  systemInputs,
  systemOutputs,
}: IntermediateProductsPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const recipes = useRecipeStore((state) => state.recipes)
  const nodes = useCanvasStore((state) => state.nodes)

  const intermediateItems = useMemo(() => {
    const allCanvasItems = new Set<string>()

    for (const recipe of Object.values(recipes)) {
      for (const r of recipe.base_inputs ?? []) {
        if (r.id) allCanvasItems.add(buildResourceId(r.category, r.id))
      }
      for (const r of recipe.base_outputs ?? []) {
        if (r.id) allCanvasItems.add(buildResourceId(r.category, r.id))
      }
      for (const r of recipe.base_utility_inputs ?? []) {
        if (r.id) allCanvasItems.add(buildResourceId(r.category, r.id))
      }
      for (const r of recipe.base_utility_outputs ?? []) {
        if (r.id) allCanvasItems.add(buildResourceId(r.category, r.id))
      }
    }

    for (const node of nodes) {
      if (node.type !== 'sourceNode' && node.type !== 'targetNode') continue
      const ports = normalizeEndpointPorts(node.data as SourceNodeData | TargetNodeData)
      for (const port of ports) {
        if (port.id) allCanvasItems.add(buildResourceId(port.category, port.id))
      }
    }

    const ratedKeys = new Set<string>()
    for (const key of Object.keys(systemInputs)) {
      ratedKeys.add(stripNetPrefix(key))
    }
    for (const key of Object.keys(systemOutputs)) {
      ratedKeys.add(stripNetPrefix(key))
    }

    const entries: string[] = []
    for (const item of allCanvasItems) {
      if (!ratedKeys.has(item)) {
        entries.push(item)
      }
    }
    return entries.sort()
  }, [recipes, nodes, systemInputs, systemOutputs])

  if (intermediateItems.length === 0) return null

  return (
    <section className="system-hud__panel system-hud__panel--intermediate">
      <header className="system-hud__header system-hud__header--right">
        <span className="system-hud__title system-hud__title--intermediate">
          🔗 INTERMEDIATE (s=0)
        </span>
        <button
          className={`system-hud__toggle${collapsed ? ' is-collapsed' : ''}`}
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label="Toggle intermediate panel"
        >
          ▾
        </button>
      </header>
      {!collapsed && (
        <div className="system-hud__list">
          {intermediateItems.map((item) => (
            <HUDResourceRow
              key={`int-${item}`}
              item={item}
              value={0}
              isGlobal={false}
            />
          ))}
        </div>
      )}
    </section>
  )
}
