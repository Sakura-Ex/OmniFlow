import type { Resource } from '@/common/types/resource'
import type { UnitSystem } from '@/common/units/UnitSystem'
import { defaultResourceUnit } from '@/common/units/defaults'

/**
 * GT capacity algorithms consume EU/tick regardless of port input/display prefixes.
 * @returns Compatible GT energy consumption expressed in EU per tick.
 * @param resources - Utility ports before rate normalization.
 * @param duration - Finite positive cycle duration in seconds.
 * @param units - Explicit unit system for the captured environment.
 */
export function gtEuPerTick(resources: readonly Readonly<Resource>[], duration: number, units: UnitSystem): number {
  const port = resources.find((r) => r.utility_type === 'energy:gt_eu')
  if (!port) return 0
  return units.rateQuantity(port.amount, port.unit ?? defaultResourceUnit(port.category, port.id), port.time_base ?? 'rate_per_tick', duration)
    .to(units.unit('EU').divide(units.unit('tick'))).value
}
