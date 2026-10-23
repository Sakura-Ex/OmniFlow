import { compileNetwork } from '@/features/calculation/networkCompiler'
import { buildDiagnosticModel } from '@/features/calculation/diagnostics'
import { compilerFixture } from '../compiler/cases'
import { portKey } from '@/features/calculation/topology'

/** Real compiler and elastic-model fixtures shared by Vitest and pytest. */
export function diagnosticCases() {
  return ['T03', 'T04'].map(id => {
    const input = compilerFixture()
    input.configuration!.ports[portKey('t', 't')].boundary = { kind: 'delivery', mode: 'exact', amount: 10, capacity: null }
    if (id === 'T03') input.configuration!.ports[portKey('s', 's')].boundary = { kind: 'source', capacity: 5 }
    else input.recipes.r.outputs.push({ portId: 'waste', category: 'item', id: 'waste', amount: 2 })
    const compiled = compileNetwork(input)
    const diagnostic = buildDiagnosticModel(compiled, `diagnostic-${id}`, 1000)
    return { id, original: compiled.request, request: diagnostic.request, relaxations: diagnostic.relaxations,
      expected: { kind: id === 'T03' ? 'missing_supply' : 'missing_outlet', amount: id === 'T03' ? 5 : 20 } }
  })
}
