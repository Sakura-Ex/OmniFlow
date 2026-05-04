import type { MeasureMode } from '../types/types'

export function buildUnitSuffix(base_unit: string, measure_mode?: MeasureMode): string {
  switch (measure_mode) {
    case 'rate_per_tick': return `${base_unit}/t`
    case 'rate_per_sec':  return `${base_unit}/s`
    default:             return base_unit
  }
}
