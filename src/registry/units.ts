import type { TimeBase } from '../types/types'

export function buildUnitSuffix(base_unit: string, time_base?: TimeBase): string {
  switch (time_base) {
    case 'rate_per_tick': return `${base_unit}/t`
    case 'rate_per_sec':  return `${base_unit}/s`
    default:             return base_unit
  }
}
