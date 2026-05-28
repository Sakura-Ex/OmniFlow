/**
 * Build the full calculation payload from canvas nodes, edges and recipe store.
 * @see {@link import('./payloadBuilder').buildCalculationPayload}
 */
export { buildCalculationPayload } from './payloadBuilder'

/**
 * Compute the capital expenditure list from recipe data and backend results.
 * @see {@link import('./capEx').computeCapexList}
 */
export { computeCapexList } from './capEx'

/**
 * Auto-create source/target nodes and edges for unconnected recipe ports.
 * @see {@link import('./autoFillEndpoints').computeAutoFillEndpoints}
 */
export { computeAutoFillEndpoints } from './autoFillEndpoints'

/**
 * Build topological nets (union-find) that assign unique net names to
 * connected port groups, plus the reverse net-to-ports mapping.
 * @see {@link import('./topology').buildTopologicalNets}
 */
export {
  buildTopologicalNets,
  type TopologicalNets,
  type NetLookupTable,
} from './topology'
