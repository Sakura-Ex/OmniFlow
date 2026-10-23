import { stripCalculationResults } from '@/common/utils/calculationState'
import type { Node, Edge } from 'reactflow'
import type { RecipeNodeData, EndpointPort } from '@/common/types/recipe'
import type { ComputedNodePayload } from '@/common/types/resource'
import type { UnitSnapshot, UnitExpression } from '@/common/types/units'
import { LPRequestSchema, LP_SCHEMA_VERSION, type LPRequest } from '@/common/types/lp'
import { runModifierPipeline } from '@/features/modifier/modifier.pipeline'
import { UnitSystem } from '@/common/units/UnitSystem'
import { DEFAULT_UNIT_SNAPSHOT, defaultResourceUnit } from '@/common/units/defaults'
import { identifyPorts, portIdentity } from '@/common/utils/ports'
import { buildResourceId } from '@/common/utils/resourceId'
import { connectionIssue, type GraphPort } from './graphPorts'
import { portKey } from './topology'
import { NetworkConfigurationSchema, emptyNetworkConfiguration, type NetworkConfiguration } from './networkConfig'
import { SplitterNodeDataSchema } from '@/common/schemas/splitter.schema'
import { splitterPorts } from './splitter'

/** Gross port expression survives cancellation in a conservation row. */
export interface CompiledPort extends GraphPort {
  key: string
  netId: string
  coefficient: number
  variable: number | null
  constant: number
  semantics: 'flow' | 'capacity' | 'state'
  unit: UnitExpression
}
/** Deterministic shared pool, isolated by topology or explicit global scope. */
export interface CompiledNet {
  id: string
  resourceId: string
  ports: string[]
  semantics: CompiledPort['semantics']
}
/** Original domain evidence for a variable or constraint. */
export interface ModelOrigin {
  kind: 'operation' | 'splitter' | 'source' | 'delivery' | 'spill' | 'conservation' | 'capacity' | 'ratio'
  nodeId?: string
  netId?: string
  portKeys: string[]
  unit?: UnitExpression | 'operating_equivalent'
}
/** The exact LP and evidence compiled from one immutable environment. */
export interface CompiledNetwork {
  environment: UnitSnapshot
  configuration: NetworkConfiguration
  recipeDefinitions: Record<string, RecipeNodeData>
  request: LPRequest
  fingerprint: string
  ports: CompiledPort[]
  nets: CompiledNet[]
  recipes: Record<string, ComputedNodePayload>
  provenance: { variables: ModelOrigin[]; rows: Record<string, ModelOrigin> }
}
/** Explicit immutable inputs; no store is read during compilation. */
export interface NetworkCompileInput {
  nodes: Node[]
  edges: Edge[]
  recipes: Record<string, RecipeNodeData>
  environment?: UnitSnapshot
  configuration?: NetworkConfiguration
  requestId: string
  documentRevision: number
  timeLimitMs?: number
}

/**
 * Serialize object keys canonically so graph ordering cannot alter identity.
 * @param value - Serializable snapshot.
 * @returns Canonical JSON representation.
 */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}

/**
 * Compute a compact deterministic fingerprint without request identity.
 * @param value - Serializable compilation evidence.
 * @returns Stable model fingerprint.
 */
