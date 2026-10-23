import { compileNetwork, type NetworkCompileInput } from '@/features/calculation/networkCompiler'
import { portKey } from '@/features/calculation/topology'

/**
 * Build real operating vectors for installation and dispatch acceptance cases.
 * @param base - Authoritative shared compiler input factory.
 * @returns Domain inputs and expected mathematical solution vectors.
 */
export function installationInputs(base: () => NetworkCompileInput) {
  const fractional = base()
  fractional.recipes.r.inputs.push({ category: 'item', id: 'catalyst', portId: 'catalyst', amount: 1, consumable: false })
  fractional.configuration!.ports[portKey('t', 't')].boundary = { kind: 'delivery', mode: 'exact', amount: 1.2, capacity: null }
  const idle = base()
  idle.recipes.r.inputs.push({ category: 'item', id: 'catalyst', portId: 'catalyst', amount: 1, probability: 0 })
  idle.nodes = idle.nodes.filter(node => node.id !== 't')
  idle.edges = idle.edges.filter(edge => edge.target !== 't')
  delete idle.configuration!.ports[portKey('t', 't')]
  const fixedIdle = structuredClone(idle)
  fixedIdle.configuration!.machines.r = { installed: 3, operatingUpper: null }
  const dispatch = base()
  dispatch.nodes = dispatch.nodes.filter(node => node.id !== 's')
  dispatch.edges = dispatch.edges.filter(edge => edge.source !== 's')
  delete dispatch.configuration!.ports[portKey('s', 's')]
  dispatch.recipes.r.inputs = []
  dispatch.recipes.r.outputs = [{ portId: 'out', category: 'energy', id: 'power', amount: 1, time_base: 'rate_per_sec', unit: [{ baseUnitId: 'EU', exponent: 1 }] }]
  dispatch.nodes.find(node => node.id === 't')!.data.ports = [{ portId: 't', category: 'energy', id: 'power', amount: 60, unit: [{ baseUnitId: 'EU', exponent: 1 }] }]
  dispatch.configuration!.machines.r = { installed: 100, operatingUpper: null }
  dispatch.configuration!.ports[portKey('t', 't')].boundary = { kind: 'delivery', mode: 'exact', amount: 60, capacity: null }
  return [
    { id: 'T14-fractional-operation-and-catalyst', input: fractional, values: [1.2, 1.2, 1.2] },
    { id: 'T24-idle-automatic-installation', input: idle, values: [0, 0] },
    { id: 'T24-idle-fixed-installation', input: fixedIdle, values: [0, 0] },
    { id: 'T18-dispatchable-power-100-capacity-60-load', input: dispatch, values: [60, 60] },
  ]
}

/**
 * Compile installation acceptance cases into the production sparse LP contract.
 * @param base - Shared compiler input factory.
 * @returns Real solver cases with explicit generation-capacity slack evidence.
 */
export function installationCases(base: () => NetworkCompileInput) {
  return installationInputs(base).map(({ id, input, values }) => ({ id, request: compileNetwork(input).request, expected: { status: 'success', values, ...(id.startsWith('T18-') ? { upper_slacks: { 'operation:r': 40 } } : {}) } }))
}
