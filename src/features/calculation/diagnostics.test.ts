import { describe, expect, it, vi } from 'vitest'
import { LPResponseSchema } from '@/common/types/lp'
import { portKey } from './topology'
import { compileNetwork } from './networkCompiler'
import { buildDiagnosticModel, explainActiveLimits, runNetworkDiagnostics } from './diagnostics'
import { compilerFixture } from '../../../fixtures/compiler/cases'
import { diagnosticCases } from '../../../fixtures/diagnostics/cases'
import models from '../../../fixtures/diagnostics/models.json'
import responses from '../../../fixtures/diagnostics/responses.json'
import { splitterFixture } from '../../../fixtures/compiler/splitterCases'

/** Build the matching original compiler model for shared diagnostic evidence.
 * @param index - Shared supply or waste fixture index.
 * @returns Original compiled infeasible network.
 */
function fixture(index = 0) {
  const input = compilerFixture()
  input.configuration!.ports[portKey('t', 't')].boundary = { kind: 'delivery', mode: 'exact', amount: 10, capacity: null }
  if (index === 0) input.configuration!.ports[portKey('s', 's')].boundary = { kind: 'source', capacity: 5 }
  else input.recipes.r.outputs.push({ portId: 'waste', category: 'item', id: 'waste', amount: 2 })
  return compileNetwork(input)
}

describe('bounded structured infeasibility diagnostics', () => {
  it('recognizes blocked splitter outlets and never fabricates finished product supply', () => {
    const input = splitterFixture()
    input.nodes = input.nodes.filter(node => node.id !== 'u')
    input.edges = input.edges.filter(edge => edge.target !== 'u')
    delete input.configuration!.ports[portKey('u', 'u')]
    input.configuration!.ports[portKey('t', 't')].boundary = { kind: 'delivery', mode: 'exact', amount: 4, capacity: null }
    const model = compileNetwork(input)
    const diagnostic = buildDiagnosticModel(model, 'blocked-splitter', 1000)
    const blockedNet = model.ports.find(port => port.key === portKey('f', 'b'))!.netId
    const targetNet = model.ports.find(port => port.key === portKey('t', 't'))!.netId
    expect(diagnostic.relaxations.some(item => item.origin.netId === blockedNet && item.kind === 'missing_outlet')).toBe(true)
    expect(diagnostic.relaxations.some(item => item.origin.netId === targetNet && item.kind === 'missing_supply')).toBe(false)
    expect(diagnostic.relaxations.filter(item => item.kind === 'missing_supply').every(item => model.provenance.variables.some(origin => origin.kind === 'source' && origin.netId === item.origin.netId))).toBe(true)
  })
  it('keeps the real Python fixtures identical to current compilation and diagnostic policy', () => {
    expect(diagnosticCases()).toEqual(models)
  })
  it.each([0, 1])('maps real solver evidence to located deficits without replacing original infeasibility (%s)', async index => {
    const model = fixture(index)
    const original = LPResponseSchema.parse(responses[index].original)
    const before = structuredClone(original)
    const diagnostic = LPResponseSchema.parse(responses[index].response)
    const report = await runNetworkDiagnostics(model, original, {
      deadline: performance.now() + 1000, requestId: diagnostic.request_id!,
      solve: async () => diagnostic, isCurrent: () => true,
    })
    expect(report.status).toBe('explained')
    expect(report.issues).toHaveLength(1)
    expect(report.issues[0].kind).toBe(models[index].expected.kind)
    expect(report.issues[0].amount).toBeCloseTo(models[index].expected.amount)
    expect(report.issues[0].nodeIds).toContain(index === 0 ? 's' : 'r')
    expect(report.issues[0].portKeys.length).toBeGreaterThan(0)
    expect(report.assumptions.join(' ')).toContain('多个冲突')
    expect(original).toEqual(before)
    expect('solution' in report).toBe(false)
  })
  it('never relaxes unknown rows, ratio rows or original variable bounds', () => {
    const model = fixture()
    model.request.equalities.row_ids.push('unknown', 'ratio')
    model.request.equalities.rhs.push(0, 0)
    model.provenance.rows.ratio = { kind: 'ratio', portKeys: [] }
    const diagnostic = buildDiagnosticModel(model, 'test', 100)
    expect(diagnostic.relaxations.some(item => ['unknown', 'ratio'].includes(item.rowId))).toBe(false)
    expect(diagnostic.request.variables.slice(0, model.request.variables.length)).toEqual(model.request.variables)
    expect(diagnostic.request.objectives).toHaveLength(1)
    expect(diagnostic.request.variables.slice(model.request.variables.length).every(item => item.upper === 1e6)).toBe(true)
    expect(() => buildDiagnosticModel(model, 'none-allowed', 100, [])).toThrow()
  })
  it('relaxes only capacity inequalities and includes their explicit scale', () => {
    const model = fixture()
    model.request.inequalities = { row_ids: ['capacity', 'unknown'], rhs: [5, 1], entries: [{ row: 0, col: 0, value: 2 }] }
    model.provenance.rows.capacity = { kind: 'capacity', portKeys: [] }
    const diagnostic = buildDiagnosticModel(model, 'capacity', 100)
    const relaxation = diagnostic.relaxations.find(item => item.rowId === 'capacity')!
    expect(relaxation.kind).toBe('capacity_shortfall')
    expect(relaxation.scale).toBe(5)
    expect(diagnostic.relaxations.some(item => item.rowId === 'unknown')).toBe(false)
  })
  it('does not diagnose after the total deadline or when a newer edit supersedes the run', async () => {
    const model = fixture(), original = LPResponseSchema.parse(responses[0].original)
    const solve = vi.fn()
    expect((await runNetworkDiagnostics(model, original, { deadline: performance.now() - 1, requestId: 'x', solve, isCurrent: () => true })).status).toBe('unavailable')
    expect((await runNetworkDiagnostics(model, original, { deadline: performance.now() + 100, requestId: 'x', solve, isCurrent: () => false })).status).toBe('stale')
    expect(solve).not.toHaveBeenCalled()
  })
  it('keeps the original result after diagnostic failure, identity mismatch or in-flight edits', async () => {
    const model = fixture(), original = LPResponseSchema.parse(responses[0].original)
    const base = { deadline: performance.now() + 1000, requestId: 'diagnostic-T03', isCurrent: () => true }
    expect((await runNetworkDiagnostics(model, original, { ...base, solve: async () => { throw new Error('timeout') } })).status).toBe('unavailable')
    expect((await runNetworkDiagnostics(model, original, { ...base, solve: async () => ({ ...LPResponseSchema.parse(responses[0].response), request_id: 'old' }) })).status).toBe('unavailable')
    let current = true
    expect((await runNetworkDiagnostics(model, original, { ...base, isCurrent: () => current, solve: async () => { current = false; return LPResponseSchema.parse(responses[0].response) } })).status).toBe('stale')
    expect(original.status).toBe('infeasible')
    expect(original.solution).toBeNull()
  })
  it('reports unknown gain rather than calling every binding row a beneficial expansion', () => {
    const model = fixture(), response = LPResponseSchema.parse(responses[0].response)
    const limits = explainActiveLimits(model, response)
    expect(limits.some(limit => limit.atLimit)).toBe(true)
    expect(limits.every(limit => limit.benefit === 'unknown')).toBe(true)
    expect(explainActiveLimits(model, LPResponseSchema.parse(responses[0].original))).toEqual([])
  })
})
