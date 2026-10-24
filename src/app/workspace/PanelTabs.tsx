import { useState, type ReactNode } from 'react'
import styles from './PanelTabs.module.css'

/** A panel destination; disabled entries reserve future pages without activating them. */
interface PanelTab<T extends string> {
  value: T
  label: string
  disabled?: boolean
  title?: string
}

/** Controlled destinations keep guarded navigation in the owning workspace. */
interface PanelTabsProps<T extends string> {
  id: string
  label: string
  items: PanelTab<T>[]
  value: T
  onChange: (value: T) => void
  trailing?: ReactNode
}

/** Connected panel tabs use manual activation so arrow navigation never discards drafts.
 * @param props - Stable ID, destinations, accepted selection and trailing panel actions.
 * @returns The tab strip; callers label their panel with the selected tab's ID.
 */
export function PanelTabs<T extends string>(props: PanelTabsProps<T>) {
  const { id, label, items, value, onChange, trailing } = props
  const [focused, setFocused] = useState<T | null>(null)
  const enabled = items.filter(item => !item.disabled)
  const focusValue = enabled.some(item => item.value === focused) ? focused : value
  return <div className={styles.strip}>
    <div className={styles.tabs} role="tablist" aria-label={label} aria-orientation="horizontal">
      {items.map(item => <button
        key={item.value}
        type="button"
        role="tab"
        id={`${id}-tab-${item.value}`}
        aria-controls={`${id}-panel-${item.value}`}
        aria-selected={value === item.value}
        disabled={item.disabled}
        title={item.title ?? item.label}
        tabIndex={item.value === focusValue ? 0 : -1}
        onFocus={() => setFocused(item.value)}
        onClick={() => onChange(item.value)}
        onKeyDown={event => {
          const index = enabled.findIndex(candidate => candidate.value === item.value)
          let next: number
          if (event.key === 'ArrowLeft') next = (index - 1 + enabled.length) % enabled.length
          else if (event.key === 'ArrowRight') next = (index + 1) % enabled.length
          else if (event.key === 'Home') next = 0
          else if (event.key === 'End') next = enabled.length - 1
          else return
          event.preventDefault()
          event.stopPropagation()
          document.getElementById(`${id}-tab-${enabled[next].value}`)?.focus()
        }}
      >{item.label}</button>)}
    </div>
    {trailing && <div className={styles.actions}>{trailing}</div>}
  </div>
}
