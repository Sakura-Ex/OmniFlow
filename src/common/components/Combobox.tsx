import { useTranslation } from '@/common/i18n'
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { filterComboboxOptions, nextComboboxOption, type ComboboxOption } from './combobox.options'
import styles from './Combobox.module.css'
import { Icon } from './Icon'

/** Controlled searchable selection; custom identifiers are opt-in. */
export interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  onSelect?: (value: string) => void
  options: readonly ComboboxOption[]
  disabled?: boolean
  className?: string
  'aria-label'?: string
  id?: string
  placeholder?: string
  allowCustom?: boolean
  onBlur?: () => void
}

/**
 * Search candidates without submitting enum drafts or clipping menus inside dialogs.
 * @param props - Controlled selection, search candidates and input presentation.
 * @returns Accessible input with a body-level candidate list.
 */
export function Combobox(props: ComboboxProps) {
  const { t } = useTranslation()
  const { value, onChange, options, disabled = false, className, id, placeholder, allowCustom = false, onBlur } = props
  const uniqueId = useId()
  const inputId = id ?? `combobox-${uniqueId}`
  const listId = `${inputId}-list`
  const inputRef = useRef<HTMLInputElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const focusValue = useRef(value)
  const selectionCommitted = useRef(false)
  const [portalHost, setPortalHost] = useState<Element | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(-1)
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' })
  const visible = filterComboboxOptions(options, query ?? '')
  const selected = options.find(option => option.value === value)
  const text = query ?? selected?.label ?? value
  const expanded = open && !disabled
  const activeId = expanded && active >= 0 && active < visible.length && !visible[active].disabled ? `${listId}-${active}` : undefined

  useLayoutEffect(() => {
    if (selectionCommitted.current) {
      focusValue.current = value
      selectionCommitted.current = false
    }
  })

  useLayoutEffect(() => {
    if (!expanded) return
    const reposition = () => {
      const rect = inputRef.current?.getBoundingClientRect()
      if (!rect) return
      const below = window.innerHeight - rect.bottom - 8
      const above = rect.top - 8
      const upwards = below < 160 && above > below
      const available = Math.max(0, upwards ? above : below)
      const height = Math.min(280, available)
      const width = Math.min(Math.max(rect.width, 180), Math.max(0, window.innerWidth - 16))
      setPosition({ position: 'fixed', left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width, maxHeight: height, ...(upwards ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }), visibility: 'visible' })
    }
    const popup = popupRef.current
    if (popup && typeof popup.showPopover === 'function' && !popup.matches(':popover-open')) popup.showPopover()
    reposition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(reposition)
    if (inputRef.current) observer?.observe(inputRef.current)
    return () => { window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true); observer?.disconnect(); if (popup?.isConnected && typeof popup.hidePopover === 'function' && popup.matches(':popover-open')) popup.hidePopover() }
  }, [expanded])

  useEffect(() => {
    if (!expanded) return
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (inputRef.current?.contains(target) || popupRef.current?.contains(target)) return
      setOpen(false); setQuery(null); setActive(-1)
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [expanded])

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  const close = () => { setOpen(false); setQuery(null); setActive(-1) }
  const choose = (option: ComboboxOption) => {
    if (option.disabled) return
    selectionCommitted.current = true
    if (props.onSelect) props.onSelect(option.value)
    else onChange(option.value)
    close()
  }
  return <span className={styles.wrapper}>
    <input
      ref={inputRef}
      id={inputId}
      className={`${styles.input}${className ? ` ${className}` : ''}`}
      role="combobox"
      aria-label={props['aria-label']}
      aria-autocomplete="list"
      aria-expanded={expanded}
      aria-controls={expanded ? listId : undefined}
      aria-activedescendant={activeId}
      aria-haspopup="listbox"
      autoComplete="off"
      disabled={disabled}
      placeholder={placeholder}
      value={text}
      onFocus={event => { setPortalHost(event.currentTarget.closest('[popover]')); focusValue.current = value; setOpen(true); setQuery(null); setActive(-1); event.currentTarget.select() }}
      onClick={() => setOpen(true)}
      onChange={event => { const draft = event.target.value; setQuery(draft); setOpen(true); setActive(-1); if (allowCustom) onChange(draft) }}
      onBlur={() => { close(); onBlur?.() }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); event.stopPropagation(); setOpen(true)
          setActive(nextComboboxOption(visible, active, event.key === 'ArrowDown' ? 1 : -1))
        } else if (event.key === 'Enter') {
          event.preventDefault(); event.stopPropagation()
          if (!expanded) { setOpen(true); return }
          const index = active >= 0 && visible[active] && !visible[active].disabled ? active : nextComboboxOption(visible, -1, 1)
          if (index >= 0 && visible[index]) choose(visible[index])
          else if (allowCustom) close()
        } else if (event.key === 'Escape') {
          if (!expanded && query === null) return
          event.preventDefault(); event.stopPropagation()
          if (allowCustom && value !== focusValue.current) onChange(focusValue.current)
          close()
        }
      }}
    />
    <svg aria-hidden="true" className={styles.arrow} viewBox="0 0 16 16" fill="none">
      <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    {expanded && createPortal(<div ref={popupRef} id={listId} popover="manual" role="listbox" aria-label={props['aria-label'] ?? t('shell.candidates')} data-combobox-owner={inputId} className={styles.popup} style={position} onMouseDown={event => event.preventDefault()}>
      {visible.map((option, index) => <div key={option.value} id={`${listId}-${index}`} role="option" aria-selected={option.value === value} aria-disabled={option.disabled || undefined} className={`${styles.option}${active === index ? ` ${styles.active}` : ''}`} onPointerMove={() => { if (!option.disabled) setActive(index) }} onClick={event => { event.preventDefault(); event.stopPropagation(); choose(option) }}>
        <span>{option.label}</span><span className={styles.selectedMark} aria-hidden="true">{option.value === value && <Icon name="check" size={14} />}</span>
      </div>)}
      {!visible.length && <div className={styles.empty} role="status">{allowCustom ? t('shell.customValue') : t('shell.noMatch')}</div>}
    </div>, portalHost ?? document.body)}
  </span>
}
