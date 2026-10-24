import { portIdentity } from '@/common/utils/ports'
import { groupPortsByCategory } from './groupPortsByCategory'

/** Only resource attributes that can change category headers or handle placement. */
interface ResourceLayoutPort {
  portId?: string
  category: string
  utility_type?: string
  routing_mode?: string
}

/** Describe resource geometry independently of quantities, translations and display density.
 * @param groups - Distinct input/output and utility regions, including empty regions.
 * @returns Stable key that changes when port order, category headers or routing change.
 */
export function resourceGeometrySignature(groups: readonly (readonly ResourceLayoutPort[])[]): string {
  return JSON.stringify(groups.map(ports => groupPortsByCategory(ports).map(port => [portIdentity(port), port.utility_type ?? port.category, port.routing_mode ?? 'wired'])))
}

/** Track draft branch rows separately from the handles that are actually connectable.
 * @param inputId - Current input handle identity.
 * @param shownOutputIds - Visible draft rows, in order.
 * @param committedOutputIds - Persisted branches whose handles may be rendered.
 * @returns Stable key including the draft-to-committed handle transition.
 */
export function splitterGeometrySignature(inputId: string, shownOutputIds: readonly string[], committedOutputIds: readonly string[]): string {
  const committed = new Set(committedOutputIds)
  return JSON.stringify([inputId, shownOutputIds.map(id => [id, committed.has(id)])])
}
