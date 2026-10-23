import type { ReactNode, FC } from 'react'
import type { Resource } from '@/common/types/resource'

/** Props passed to a modifier's custom card render-body component. */
export interface ModifierCardRenderProps {
  /** Current UI state values keyed by control key. */
  state: Record<string, unknown>
  /** Callback invoked when a UI control value changes. */
  onChange: (key: string, value: unknown) => void
  /** Whether the card is rendered in read-only (non-editable) mode. */
  readOnly?: boolean
  /** Injected Field layout wrapper component. */
  Field: FC<{ label: string; children: ReactNode }>
  /** Injected Toggle switch control component. */
  Toggle: FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }>
  /** Injected Select dropdown control component. */
  Select: FC<{ label: string; value: string; options: string[]; onChange: (v: string) => void }>
  /** Injected Slider control component. */
  Slider: FC<{ label: string; value: number; min: number; max: number; onChange: (v: number) => void }>
  /** Injected Number input control component. */
  Input: FC<{ label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }>
  /** Recipe inputs available for context-aware UI rendering. */
  recipeInputs?: Resource[]
  /** Recipe outputs available for context-aware UI rendering. */
  recipeOutputs?: Resource[]
  /** Machine hardware specifications for context-aware UI rendering. */
  hardwareSpecs?: Record<string, unknown>
}

/** Custom presentation for a modifier definition. */
export interface ModifierUI {
  renderBody: FC<ModifierCardRenderProps>
}
