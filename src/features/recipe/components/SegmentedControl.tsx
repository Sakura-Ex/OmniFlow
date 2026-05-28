import styles from './SegmentedControl.module.css'

/** A single option in the segmented control. */
type SegmentedOption = {
  value: string
  label: string
}

/** Props for the `SegmentedControl` component. */
type SegmentedControlProps = {
  value: string
  options: SegmentedOption[]
  onChange: (value: string) => void
  className?: string
}

/**
 * A tab-like segmented control for selecting between options.
 *
 * @param root0 - Component props.
 * @param root0.value - The currently selected value.
 * @param root0.options - Array of selectable options.
 * @param root0.onChange - Callback fired with the new value on selection.
 * @param root0.className - Optional additional CSS class name.
 * @returns Rendered JSX element for the segmented control.
 */
export function SegmentedControl({ value, options, onChange, className }: SegmentedControlProps) {
  return (
    <div className={`${styles['segmented-control']}${className ? ` ${className}` : ''}`} role="tablist" aria-label="Node mode selector">
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className={`${styles['segmented-control__item']}${isActive ? ` ${styles['segmented-control__item--active']}` : ''}`}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
