import type { ModifierCardRenderProps } from '../../modifier.types'

/**
 * Card body for the GT Parallel modifier.
 * Renders a select dropdown for the parallel processing limit.
 *
 * @param root0 - Render props from the card shell.
 * @param root0.state - Current modifier UI state.
 * @param root0.onChange - Callback to update a state key.
 * @param root0.Select - Select UI component from the card shell.
 * @returns Rendered JSX for the parallel card body.
 */
export function ParallelCardBody({ state, onChange, Select }: ModifierCardRenderProps) {
  return (
    <>
      <Select
        label="并行上限"
        value={String(state.parallelLimit ?? 4)}
        options={['1', '4', '16', '64', '256', '1024', '4096', '16384', '65536', '262144', '1048576']}
        onChange={(v) => onChange('parallelLimit', v)}
      />
    </>
  )
}
