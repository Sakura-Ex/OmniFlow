import { UnitSystem, finite } from '@/common/units/UnitSystem'
import { DEFAULT_UNIT_SNAPSHOT, defaultResourceUnit } from '@/common/units/defaults'
import type { UnitSnapshot } from '@/common/types/units'
import type { ComputedNodePayload } from '@/common/types/resource'
import type { CalculateResponse } from '@/common/types/api'
import { buildResourceId } from '@/common/utils/resourceId'

/**
 * Aggregate final-condition occupancy for the selected installation plan.
 * @param recipes - Final compiled recipe evidence, without recomputing modifiers.
 * @param nodeResults - Recipe installation recommendations and fixed plans.
 * @param environment - Captured unit environment.
 * @returns Canonical occupancy quantities, including global requirements only once.
 */
export function computeCapexList(recipes: Record<string, ComputedNodePayload>, nodeResults: CalculateResponse['node_results'], environment: UnitSnapshot = DEFAULT_UNIT_SNAPSHOT): Record<string, number> {
  const capex: Record<string, number> = {}, global: Record<string, number> = {}
  const dimensions = new Map<string, string>()
  const units = new UnitSystem(environment)
  for (const [nodeId, payload] of Object.entries(recipes)) {
    const machines = nodeResults?.[nodeId]?.planned_installed
    if (machines === undefined || !Number.isSafeInteger(machines) || machines < 0) throw new Error(`Missing or invalid planned_installed for recipe node ${nodeId}`)
    if (machines === 0) continue
    for (const entry of payload.bom_occupancy) {
      const resource = entry.resource
      if (!resource.id) continue
      const key = buildResourceId(resource.category, resource.id)
      const normalized = units.registry.normalize(resource.unit ?? defaultResourceUnit(resource.category, resource.id))
      const signature = JSON.stringify(normalized.dimensions)
      if (dimensions.has(key) && dimensions.get(key) !== signature) throw new Error('Incompatible occupancy units for ' + key)
      dimensions.set(key, signature)
      const amount = finite(entry.amount * normalized.scale)
      if (resource.occupancy_basis === 'global') global[key] = Math.max(global[key] ?? 0, amount)
      else capex[key] = finite((capex[key] ?? 0) + amount * machines)
    }
  }
  for (const [key, amount] of Object.entries(global)) capex[key] = finite((capex[key] ?? 0) + amount)
  return capex
}
