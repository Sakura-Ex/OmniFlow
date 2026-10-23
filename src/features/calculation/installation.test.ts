import { describe, expect, it } from 'vitest'
import type { LPResponse } from '@/common/types/lp'
import { compilerFixture } from '../../../fixtures/compiler/cases'
import { compileNetwork, type CompiledNetwork } from './networkCompiler'
import { mapCalculationResult } from './calculationResult'
import { computeCapexList } from './capEx'
import { runModifierPipeline } from '@/features/modifier/modifier.pipeline'
import { portKey } from './topology'
import { installationInputs } from '../../../fixtures/compiler/installationCases'
import solverResponses from '../../../fixtures/compiler/installation-responses.json'
import { LPResponseSchema } from '@/common/types/lp'

/**
 * Build consistent conservation and bound evidence for a known fixture vector.
 * @param model - Compiled mathematical model.
 * @param values - Exact fixture vector.
 * @returns Verified feasible response without claiming completed optimization.
 */
function response(model: CompiledNetwork, values: number[]): LPResponse {
  return { status: 'limit_reached', solution: { variable_ids: model.request.variables.map(variable => variable.id), values, feasibility: { passed: true, absolute_tolerance: 1e-7, relative_tolerance: 1e-9, max_violation: 0,
    bound_slacks: model.request.variables.map((variable, index) => ({ variable_id: variable.id, value: values[index], lower_slack: values[index], upper_slack: variable.upper === null ? null : variable.upper - values[index], tolerance: 1e-7, violation: 0, passed: true })),
    row_residuals: model.request.equalities.row_ids.map((row_id, index) => ({ row_id, kind: 'equality', rhs: model.request.equalities.rhs[index], activity: model.request.equalities.rhs[index], residual: 0, slack: null, tolerance: 1e-7, violation: 0, passed: true })),
  } }, diagnostics: [] } as unknown as LPResponse
}

describe('installation, operation and startup', () => {
  it.each(installationInputs(compilerFixture))('projects actual solver evidence for $id', ({ id, input }) => {
    const model = compileNetwork(input)
    const solved = LPResponseSchema.parse(solverResponses.find(item => item.id === id)!.response)
    expect(solved.compiler_fingerprint).toBe(model.fingerprint)
    expect(solved.solution!.feasibility.passed).toBe(true)
    const result = mapCalculationResult(model, solved)
    if (id.startsWith('T14')) {
      expect(result.node_results!.r).toMatchObject({ operating_equivalent: 1.2, recommended_installed: 2, planned_installed: 2, utilization: 0.6 })
      expect(result.bom).toEqual({ 'item:catalyst': 2 })
    } else if (id.startsWith('T24')) {
      expect(result.node_results!.r.operating_equivalent).toBe(0)
      expect(result.bom).toEqual(id.includes('-fixed-') ? { 'item:catalyst': 3 } : {})
    } else {
      expect(result.node_results!.r).toMatchObject({ operating_equivalent: 60, fixed_installed: 100, utilization: 0.6 })
      expect(solved.solution!.feasibility.bound_slacks[0].upper_slack).toBe(40)
      expect(result.system_spills).toEqual({})
    }
  })
  it('T14 uses 1.2 operation, two installed, 60% utilization and two catalysts', () => {
    const input = compilerFixture()
    input.recipes.r.inputs.push({ category: 'item', id: 'catalyst', portId: 'seed', amount: 1, consumable: false })
    input.configuration!.machines.r = { installed: null, existing: 1, operatingUpper: null }
    const model = compileNetwork(input), result = mapCalculationResult(model, response(model, [1.2, 1.2, 1.2]))
    expect(result.node_results!.r).toMatchObject({ operating_equivalent: 1.2, recommended_installed: 2, planned_installed: 2, existing_installed: 1, additional_installed: 1, utilization: 0.6 })
    expect(result.bom).toEqual({ 'item:catalyst': 2 })
    expect(result.startup!.catalysts[0].amount).toBe(2)
    expect(result.node_results!.r.port_throughputs!.out).toBe(1.2)
  })
  it('T24 excludes idle automatic occupancy but charges fixed installed occupancy', () => {
    const input = compilerFixture()
    input.recipes.r.inputs.push({ category: 'item', id: 'catalyst', portId: 'seed', amount: 1, probability: 0 })
    let model = compileNetwork(input)
    expect(mapCalculationResult(model, response(model, [0, 0, 0])).bom).toEqual({})
    input.configuration!.machines.r = { installed: 3, operatingUpper: null }
    model = compileNetwork(input)
    expect(mapCalculationResult(model, response(model, [0, 0, 0])).bom).toEqual({ 'item:catalyst': 3 })
  })
  it('T19 rejects automatic fixed loads and explicit automatic override clears legacy limit', () => {
    const input = compilerFixture()
    input.recipes.r.mode = 'limit'; input.recipes.r.manual_machines = 3
    input.configuration!.machines.r = { installed: null, operatingUpper: null }
    expect(compileNetwork(input).request.variables[0].upper).toBeNull()
    input.recipes.r.inputs[0].scaling = 'per_installed_machine'
    expect(() => compileNetwork(input)).toThrow('Fixed installation required')
  })
  it('T12 identifies an active self-reproducing cycle and declared preheat without claiming startup', () => {
    const input = compilerFixture()
    input.nodes = input.nodes.filter(node => node.id === 'r')
    input.edges = [{ id: 'cycle', source: 'r', target: 'r', sourceHandle: 'out', targetHandle: 'in' }]
    input.recipes.r.outputs[0] = { ...input.recipes.r.outputs[0], id: 'ore', amount: 2 }
    input.recipes.r.metadata.startup_requirement = 'Seed ore and preheat'
    input.configuration!.ports = { [portKey('r', 'out')]: { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: { kind: 'spill', capacity: null } } }
    const model = compileNetwork(input), result = mapCalculationResult(model, response(model, [1, 1]))
    expect(result.startup).toMatchObject({ status: 'needs_confirmation', cycles: [['r']], preheat: [{ nodeId: 'r', requirement: 'Seed ore and preheat' }] })
  })
  it('counts explicit global occupancy once and retains final per-slot amounts', () => {
    const input = compilerFixture()
    input.recipes.r.inputs = [{ category: 'item', id: 'shared', portId: 'global', amount: 3, consumable: false, occupancy_basis: 'global' }]
    const payload = runModifierPipeline(input.recipes.r)
    expect(computeCapexList({ a: payload, b: payload }, { a: { planned_installed: 2 }, b: { planned_installed: 5 } })).toEqual({ 'item:shared': 3 })
  })
})
