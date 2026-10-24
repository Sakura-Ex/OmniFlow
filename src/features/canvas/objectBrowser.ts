import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import type { UnitSnapshot } from '@/common/types/units'
import type { CalculateResponse } from '@/common/types/api'
import type { DiagnosticReport } from '@/features/calculation/diagnostics'
import { connectionIssue, graphPorts, type GraphPort } from '@/features/calculation/graphPorts'
import { buildResourceId, parseNormalizedKey } from '@/common/utils/resourceId'

/** Flat presentation of a real canvas object, independent of selection and layout. */
export interface BrowserObject {
  id: string
  type: 'recipeNode' | 'sourceNode' | 'targetNode' | 'splitterNode' | 'otherNode'
  name: string
  resourceIds: string[]
  searchText: string
  hasIssue: boolean
}

/** Authoritative inputs needed to browse objects and attach located issue evidence. */
interface BrowserInput {
  nodes: Node[]
  edges: Edge[]
  recipes: Record<string, RecipeNodeData>
  environment: UnitSnapshot
  entries: Record<string, { displayName?: string }>
  issues: NonNullable<CalculateResponse['errors']>
  diagnostics?: DiagnosticReport
}

/** Retain searchable resource identities even when a malformed recipe cannot be evaluated.
 * @param value - An explicit resource-like value from a supported node.
 * @returns Its resource key, when declared.
 */
function resourceKey(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  const resource = value as Record<string, unknown>
  return typeof resource.category === 'string' && typeof resource.id === 'string'
    ? [buildResourceId(resource.category, resource.id)] : []
}

/** Derive searchable objects without changing the graph or treating limits as failures.
 * @param input - Current authoritative graph, definitions and explicit issue evidence.
 * @returns One row per real node, in document order.
 */
export function deriveBrowserObjects(input: BrowserInput): BrowserObject[] {
  const issueIds = new Set<string>()
  for (const issue of input.issues) {
    if (issue.node_id) issueIds.add(issue.node_id)
    for (const part of issue.path) {
      if (typeof part !== 'string') continue
      try {
        const address: unknown = JSON.parse(part)
        if (Array.isArray(address) && typeof address[0] === 'string') issueIds.add(address[0])
      } catch { /* Plain path components are not node identities. */ }
    }
  }
  if (input.diagnostics && input.diagnostics.status !== 'stale') {
    input.diagnostics.issues.forEach(issue => issue.nodeIds.forEach(id => issueIds.add(id)))
  }
  const allPorts: GraphPort[] = []
  const rows = input.nodes.map((node): BrowserObject => {
    const type = node.type === 'recipeNode' || node.type === 'sourceNode' || node.type === 'targetNode' || node.type === 'splitterNode' ? node.type : 'otherNode'
    const recipe = input.recipes[node.id]
    const data = node.data as Record<string, unknown>
    const explicitName = type === 'recipeNode' && recipe?.machine_name ? recipe.machine_name : typeof data.label === 'string' ? data.label : ''
    const explicit = type === 'recipeNode' && recipe
      ? [recipe.inputs, recipe.outputs, recipe.base_inputs, recipe.base_outputs].flatMap(ports => (ports ?? []).flatMap(resourceKey))
      : type === 'splitterNode' ? resourceKey(data.input) : Array.isArray(data.ports) ? data.ports.flatMap(resourceKey) : []
    let final: string[] = []
    try {
      const ports = graphPorts([node], input.recipes, input.environment)
      allPorts.push(...ports)
      final = ports.map(port => port.resourceId)
    } catch {
      issueIds.add(node.id)
    }
    const resourceIds = [...new Set([...explicit, ...final])]
    const name = explicitName || resourceIds.map(id => input.entries[id]?.displayName || parseNormalizedKey(id).id).join(' · ')
    return { id: node.id, type, name, resourceIds, hasIssue: false,
      searchText: [node.id, name, recipe?.recipe_id ?? '', ...resourceIds, ...resourceIds.map(id => input.entries[id]?.displayName ?? '')].join('\n').toLocaleLowerCase() }
  })
  const portIndex = new Map(allPorts.map(port => [JSON.stringify([port.nodeId, port.portId]), port]))
  for (const edge of input.edges) {
    if (connectionIssue(edge, allPorts, portIndex)) {
      issueIds.add(edge.source)
      issueIds.add(edge.target)
    }
  }
  return rows.map(row => ({ ...row, hasIssue: issueIds.has(row.id) }))
}

/** Match all query terms without removing objects from the graph or changing selection.
 * @param objects - Derived rows in document order.
 * @param query - User-entered name, identity or resource terms.
 * @returns Matching presentation rows only.
 */
export function filterBrowserObjects(objects: BrowserObject[], query: string): BrowserObject[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return terms.length ? objects.filter(object => terms.every(term => object.searchText.includes(term))) : objects
}
