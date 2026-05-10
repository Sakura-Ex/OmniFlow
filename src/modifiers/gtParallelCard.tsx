import type { ModifierCardRenderProps } from './types'

export function ParallelCardBody({ state, onChange, Select }: ModifierCardRenderProps) {
  return (
    <>
      <Select
        label="并行控制仓上限"
        value={String(state.parallelLimit ?? 4)}
        options={['1', '4', '16', '64', '256', '1024', '4096', '16384', '65536', '262144', '1048576']}
        onChange={(v) => onChange('parallelLimit', v)}
      />
    </>
  )
}
