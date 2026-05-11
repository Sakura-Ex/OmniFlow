import type { ReactNode, FC } from 'react'
import type { IMachineModifier, ModifierCardRenderProps } from '../modifiers/types'
import type { Resource } from '../types/types'

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

const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <label className="recipe-settings__control">
    <span>{label}</span>
    {children}
  </label>
)

const Toggle: ModifierCardRenderProps['Toggle'] = ({ label, checked, onChange }) => (
  <label className="recipe-settings__control recipe-settings__control--inline">
    <span>{label}</span>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
  </label>
)

const Select: ModifierCardRenderProps['Select'] = ({ label, value, options, onChange }) => (
  <label className="recipe-settings__control">
    <span>{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  </label>
)

const Slider: ModifierCardRenderProps['Slider'] = ({ label, value, min, max, onChange }) => (
  <label className="recipe-settings__control">
    <span>{label}</span>
    <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </label>
)

const Input: ModifierCardRenderProps['Input'] = ({ label, value, onChange, min, max, step }) => (
  <label className="recipe-settings__control">
    <span>{label}</span>
    <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </label>
)

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

  if (modifier.renderBody) {
    return (
      <div className="recipe-settings__modifier-card">
        <div className="recipe-settings__modifier-card-header">
          <h6>{modifier.name}</h6>
          {!readOnly && (
            <button
              className={`recipe-editor__icon-action${isFixedModifier ? '' : ' recipe-editor__icon-action--danger'}`}
              type="button"
              onClick={onRemove}
              title={isFixedModifier ? '范式固定修饰器，不可卸载' : '卸载修饰器'}
              aria-label={isFixedModifier ? '范式固定修饰器，不可卸载' : '卸载修饰器'}
              disabled={isFixedModifier}
            >
              {isFixedModifier ? '🔒' : '🗑️'}
            </button>
          )}
        </div>
        {modifier.renderBody(renderProps)}
      </div>
    )
  }

  return (
    <div className="recipe-settings__modifier-card">
      <div className="recipe-settings__modifier-card-header">
        <h6>{modifier.name}</h6>
        {!readOnly && (
          <button
            className={`recipe-editor__icon-action${isFixedModifier ? '' : ' recipe-editor__icon-action--danger'}`}
            type="button"
            onClick={onRemove}
            title={isFixedModifier ? '范式固定修饰器，不可卸载' : '卸载修饰器'}
            aria-label={isFixedModifier ? '范式固定修饰器，不可卸载' : '卸载修饰器'}
            disabled={isFixedModifier}
          >
            {isFixedModifier ? '🔒' : '🗑️'}
          </button>
        )}
      </div>
      {modifier.ui_schema.map((control) => {
        const currentValue = state[control.key]
        if (control.type === 'toggle') {
          return <Toggle key={control.key} label={control.label} checked={Boolean(currentValue)} onChange={(v) => { if (!readOnly) onChange(control.key, v) }} />
        }
        if (control.type === 'select') {
          const options = control.options ?? []
          if (readOnly) {
            return <Field key={control.key} label={control.label}><span style={{ color: 'var(--text-strong)', fontFamily: 'var(--mono)', fontSize: 12 }}>{String(currentValue ?? '')}</span></Field>
          }
          return <Select key={control.key} label={control.label} value={String(currentValue ?? '')} options={options} onChange={(v) => onChange(control.key, v)} />
        }
        if (control.type === 'slider') {
          if (readOnly) {
            return <Field key={control.key} label={control.label}><span style={{ color: 'var(--text-strong)', fontFamily: 'var(--mono)', fontSize: 12 }}>{Number(currentValue ?? 0)}</span></Field>
          }
          return <Slider key={control.key} label={control.label} value={Number(currentValue ?? 0)} min={(control.min as number) ?? 0} max={(control.max as number) ?? 8} onChange={(v) => { if (!readOnly) onChange(control.key, v) }} />
        }
        if (readOnly) {
          return <Field key={control.key} label={control.label}><span style={{ color: 'var(--text-strong)', fontFamily: 'var(--mono)', fontSize: 12 }}>{Number(currentValue ?? 0)}</span></Field>
        }
        return <Input key={control.key} label={control.label} value={Number(currentValue ?? 0)} min={control.min as number | undefined} max={control.max as number | undefined} step={control.step as number | undefined} onChange={(v) => onChange(control.key, v)} />
      })}
    </div>
  )
}
