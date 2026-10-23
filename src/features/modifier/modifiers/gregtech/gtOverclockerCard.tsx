import { useTranslation } from '@/common/i18n'
import type { ModifierCardRenderProps } from '../../modifier.ui.types'

/**
 * Card body for the GT Overclocker modifier.
 * Renders a "Perfect Overclock" toggle switch.
 *
 * @param root0 - Render props from the card shell.
 * @param root0.state - Current modifier UI state.
 * @param root0.onChange - Callback to update a state key.
 * @param root0.Toggle - Toggle UI component from the card shell.
 * @returns Rendered JSX for the overclocker card body.
 */
export function OverclockerCardBody({ state, onChange, Toggle }: ModifierCardRenderProps) {
  const { t } = useTranslation()
  return (
    <>
      <Toggle
        label={t('editor.perfectOverclock')}
        checked={Boolean(state.perfectOverclock)}
        onChange={(v) => onChange('perfectOverclock', v)}
      />
    </>
  )
}
