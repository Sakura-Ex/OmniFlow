import type { ModifierCardRenderProps } from '../../modifier.types'

export function OverclockerCardBody({ state, onChange, Toggle }: ModifierCardRenderProps) {
  return (
    <>
      <Toggle
        label="完美超频"
        checked={Boolean(state.perfectOverclock)}
        onChange={(v) => onChange('perfectOverclock', v)}
      />
    </>
  )
}
