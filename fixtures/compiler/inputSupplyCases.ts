import type { NetworkCompileInput } from '@/features/calculation/networkCompiler'
import { compileNetwork } from '@/features/calculation/networkCompiler'
import { portKey } from '@/features/calculation/topology'

/**
 * Replace a visible source wire with one explicit recipe-input supply assumption.
 * @param base - Shared complete graph factory.
 * @param capacity - Canonical external supply limit, or null for sufficient supply.
 * @returns Graph with no source node or supply wire and one explicit boundary.
 */
export function recipeInputSupply(base: () => NetworkCompileInput, capacity: number | null): NetworkCompileInput {
  const input = base()
  input.nodes = input.nodes.filter(node => node.id !== 's')
  input.edges = input.edges.filter(edge => edge.source !== 's')
  delete input.configuration!.ports[portKey('s', 's')]
  input.configuration!.ports[portKey('r', 'in')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: { kind: 'source', capacity } }
  return input
}

/**
 * Produce real LP regressions for explicit supply without automatic graph completion.
 * @param base - Shared complete graph factory.
 * @returns Conserved requests demonstrating unlimited supply, limits and isolation.
 */
export function inputSupplyCases(base: () => NetworkCompileInput) {
  const unlimited = recipeInputSupply(base, null)
  unlimited.configuration!.ports[portKey('t', 't')].boundary = { kind: 'delivery', mode: 'exact', amount: 4, capacity: null }
  const limited = recipeInputSupply(base, 2.5)
  const isolated = recipeInputSupply(base, 2)
  isolated.recipes.r.inputs.push({ portId: 'coolant', category: 'item', id: 'ore', amount: 1 })
  isolated.configuration!.ports[portKey('r', 'coolant')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: { kind: 'source', capacity: 100 } }
  isolated.configuration!.ports[portKey('t', 't')].boundary = { kind: 'delivery', mode: 'exact', amount: 3, capacity: null }
  return [
    { id: 'explicit-recipe-input-sufficient-supply', input: unlimited, expected: { status: 'success', values: [4, 4, 4] } },
    { id: 'explicit-recipe-input-limited-supply', input: limited, expected: { status: 'success', values: [2.5, 2.5, 2.5] } },
    { id: 'explicit-recipe-input-zero-supply-stops-operation', input: recipeInputSupply(base, 0), expected: { status: 'success', values: [0, 0, 0] } },
    { id: 'explicit-recipe-input-supply-cannot-leak-between-nets', input: isolated, expected: { status: 'infeasible', values: null } },
    { id: 'explicit-recipe-input-sufficient-supply-unbounded-product', input: recipeInputSupply(base, null), expected: { status: 'unbounded', values: null } },
  ].map(({ id, input, expected }) => ({ id, request: compileNetwork(input).request, expected }))
}
