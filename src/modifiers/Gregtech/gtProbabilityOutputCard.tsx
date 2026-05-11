import type { ModifierCardRenderProps } from '../types'
import type { Resource } from '../../types/types'
import { useGlobalResourceTable } from '../../registry/globalResourceTable'

const BOOST_KEY_PREFIX = 'boost:'

function getBoostKey(id: string): string {
  return `${BOOST_KEY_PREFIX}${id}`
}

const READONLY_BASE: React.CSSProperties = {
  cursor: 'default',
  opacity: 0.7,
  minWidth: 0,
}

export function GtProbabilityOutputCardBody({ state, onChange, readOnly, recipeOutputs }: ModifierCardRenderProps) {
  const categories = useGlobalResourceTable((s) => s.categories)
  const outputs: Resource[] = recipeOutputs ?? []

  const chanceOutputs = outputs.filter((o) => {
    const p = o.probability
    return typeof p === 'number' && p > 0 && p < 1
  })

  if (chanceOutputs.length === 0) {
    return (
      <label className="recipe-settings__control">
        <span>概率产出增幅</span>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>无 0&lt;概率&lt;1 的输出</span>
      </label>
    )
  }

  return (
    <>
      {chanceOutputs.map((o) => {
        const catDisplayName = categories[o.category]?.displayName ?? o.category
        const boostKey = getBoostKey(`${o.category}:${o.id}`)
        const boostValue = Number(state[boostKey] ?? 0)

        return (
          <label key={`${o.category}:${o.id}`} className="recipe-settings__control">
            <span>概率产出增幅</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                value={catDisplayName}
                readOnly
                style={{ ...READONLY_BASE, flex: '0 0 60px' }}
              />
              <input
                value={o.id}
                readOnly
                style={{ ...READONLY_BASE, flex: '1 1 auto' }}
              />
              <input
                type="number"
                value={boostValue}
                min={0}
                step={0.01}
                readOnly={readOnly}
                onChange={(e) => onChange(boostKey, Number(e.target.value))}
                style={{ flex: '0 0 80px', minWidth: 0 }}
              />
            </div>
          </label>
        )
      })}
    </>
  )
}
