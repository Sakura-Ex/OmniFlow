import { useCallback, useState, type KeyboardEvent } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useNodeData } from '@/features/canvas/contexts/NodeDataContext'
import { useEndpointEditor } from '@/features/canvas/contexts/EndpointEditorContext'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { buildUnitSuffix } from '@/features/resource-registry/registry.units'
import { normalizeEndpointPorts, resolveCategoryDef } from '@/features/recipe/recipe.endpointNorm'
import { buildResourceId, DEFAULT_RESOURCE_CATEGORY } from '@/common/utils/resourceId'
import { formatOpExRate } from '@/common/utils/format'
import type { SourceNodeData, SourceNodeMode } from '@/common/types/recipe'
import styles from './SourceNode.module.css'
import shared from './shared-port.module.css'

export function SourceNode({ id, data }: NodeProps<SourceNodeData>) {
  const { updateNodeData } = useNodeData()
  const { onEdit } = useEndpointEditor()
  const userCategories = useGlobalResourceTable((state) => state.categories)
  const userOverrides = useGlobalResourceTable((state) => state.overrides)
  const ports = normalizeEndpointPorts(data)
  const mode: SourceNodeMode = data.mode ?? (data.is_virtual ?? true ? 'infinite' : 'limit')
  const isEditable = mode === 'limit'
  const [draftAmounts, setDraftAmounts] = useState<Record<number, string>>({})

  const handleSetMode = useCallback((nextMode: SourceNodeMode) => {
    if (nextMode === mode) return
    if (nextMode === 'limit') {
      updateNodeData(id, { mode: 'limit' })
    } else {
      updateNodeData(id, { mode: 'infinite' })
    }
  }, [mode, id, updateNodeData])

  const commitAmount = useCallback((portIndex: number) => {
    const draft = draftAmounts[portIndex]
    if (draft === undefined) return
    const parsed = Number.parseFloat(draft)
    const nextAmount = Number.isFinite(parsed) ? parsed : (ports[portIndex]?.amount ?? 0)
    const nextPorts = ports.map((p, i) => i === portIndex ? { ...p, amount: nextAmount } : p)
    updateNodeData(id, { ports: nextPorts })
    setDraftAmounts((prev) => {
      const next = { ...prev }
      delete next[portIndex]
      return next
    })
  }, [draftAmounts, ports, id, updateNodeData])

  const handleAmountKeyDown = useCallback((portIndex: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setDraftAmounts((prev) => {
        const next = { ...prev }
        delete next[portIndex]
        return next
      })
      event.currentTarget.blur()
    }
  }, [])

  return (
    <article className={`${styles['source-node']} ${styles[`source-node--${mode}`]}`}>
      <header className={styles['source-node__header']}>
        <p className={styles['source-node__kicker']}>INPUT SOURCE</p>
        <div className={styles['source-node__header-actions']}>
          <button
            className={`${styles['source-node__edit-btn']} nodrag`}
            onClick={() => onEdit(id, 'source', data)}
            title="设置"
          >⚙</button>
          <div className={styles['source-node__seg']}>
            <button
              className={`${styles['source-node__mode-btn']} nodrag${mode === 'limit' ? ` ${styles['source-node__mode-btn--active']}` : ''}`}
              onClick={() => handleSetMode('limit')} title="供给上限"
            >🚧</button>
            <button
              className={`${styles['source-node__mode-btn']} nodrag${mode === 'infinite' ? ` ${styles['source-node__mode-btn--active']}` : ''}`}
              onClick={() => handleSetMode('infinite')} title="无限供应"
            >♾️</button>
          </div>
        </div>
      </header>

      <section className={shared['recipe-node__ports']}>
        <ul className={`${shared['recipe-node__port-list']} ${shared['recipe-node__port-list--right']}`}>
          {ports.map((port, index) => {
            const portCategory = port.category ?? DEFAULT_RESOURCE_CATEGORY
            const catDef = resolveCategoryDef(portCategory, userCategories, userOverrides)
            const unit = buildUnitSuffix(catDef.base_unit, 'rate_per_sec')
            const hexColor = catDef.themeColor
            const glowColor = hexColor.startsWith('#')
              ? `${hexColor}${Math.round(0.38 * 255).toString(16).padStart(2, '0')}`
              : hexColor.replace(')', ', 0.38)').replace('rgb', 'rgba')
            const handleId = buildResourceId(portCategory, port.id)
            const actualAmt = data.actual_amounts?.[handleId]
            const draftAmount = draftAmounts[index]
            const inputValue = isEditable
              ? (draftAmount !== undefined ? draftAmount : String(port.amount ?? ''))
              : (actualAmt !== undefined ? formatOpExRate(actualAmt) : '')

            const isGlobal = port.routing_mode === 'global'

            return (
              <li className={`${shared['recipe-node__port']} ${shared['recipe-node__port--right']}${isGlobal ? ` ${shared['recipe-node__port--global']}` : ''}`} key={port._uid ?? `${id}-port-${index}`}>
                <div className={`${shared['recipe-node__port-core']} ${shared['recipe-node__port-core--right']}`}>
                  <div className={shared['endpoint-inline-stat']}>
                    <input
                      type={isEditable ? 'number' : 'text'}
                      className={`${shared['endpoint-inline-input']} nodrag${!isEditable ? ` ${shared['endpoint-inline-input--readonly']}` : ''}`}
                      value={inputValue}
                      readOnly={!isEditable}
                      onChange={(e) => isEditable && setDraftAmounts((prev) => ({ ...prev, [index]: e.target.value }))}
                      onBlur={isEditable ? () => commitAmount(index) : undefined}
                      onKeyDown={isEditable ? handleAmountKeyDown(index) : undefined}
                      placeholder="等待计算"
                    />
                    <span className={shared['endpoint-inline-unit']}>{unit}</span>
                  </div>
                  <span className={`${shared['recipe-node__port-name']} ${shared['recipe-node__port-name--right']}`}>{port.id || '(未命名)'}</span>
                  <span className={shared['recipe-node__port-type']} style={{ color: hexColor, borderColor: hexColor }}>
                    {catDef.displayName}
                  </span>
                  {isGlobal ? (
                    <svg
                      className={`${shared['recipe-node__global-icon']} ${shared['recipe-node__global-icon--right']}`}
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke={hexColor}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    >
                      <circle cx="12" cy="8" r="6" fill={hexColor} stroke="none" />
                      <path d="M25 8 A 13 13 0 0 0 12 -5" />
                      <path d="M21 8 A 9 9 0 0 0 12 -1" />
                    </svg>
                  ) : (
                    <Handle
                      id={handleId}
                      type="source"
                      position={Position.Right}
                      className={shared['recipe-node__handle']}
                      style={{ right: '-6px', backgroundColor: hexColor, borderColor: hexColor, boxShadow: `0 0 0 4px ${glowColor}` }}
                    />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </article>
  )
}
