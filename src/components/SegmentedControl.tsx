import './SegmentedControl.css'

type SegmentedOption = {
  value: string
  label: string
}

type SegmentedControlProps = {
  value: string
  options: SegmentedOption[]
  onChange: (value: string) => void
  className?: string
}

export function SegmentedControl({ value, options, onChange, className }: SegmentedControlProps) {
  return (
    <div className={`segmented-control${className ? ` ${className}` : ''}`} role="tablist" aria-label="Node mode selector">
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className={`segmented-control__item${isActive ? ' is-active' : ''}`}
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
