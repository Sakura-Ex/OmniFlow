import { useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { UnitExpression } from '@/common/types/units'
import { UnitSystem, Quantity } from '@/common/units/UnitSystem'
import { useSettingsStore } from '@/features/settings/settings.store'
import styles from './UnitExpressionEditor.module.css'

/** Input and display expressions share one structured editor. */
interface UnitExpressionEditorProps {
  expression: UnitExpression
  amount: number
  onChange: (unit: UnitExpression, amount: number) => void
  displayExpression?: UnitExpression
  onDisplayChange?: (unit: UnitExpression) => void
}

/** A compatible registered expression offered in the compact unit selector. */
interface UnitOption {
  value: string
  label: string
}

/**
 * Offer registered units and rates compatible with the current quantity.
 * @param units - The active unit environment.
 * @param expression - The current input or display expression.
 * @returns Labelled, compatible unit choices.
 */
function compatibleOptions(units: UnitSystem, expression: UnitExpression): UnitOption[] {
  const options = new Map<string, UnitOption>()
  const add = (candidate: UnitExpression) => {
    try {
      const unit = units.expression(candidate)
      units.expression(expression).conversionScale(unit)
      const value = JSON.stringify(candidate)
      options.set(value, { value, label: unit.toString() })
    } catch { /* Incompatible or affine units are omitted from quick choices. */ }
  }
  add(expression)
  for (const definition of units.registry.definitions) {
    for (const prefixId of [undefined, ...units.registry.prefixes.map((prefix) => prefix.id)]) {
      const candidate: UnitExpression = [{ baseUnitId: definition.id, ...(prefixId ? { prefixId } : {}), exponent: 1 }]
      add(candidate)
      for (const timeBase of ['rate_per_sec', 'rate_per_tick']) {
        try { add(units.rateQuantity(1, candidate, timeBase, 1).unit.expression) } catch { /* Invalid rates are not offered. */ }
      }
    }
  }
  return [...options.values()]
}

/**
 * Convert input quantities or choose display units through a compact control.
 * @param props - Current expressions, amount and semantic update callbacks.
 * @returns A unit selector with optional custom expression editing.
 */
export function UnitExpressionEditor(props: UnitExpressionEditorProps) {
  const { expression, amount, onChange, displayExpression, onDisplayChange } = props
  const snapshot = useSettingsStore((s) => s.units)
  const units = useMemo(() => new UnitSystem(snapshot), [snapshot])
  const popoverId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<UnitExpression>(expression)
  const [mode, setMode] = useState<'input' | 'display'>('input')
  const [position, setPosition] = useState({ left: 12, top: 12 })
  const displayUnit = useMemo(
    () => displayExpression ?? units.rateQuantity(1, expression, 'rate_per_sec', 1).unit.expression,
    [displayExpression, expression, units],
  )
  const [error, setError] = useState('')
  const label = (() => { try { return units.expression(expression).toString() } catch { return '未知单位' } })()
  const changeMode = (next: 'input' | 'display') => {
    setMode(next)
    setDraft(next === 'input' ? expression : displayUnit)
    setError('')
  }
  // Quantity edits can recreate factor arrays without changing the expression.
  const optionExpressionKey = JSON.stringify(mode === 'input' ? expression : displayUnit)
  const options = useMemo(
    () => compatibleOptions(units, JSON.parse(optionExpressionKey) as UnitExpression),
    [optionExpressionKey, units],
  )
  const draftValue = JSON.stringify(draft)
  const apply = () => {
    try {
      if (mode === 'display') {
        units.expression(displayUnit).conversionScale(units.expression(draft))
        onDisplayChange?.(draft)
      } else {
        const converted = Quantity.of(amount, units.expression(expression)).to(units.expression(draft)).value
        onChange(draft, converted)
      }
      setError('')
      panelRef.current?.hidePopover()
    } catch { setError('单位无法换算，请检查单位和指数。') }
  }

  return <div className={styles.editor}>
    <button className={styles.trigger} type="button" popoverTarget={popoverId} aria-label="编辑单位" title={label} onClick={(event) => {
      changeMode('input')
      const bounds = event.currentTarget.getBoundingClientRect()
      setPosition({
        left: Math.max(12, Math.min(bounds.left, window.innerWidth - 352)),
        top: Math.max(12, Math.min(bounds.bottom + 4, window.innerHeight - 260)),
      })
    }}>
      <span className={styles.label}>{label}</span><span aria-hidden="true">▾</span>
    </button>
    <div ref={panelRef} id={popoverId} popover="auto" className={styles.panel} style={{
      '--unit-popover-left': `${position.left}px`,
      '--unit-popover-top': `${position.top}px`,
    } as CSSProperties}>
      <header className={styles.header}>
        <span>单位</span>
        <button className={styles.close} type="button" popoverTarget={popoverId} popoverTargetAction="hide" aria-label="关闭单位选择">×</button>
      </header>
      {onDisplayChange && <div className={styles.modes}>
        <button className={`${styles.button} ${mode === 'input' ? styles.active : ''}`} aria-pressed={mode === 'input'} type="button" onClick={() => changeMode('input')}>输入单位</button>
        <button className={`${styles.button} ${mode === 'display' ? styles.active : ''}`} aria-pressed={mode === 'display'} type="button" onClick={() => changeMode('display')}>显示单位</button>
      </div>}
      <select className={styles.control} aria-label={mode === 'input' ? '选择输入单位' : '选择显示单位'} value={draftValue} onChange={(event) => {
        const option = options.find((item) => item.value === event.target.value)
        if (option) setDraft(JSON.parse(option.value) as UnitExpression)
        setError('')
      }}>
        {!options.some((option) => option.value === draftValue) && <option value={draftValue}>自定义单位</option>}
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
      <details className={styles.advanced} key={mode}>
        <summary>自定义单位</summary>
        {draft.map((factor, index) => <div className={styles.factor} key={index}>
          <select className={styles.control} aria-label="基本单位" value={factor.baseUnitId} onChange={(event) => setDraft(draft.map((entry, i) => i === index ? { ...entry, baseUnitId: event.target.value } : entry))}>
            {snapshot.definitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.symbol}</option>)}
          </select>
          <select className={styles.control} aria-label="尺度前缀" value={factor.prefixId ?? ''} onChange={(event) => setDraft(draft.map((entry, i) => i === index ? { ...entry, prefixId: event.target.value || undefined } : entry))}>
            <option value="">无前缀</option>
            {snapshot.prefixes.map((prefix) => <option key={prefix.id} value={prefix.id}>{prefix.symbol}</option>)}
          </select>
          <input className={styles.control} aria-label="整数指数" type="number" step={1} value={factor.exponent} onChange={(event) => setDraft(draft.map((entry, i) => i === index ? { ...entry, exponent: Number(event.target.value) } : entry))} />
          <button className={styles.button} type="button" aria-label="删除单位因子" onClick={() => setDraft(draft.filter((_, i) => i !== index))}>×</button>
        </div>)}
        <button className={styles.button} type="button" onClick={() => setDraft([...draft, { baseUnitId: 's', exponent: -1 }])}>添加因子</button>
      </details>
      <button className={`${styles.button} ${styles.active}`} type="button" onClick={apply}>{mode === 'display' ? '应用显示单位' : '应用输入单位'}</button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  </div>
}
