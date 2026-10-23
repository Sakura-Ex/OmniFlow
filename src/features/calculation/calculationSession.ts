import type { Node, Edge } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'

/**
 * Stable model snapshot excludes presentation fields and construction bookkeeping.
 * @param nodes - Canvas nodes.
 * @param edges - Canvas connections.
 * @param recipes - Authoritative recipes.
 * @param configuration - Explicit network assumptions.
 * @param environment - Unit snapshot.
 * @returns Identity key for edit detection.
 */
export function calculationDocumentKey(nodes: Node[], edges: Edge[], recipes: Record<string, RecipeNodeData>, configuration: unknown, environment: unknown): string {
  const calculationRecipes = Object.fromEntries(Object.entries(recipes).map(([id, recipe]) => {
    const { is_implemented, ...inputs } = recipe
    void is_implemented
    return [id, inputs]
  }))
  const transient = new Set(['machines_exact', 'machines_actual', 'operating_equivalent', 'recommended_installed', 'fixed_installed', 'planned_installed', 'existing_installed', 'additional_installed', 'port_throughputs', 'utilization', 'actual_amounts', '_computed', 'selected', 'dragging', 'width', 'height', 'positionAbsolute', 'displayUnit'])
  return JSON.stringify([nodes.map(node => ({ id: node.id, type: node.type, data: node.type === 'recipeNode' ? undefined : node.data })), edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle })), calculationRecipes, configuration, environment], (key, value) => transient.has(key) ? undefined : value)
}

/** One in-flight request; editing and subsequent runs invalidate its acceptance token. */
export class CalculationSession {
  private generation = 0
  private controller?: AbortController
  private cancelQueued?: () => void
  /** Cancel obsolete transport and queued work. */
  invalidate() { this.generation++; this.controller?.abort(); this.cancelQueued?.(); this.cancelQueued = undefined }
  /** Start a fresh acceptance token.
   * @param cancelQueued - Cancel the current queued request when superseded.
   * @returns Abort signal and revision acceptance predicate.
   */
  begin(cancelQueued?: () => void) {
    this.invalidate()
    this.cancelQueued = cancelQueued
    const generation = this.generation
    this.controller = new AbortController()
    return { signal: this.controller.signal, isCurrent: () => generation === this.generation && !this.controller?.signal.aborted }
  }
}
