import type { NormalizedResource, ComputedNodePayload } from '@/common/types/resource'
import type { ResourceCategoryDef } from '@/common/types/registry'
import { UnitSystem } from '@/common/units/UnitSystem'
import { defaultResourceUnit } from '@/common/units/defaults'
import { formatPortAmount, formatRateValue } from '@/common/utils/rateFormat'
import { formatOpExRate } from '@/common/utils/format'
import { portIdentity } from '@/common/utils/ports'
import { t } from '@/common/i18n'

/**
 * Separate verified gross flow, per-machine coefficients and inventory occupancy.
 * @param port - Final independent recipe port.
 * @param payload - Final modifier evidence including zero-loss occupancy.
 * @param actual - Verified canonical gross throughput, or undefined before solving.
 * @param units - Captured quantity environment.
 * @param category - Display category and fallback unit.
 * @returns Independent amount and rate labels for a recipe port.
 */
export function recipePortPresentation(port: NormalizedResource, payload: ComputedNodePayload, actual: number | undefined, units: UnitSystem, category: ResourceCategoryDef) {
  const expression = port.displayUnit ?? port.unit ?? defaultResourceUnit(port.category, port.id)
  const occupancy = payload.bom_occupancy.find(entry => portIdentity(entry.resource) === portIdentity(port))
  let amount = `${t('canvas.perMachine')} ${formatPortAmount(port.amount, category, port.time_base, payload.duration_seconds, units, expression)}`
  if (occupancy) {
    const original = occupancy.resource.unit ?? defaultResourceUnit(port.category, port.id)
    const quantity = occupancy.amount * units.expression(original).conversionScale(units.expression(expression))
    amount = `${occupancy.resource.occupancy_basis === 'global' ? t('canvas.globalOccupancy') : t('canvas.machineOccupancy')} ${formatOpExRate(quantity)} ${units.expression(expression).toString()}`
  }
  const rateValue = actual === undefined
    ? formatRateValue(port.amount, port.time_base, units, expression)
    : `${formatPortAmount(actual, category, 'rate_per_sec', 1, units, expression)}${units.isNativeRate(expression) ? '' : '/s'}`
  const rate = `${actual === undefined ? t('canvas.perMachine') : t('canvas.actualPrefix')} ${rateValue}`
  return { amount, rate, rateValue }
}
