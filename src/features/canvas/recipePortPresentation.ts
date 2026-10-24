import type { NormalizedResource, ComputedNodePayload } from '@/common/types/resource'
import type { ResourceCategoryDef } from '@/common/types/registry'
import { UnitSystem } from '@/common/units/UnitSystem'
import { defaultResourceUnit } from '@/common/units/defaults'
import { formatPortAmount } from '@/common/utils/rateFormat'
import type { NetworkPortConfiguration } from '@/common/schemas/network.schema'
import { buildUnitSuffix } from '@/features/resource-registry/registry.units'
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
 * @param semantics - Explicit quantity meaning; omitted ports are conserved flows.
 * @returns Independent amount and rate labels for a recipe port.
 */
export function recipePortPresentation(port: NormalizedResource, payload: ComputedNodePayload, actual: number | undefined, units: UnitSystem, category: ResourceCategoryDef, semantics: NetworkPortConfiguration['semantics'] = { kind: 'flow' }) {
  const expression = port.displayUnit ?? port.unit ?? defaultResourceUnit(port.category, port.id)
  const formatQuantity = (value: number) => `${formatOpExRate(value / units.registry.normalize(expression).scale)} ${units.expression(expression).toString()}`
  const occupancy = payload.bom_occupancy.find(entry => portIdentity(entry.resource) === portIdentity(port))
  const coefficient = semantics.kind === 'flow'
    ? `${formatPortAmount(port.amount, category, port.time_base, payload.duration_seconds, units, expression)}${port.time_base !== 'per_cycle' && !units.isNativeRate(expression) ? (port.time_base === 'rate_per_tick' ? '/t' : '/s') : ''}`
    : formatQuantity(port.amount)
  let amount = semantics.kind === 'state' ? t('recipeDisplay.state', { value: formatQuantity(semantics.actual) }) : `${t('canvas.perMachine')} ${coefficient}`
  if (occupancy && semantics.kind !== 'state') {
    const original = occupancy.resource.unit ?? defaultResourceUnit(port.category, port.id)
    const quantity = occupancy.amount * units.expression(original).conversionScale(units.expression(expression))
    amount = `${occupancy.resource.occupancy_basis === 'global' ? t('canvas.globalOccupancy') : t('canvas.machineOccupancy')} ${formatOpExRate(quantity)} ${units.expression(expression).toString()}`
  }
  const rateUnit = semantics.kind === 'flow' ? buildUnitSuffix(expression, 'rate_per_sec', units) : units.expression(expression).toString()
  const rateNumber = actual === undefined || !Number.isFinite(actual) ? '—'
    : semantics.kind === 'flow'
      ? formatOpExRate(units.fromRate(actual, expression, 'rate_per_sec'))
      : formatOpExRate(actual / units.registry.normalize(expression).scale)
  const rateValue = rateNumber === '—' ? '—' : `${rateNumber} ${rateUnit}`
  const rate = `${t('canvas.actualPrefix')} ${rateValue}`
  return { amount, rate, rateValue, rateNumber, rateUnit, formatQuantity }
}