function fingerprint(value: unknown): string {
  let hash = 2166136261
  for (const character of stable(value)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return `network-v1:${(hash >>> 0).toString(16)}`
}

/**
 * Compile final ports once into strict conserved LP rows and traceable origins.
 * @param input - Immutable graph, recipes, environment and explicit policies.
 * @returns Validated LP request and complete domain provenance.
 */
export function compileNetwork(input: NetworkCompileInput): CompiledNetwork {
  const environment = input.environment ?? DEFAULT_UNIT_SNAPSHOT
  const units = new UnitSystem(environment)
  const configuration = NetworkConfigurationSchema.parse(input.configuration ?? emptyNetworkConfiguration())
  const nodes = [...input.nodes].sort((a, b) => a.id.localeCompare(b.id))
  const nodesById = new Map(nodes.map(node => [node.id, node]))
  if (nodesById.size !== nodes.length) throw new Error('Duplicate node identity')
  const recipes: CompiledNetwork['recipes'] = {}
  const ports: CompiledPort[] = []
  const portIndex = new Map<string, CompiledPort>()
  const portsByNode = new Map<string, CompiledPort[]>()
  const portsByNet = new Map<string, CompiledPort[]>()
  const rateUnitCache = new Map<string, UnitExpression>()
  const variables: LPRequest['variables'] = []
  const variableOrigins: ModelOrigin[] = []
  const rowOrigins: Record<string, ModelOrigin> = {}
  const equalities: LPRequest['equalities'] = { row_ids: [], rhs: [], entries: [] }
  const inequalities: LPRequest['inequalities'] = { row_ids: [], rhs: [], entries: [] }
  const layers = new Map<number, LPRequest['objectives'][number]>()
  const ratios = new Map<string, { col: number; ratio: number; key: string; priority: number; sign: number }[]>()
  const addVariable = (id: string, lower: number, upper: number | null, origin: ModelOrigin) => {
    const col = variables.length
    variables.push({ id, lower, upper }); variableOrigins.push({ ...origin, unit: origin.kind === 'operation' ? 'operating_equivalent' : origin.unit })
    return col
  }
  const addObjective = (col: number, sign: number, policy: { priority: number; weight: number; scale: number; ratioGroup?: string; ratio?: number }, key: string) => {
    const layer = layers.get(policy.priority) ?? { id: `priority:${policy.priority}`, priority: policy.priority, coefficients: [], normalization_scale: 1, abs_tolerance: 1e-8, rel_tolerance: 1e-9 }
    layer.coefficients.push({ col, value: sign * policy.weight / policy.scale })
    layers.set(policy.priority, layer)
    if (policy.ratioGroup) {
      const group = ratios.get(policy.ratioGroup) ?? []
      group.push({ col, ratio: policy.ratio!, key, priority: policy.priority, sign })
      ratios.set(policy.ratioGroup, group)
    }
  }
  for (const node of nodes) {
    let graph: GraphPort[]
    let operation: number | null = null
    if (node.type === 'recipeNode') {
      const recipe = input.recipes[node.id]
      if (!recipe) throw new Error(`Missing recipe: ${node.id}`)
      const payload = runModifierPipeline(recipe, environment)
      if (!payload.eligibility.eligible) throw new Error(`${node.id}: ${payload.eligibility.reasons.join('; ')}`)
      recipes[node.id] = payload
      const machine = configuration.machines[node.id]
      const installed = machine ? machine.installed : recipe.mode === 'limit' ? recipe.manual_machines : null
      if (recipe.mode === 'limit' && installed === undefined) throw new Error(`Fixed installation count required: ${node.id}`)
      const upper = Math.min(machine?.operatingUpper ?? Infinity, installed ?? Infinity)
      operation = addVariable(`operation:${node.id}`, 0, upper === Infinity ? null : upper, { kind: 'operation', nodeId: node.id, portKeys: payload.final_ports.map(({ port }) => portKey(node.id, portIdentity(port))) })
      if (configuration.minimizeMachines) addObjective(operation, 1, configuration.minimizeMachines, node.id)
      graph = payload.final_ports.map(({ port, direction }) => ({ nodeId: node.id, portId: portIdentity(port), direction, resourceId: buildResourceId(port.category, port.id), port }))
    } else if (node.type === 'splitterNode') {
      const data = SplitterNodeDataSchema.parse(stripCalculationResults(node.data))
      graph = splitterPorts(node.id, data)
      operation = addVariable(`splitter:${node.id}`, 0, data.capacity, { kind: 'splitter', nodeId: node.id, portKeys: graph.map(port => portKey(node.id, port.portId)) })
    } else if (node.type === 'sourceNode' || node.type === 'targetNode') {
      graph = identifyPorts<EndpointPort>(node.data.ports ?? [], 'endpoint').map(port => ({ nodeId: node.id, portId: portIdentity(port), direction: node.type === 'sourceNode' ? 'output' : 'input', resourceId: buildResourceId(port.category, port.id), port }))
      if (!graph.length) throw new Error(`Endpoint ${node.id} has no ports`)
    } else throw new Error(`Unsupported node type: ${node.type}`)
    for (const graphPort of graph) {
      const key = portKey(node.id, graphPort.portId)
      if (portIndex.has(key)) throw new Error(`Duplicate port identity: ${key}`)
      const policy = configuration.ports[key]
      const semantics = policy?.semantics.kind ?? 'flow'
      const amount = node.type === 'recipeNode' || node.type === 'splitterNode' ? graphPort.port.amount : units.toRate(graphPort.port.amount, graphPort.port.unit ?? defaultResourceUnit(graphPort.port.category, graphPort.port.id), 'rate_per_sec', 1)
      if (!Number.isFinite(amount) || amount < 0 || !graphPort.port.id.trim()) throw new Error(`Invalid quantity/resource: ${key}`)
      const resourceUnit = graphPort.port.unit ?? defaultResourceUnit(graphPort.port.category, graphPort.port.id)
      const unitKey = stable(resourceUnit)
      let unit = rateUnitCache.get(unitKey)
      if (!unit) {
        const rateDimensions = units.registry.normalize(units.rateQuantity(1, resourceUnit, 'rate_per_sec', 1).unit.expression).dimensions
        unit = Object.entries(rateDimensions).map(([baseUnitId, exponent]) => ({ baseUnitId, exponent }))
        rateUnitCache.set(unitKey, unit)
      }
      const port: CompiledPort = { ...graphPort, key, netId: '', coefficient: amount, variable: operation, constant: 0, semantics, unit }
      if (node.type === 'splitterNode' && (semantics !== 'flow' || (policy?.boundary && (graphPort.direction !== 'output' || !['spill', 'forbid_spill'].includes(policy.boundary.kind))))) throw new Error(`Splitter allocation ports require flow semantics and only output spill policies: ${key}`)
      if (graphPort.port.scaling === 'per_installed_machine' && amount !== 0) {
        const recipe = input.recipes[node.id]
        const machine = configuration.machines[node.id]
        const installed = machine ? machine.installed : recipe?.mode === 'limit' ? recipe.manual_machines : null
        if (installed === null || installed === undefined) throw new Error(`Fixed installation required for fixed load: ${key}`)
        port.constant = amount * installed
        port.variable = null
      }
      if (semantics === 'state') {
        const state = policy!.semantics
        if (state.kind !== 'state') throw new Error('Invalid state policy')
        if ((state.minimum !== undefined && state.actual < state.minimum) || (state.maximum !== undefined && state.actual > state.maximum)) throw new Error(`Fixed state requirement failed: ${key}`)
      }
      if (node.type === 'splitterNode' && operation !== null) variableOrigins[operation].unit = unit
      ports.push(port)
      portIndex.set(key, port)
      const nodePorts = portsByNode.get(node.id) ?? []
      nodePorts.push(port)
      portsByNode.set(node.id, nodePorts)
    }
  }
  for (const key of Object.keys(configuration.ports)) if (!portIndex.has(key)) throw new Error(`Configuration references missing port: ${key}`)
  for (const key of Object.keys(configuration.machines)) if (!recipes[key]) throw new Error(`Configuration references missing machine: ${key}`)
  const parent = new Map(ports.map(port => [port.key, port.key]))
  const find = (key: string): string => {
    let root = key
    while (parent.get(root) !== root) root = parent.get(root)!
    let current = key
    while (parent.get(current) !== root) {
      const next = parent.get(current)!
      parent.set(current, root)
      current = next
    }
    return root
  }
  for (const edge of [...input.edges].sort((a, b) => a.id.localeCompare(b.id))) {
    const issue = connectionIssue(edge, ports, portIndex)
    if (issue) throw new Error(`Edge ${edge.id}: ${issue}`)
    const a = find(portKey(edge.source, edge.sourceHandle!)), b = find(portKey(edge.target, edge.targetHandle!))
    if (a !== b) parent.set(a < b ? b : a, a < b ? a : b)
  }
  const nets = new Map<string, CompiledNet>()
  const dimensions = new Map<string, string>()
  for (const port of ports) {
    const policy = configuration.ports[port.key]
    port.netId = port.port.routing_mode === 'global' ? stable(['global', policy?.scopeId ?? 'document', port.resourceId, policy?.busId ?? 'default']) : stable(['wired', port.resourceId, find(port.key)])
    const net = nets.get(port.netId) ?? { id: port.netId, resourceId: port.resourceId, ports: [], semantics: port.semantics }
    if (net.semantics !== port.semantics) throw new Error(`Mixed mathematical semantics: ${port.key}`)
    const signature = stable(port.unit)
    if (dimensions.has(port.resourceId) && dimensions.get(port.resourceId) !== signature) throw new Error(`Incompatible units: ${port.key}`)
    dimensions.set(port.resourceId, signature)
    net.ports.push(port.key); nets.set(net.id, net)
    const netPorts = portsByNet.get(net.id) ?? []
    netPorts.push(port)
    portsByNet.set(net.id, netPorts)
  }
  for (const node of nodes.filter(node => node.type === 'splitterNode')) {
    const members = portsByNode.get(node.id)!
    const inputNet = members.find(port => port.direction === 'input')!.netId
    const outputNets = members.filter(port => port.direction === 'output').map(port => port.netId)
    if (outputNets.includes(inputNet)) throw new Error(`Splitter input and output cannot share a Net: ${node.id}`)
    if (new Set(outputNets).size !== outputNets.length) throw new Error(`Splitter outputs cannot merge into one Net: ${node.id}`)
  }
  for (const net of nets.values()) {
    const members = portsByNet.get(net.id)!
    if (net.semantics === 'state') {
      if (members.some(port => configuration.ports[port.key]?.boundary)) throw new Error(`State ports cannot have flow boundaries: ${net.id}`)
      continue
    }
    const coefficients = new Map<number, number>()
    let constant = 0
    let available: number | undefined
    let hasProducer = false
    const add = (col: number, value: number) => coefficients.set(col, (coefficients.get(col) ?? 0) + value)
    for (const port of members) {
      const policy = configuration.ports[port.key]
      if (policy?.semantics.kind === 'capacity') {
        if (available !== undefined && available !== policy.semantics.available) throw new Error(`Conflicting capacity on shared pool: ${net.id}`)
        available = policy.semantics.available
      }
      const boundary = policy?.boundary
      if (net.semantics === 'capacity' && boundary) throw new Error(`Capacity pools use fixed available capacity: ${port.key}`)
      if (port.variable !== null || port.constant !== 0) {
        const sign = port.direction === 'output' ? 1 : -1
        if (port.variable !== null) add(port.variable, sign * port.coefficient)
        constant += sign * port.constant
        if (port.direction === 'output' && port.coefficient > 0) hasProducer = true
      }
      const nodeType = nodesById.get(port.nodeId)!.type
      const endpoint = nodeType === 'sourceNode' || nodeType === 'targetNode'
      if (endpoint && (!boundary || boundary.kind === 'forbid_spill')) throw new Error(`Endpoint requires explicit source/delivery/spill: ${port.key}`)
      if (endpoint && port.direction === 'output' && boundary?.kind !== 'source') throw new Error(`Source endpoint requires explicit source: ${port.key}`)
      if (boundary && boundary.kind !== 'forbid_spill') {
        const recipeInputSupply = nodeType === 'recipeNode' && port.direction === 'input' && net.semantics === 'flow'
        if (boundary.kind === 'source' && port.direction !== 'output' && !recipeInputSupply) throw new Error(`Source requires an output port or a recipe flow input: ${port.key}`)
        if (boundary.kind === 'delivery' && port.direction !== 'input') throw new Error(`Delivery requires input port: ${port.key}`)
        const lower = boundary.kind === 'delivery' && ['at_least', 'exact'].includes(boundary.mode) ? boundary.amount : 0
        if (boundary.kind === 'delivery' && boundary.mode === 'exact' && boundary.capacity !== null && boundary.amount > boundary.capacity) throw new Error(`Exact delivery exceeds configured capacity: ${port.key}`)
        const upper = boundary.kind === 'delivery' && boundary.mode === 'exact' ? boundary.amount : boundary.capacity
        const col = addVariable(`${boundary.kind}:${port.key}`, lower, upper, { kind: boundary.kind, nodeId: port.nodeId, netId: net.id, portKeys: [port.key], unit: port.unit })
        add(col, boundary.kind === 'source' ? 1 : -1)
        if (endpoint) { port.variable = col; port.coefficient = 1 }
        if (boundary.kind === 'source') hasProducer = true
        if (boundary.kind === 'delivery' && boundary.mode === 'maximize') {
          if (!boundary.objective) throw new Error(`Maximize requires explicit priority and scale: ${port.key}`)
          addObjective(col, -1, boundary.objective, port.key)
        } else if (boundary.kind !== 'delivery' && boundary.cost) addObjective(col, 1, boundary.cost, port.key)
      }
    }
    if (net.semantics === 'flow' && !hasProducer && members.some(port => port.direction === 'input' && port.coefficient > 0 && (port.variable !== null || port.constant > 0) && !['sourceNode', 'targetNode'].includes(nodesById.get(port.nodeId)!.type!))) throw new Error(`Missing positive flow source: ${members.filter(port => port.direction === 'input').map(port => port.key).join(', ')}`)
    const rows = net.semantics === 'capacity' ? inequalities : equalities
    const row = rows.row_ids.length
    const id = `${net.semantics}:${row}`
    rows.row_ids.push(id)
    rows.rhs.push((net.semantics === 'capacity' ? (available ?? 0) + constant : -constant) || 0)
    for (const [col, value] of coefficients) if (value !== 0) rows.entries.push({ row, col, value: net.semantics === 'capacity' ? -value : value })
    rowOrigins[id] = { kind: net.semantics === 'capacity' ? 'capacity' : 'conservation', netId: net.id, portKeys: net.ports }
    if (members.some(port => configuration.ports[port.key]?.boundary?.kind === 'forbid_spill') && members.some(port => configuration.ports[port.key]?.boundary?.kind === 'spill')) throw new Error(`Conflicting spill policies on shared Net: ${net.id}`)
  }
  for (const [group, members] of ratios) {
    const first = members[0]
    if (members.length < 2) throw new Error(`Fixed-ratio group requires at least two members: ${group}`)
    if (members.some(member => member.priority !== first.priority || member.sign !== first.sign)) throw new Error(`Fixed-ratio group must share priority and objective direction: ${group}`)
    for (const member of members.slice(1)) {
      const row = equalities.row_ids.length, id = `ratio:${row}`
      equalities.row_ids.push(id); equalities.rhs.push(0)
      equalities.entries.push({ row, col: first.col, value: 1 / first.ratio }, { row, col: member.col, value: -1 / member.ratio })
      rowOrigins[id] = { kind: 'ratio', portKeys: [first.key, member.key] }
    }
  }
  if (!configuration.minimizeMachines && variableOrigins.some(origin => origin.kind === 'operation')) {
    const priorities = [...layers.keys()]
    const priority = priorities.length ? Math.max(...priorities) + 1 : 0
    if (!Number.isSafeInteger(priority)) throw new Error('Reserve a safe priority after user objectives for machine minimization')
    variableOrigins.forEach((origin, col) => {
      if (origin.kind === 'operation') addObjective(col, 1, { priority, weight: 1, scale: 1 }, origin.nodeId!)
    })
  }
  const mathematical = { variables, equalities, inequalities, objectives: [...layers.values()].sort((a, b) => a.priority - b.priority) }
  const modelFingerprint = fingerprint({ mathematical, environment, configuration, recipes: Object.fromEntries(Object.entries(recipes).map(([id, recipe]) => [id, recipe.cache_key])) })
  const request = LPRequestSchema.parse({ schema_version: LP_SCHEMA_VERSION, request_id: input.requestId, document_revision: input.documentRevision, compiler_fingerprint: modelFingerprint, ...mathematical, solver_options: { time_limit_ms: input.timeLimitMs ?? 10000 } })
  return { environment, configuration, recipeDefinitions: structuredClone(input.recipes), request, fingerprint: modelFingerprint, ports, nets: [...nets.values()], recipes, provenance: { variables: variableOrigins, rows: rowOrigins } }
}
