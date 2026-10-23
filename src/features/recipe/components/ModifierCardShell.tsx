import { modifierNameKeys, modifierControlKeys } from '@/common/i18n/editorMessages'
import { useTranslation } from '@/common/i18n'
import { Icon } from '@/common/components/Icon'
import type { ReactNode, FC } from 'react'
import type { IMachineModifier } from '@/features/modifier/modifier.types'
import type { ModifierCardRenderProps } from '@/features/modifier/modifier.ui.types'
import { modifierUIRegistry } from '@/features/modifier/modifier.ui.registry'
import type { Resource } from '@/common/types/resource'
import styles from './ModifierCardShell.module.css'
import { Combobox } from '@/common/components/Combobox'

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
    <Combobox value={value} onChange={onChange} aria-label={label} options={options.map(option => ({ value: option, label: option }))} />
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
 * Delegates body rendering to the registered custom renderer or auto-generates
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
  const { t } = useTranslation()
  const modifierNameKey = modifierNameKeys[modifier.id]
  const modifierName = modifierNameKey ? t(modifierNameKey) : modifier.name
  const renderProps: ModifierCardRenderProps = { state, onChange, readOnly, Field, Toggle, Select, Slider, Input, recipeInputs, recipeOutputs, hardwareSpecs }
  const removeTitle = isFixedModifier ? t('editor.fixedModifier') : t('editor.removeModifier')

  const removeButton = !readOnly && (
    <button
      className={`${styles.iconAction}${isFixedModifier ? '' : ` ${styles.iconActionDanger}`}`}
      type="button"
      onClick={onRemove}
      title={removeTitle}
      aria-label={removeTitle}
      disabled={isFixedModifier}
    >
      <Icon name={isFixedModifier ? 'lock' : 'close'} />
    </button>
  )

  const RenderBody = modifierUIRegistry[modifier.id]?.renderBody
  if (RenderBody) {
    return (
      <div className={styles.modifierCard}>
        <div className={styles.modifierCardHeader}>
          <h6>{modifierName}</h6>
          {removeButton}
        </div>
        <RenderBody {...renderProps} />
      </div>
    )
  }

  return (
    <div className={styles.modifierCard}>
      <div className={styles.modifierCardHeader}>
        <h6>{modifierName}</h6>
        {removeButton}
      </div>
      {modifier.ui_schema.map((control) => {
        const currentValue = state[control.key]
        const labelKey = modifierControlKeys[`${modifier.id}.${control.key}`]
        const label = labelKey ? t(labelKey) : control.label
        if (control.type === 'toggle') {
          return <Toggle key={control.key} label={label} checked={Boolean(currentValue)} onChange={(v) => { if (!readOnly) onChange(control.key, v) }} />
        }
        if (control.type === 'select') {
          const options = control.options ?? []
          if (readOnly) {
            return <Field key={control.key} label={label}><span className={styles.readOnlyValue}>{String(currentValue ?? '')}</span></Field>
          }
          return <Select key={control.key} label={label} value={String(currentValue ?? '')} options={options} onChange={(v) => onChange(control.key, v)} />
        }
        if (control.type === 'slider') {
          if (readOnly) {
            return <Field key={control.key} label={label}><span className={styles.readOnlyValue}>{Number(currentValue ?? 0)}</span></Field>
          }
          return <Slider key={control.key} label={label} value={Number(currentValue ?? 0)} min={(control.min as number) ?? 0} max={(control.max as number) ?? 8} onChange={(v) => { if (!readOnly) onChange(control.key, v) }} />
        }
        if (readOnly) {
          return <Field key={control.key} label={label}><span className={styles.readOnlyValue}>{Number(currentValue ?? 0)}</span></Field>
        }
        return <Input key={control.key} label={label} value={Number(currentValue ?? 0)} min={control.min as number | undefined} max={control.max as number | undefined} step={control.step as number | undefined} onChange={(v) => onChange(control.key, v)} />
      })}
    </div>
  )
}
