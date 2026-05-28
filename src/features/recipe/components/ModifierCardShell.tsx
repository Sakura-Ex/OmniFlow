import type { ReactNode, FC } from 'react'
import type { IMachineModifier, ModifierCardRenderProps } from '@/features/modifier/modifier.types'
import type { Resource } from '@/common/types/resource'
import styles from './ModifierCardShell.module.css'

/** Props for the `ModifierCardShell` component. */
interface ModifierCardShellProps {
  modifier: IMachineModifier
  state: Record<string, unknown>
  isFixedModifier: boolean
  onRemove: () => void
  onChange: (key: string, value: unknown) => void
  readOnly?: boolean
  recipeInputs?: Resource[]
  recipeOutputs?: Resource[]
  hardwareSpecs?: Record<string, unknown>
}

/**
 * Field wrapper component that renders a labelled control row.
 * @param root0 - Component props.
 * @param root0.label - The label text.
 * @param root0.children - The control element(s).
 * @returns Rendered JSX for a labelled field.
 */
const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <label className={styles.control}>
    <span>{label}</span>
    {children}
  </label>
)

const Toggle: ModifierCardRenderProps['Toggle'] = ({ label, checked, onChange }) => (
  <label className={`${styles.control} ${styles.controlInline}`}>
    <span>{label}</span>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
  </label>
)

const Select: ModifierCardRenderProps['Select'] = ({ label, value, options, onChange }) => (
  <label className={styles.control}>
    <span>{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  </label>
)

const Slider: ModifierCardRenderProps['Slider'] = ({ label, value, min, max, onChange }) => (
  <label className={styles.control}>
    <span>{label}</span>
    <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </label>
)

const Input: ModifierCardRenderProps['Input'] = ({ label, value, onChange, min, max, step }) => (
  <label className={styles.control}>
    <span>{label}</span>
    <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </label>
)

/**
 * Shell component that renders a modifier card with its UI elements.
 * Delegates body rendering to the modifier's `renderBody` or auto-generates
 * controls from its `ui_schema`.
 *
 * @param root0 - Component props.
 * @param root0.modifier - The modifier definition.
 * @param root0.state - Current modifier UI state.
 * @param root0.isFixedModifier - Whether the modifier is fixed and cannot be removed.
 * @param root0.onRemove - Callback to remove this modifier instance.
 * @param root0.onChange - Callback to update a state key.
 * @param root0.readOnly - Whether the card is in read-only mode.
 * @param root0.recipeInputs - Recipe input resources for context.
 * @param root0.recipeOutputs - Recipe output resources for context.
 * @param root0.hardwareSpecs - Hardware specifications from the archetype.
 * @returns Rendered JSX for the modifier card shell.
 */
export function ModifierCardShell({
  modifier,
  state,
  isFixedModifier,
  onRemove,
  onChange,
  readOnly,
  recipeInputs,
  recipeOutputs,
  hardwareSpecs,
}: ModifierCardShellProps) {
  const renderProps: ModifierCardRenderProps = { state, onChange, readOnly, Field, Toggle, Select, Slider, Input, recipeInputs, recipeOutputs, hardwareSpecs }
  const removeTitle = isFixedModifier ? '默认修饰器不可移除' : '移除此修饰器'

  const removeButton = !readOnly && (
    <button
      className={`${styles.iconAction}${isFixedModifier ? '' : ` ${styles.iconActionDanger}`}`}
      type="button"
      onClick={onRemove}
      title={removeTitle}
      aria-label={removeTitle}
      disabled={isFixedModifier}
    >
      {isFixedModifier ? '🔒' : '✕'}
    </button>
  )

  if (modifier.renderBody) {
    return (
      <div className={styles.modifierCard}>
        <div className={styles.modifierCardHeader}>
          <h6>{modifier.name}</h6>
          {removeButton}
        </div>
        {modifier.renderBody(renderProps)}
      </div>
    )
  }

  return (
    <div className={styles.modifierCard}>
      <div className={styles.modifierCardHeader}>
        <h6>{modifier.name}</h6>
        {removeButton}
      </div>
      {modifier.ui_schema.map((control) => {
        const currentValue = state[control.key]
        if (control.type === 'toggle') {
          return <Toggle key={control.key} label={control.label} checked={Boolean(currentValue)} onChange={(v) => { if (!readOnly) onChange(control.key, v) }} />
        }
        if (control.type === 'select') {
          const options = control.options ?? []
          if (readOnly) {
            return <Field key={control.key} label={control.label}><span className={styles.readOnlyValue}>{String(currentValue ?? '')}</span></Field>
          }
          return <Select key={control.key} label={control.label} value={String(currentValue ?? '')} options={options} onChange={(v) => onChange(control.key, v)} />
        }
        if (control.type === 'slider') {
          if (readOnly) {
            return <Field key={control.key} label={control.label}><span className={styles.readOnlyValue}>{Number(currentValue ?? 0)}</span></Field>
          }
          return <Slider key={control.key} label={control.label} value={Number(currentValue ?? 0)} min={(control.min as number) ?? 0} max={(control.max as number) ?? 8} onChange={(v) => { if (!readOnly) onChange(control.key, v) }} />
        }
        if (readOnly) {
          return <Field key={control.key} label={control.label}><span className={styles.readOnlyValue}>{Number(currentValue ?? 0)}</span></Field>
        }
        return <Input key={control.key} label={control.label} value={Number(currentValue ?? 0)} min={control.min as number | undefined} max={control.max as number | undefined} step={control.step as number | undefined} onChange={(v) => onChange(control.key, v)} />
      })}
    </div>
  )
}
