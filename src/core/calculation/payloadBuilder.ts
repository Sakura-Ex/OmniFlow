import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData, SourceNodeData, TargetNodeData } from '../../types/recipe'
import type { ComputedNodePayload } from '../../types/types'
import { runModifierPipeline, flattenForBackend } from '../../modifiers/pipeline'
import { normalizeEndpointPorts } from '../../utils/endpointNorm'
import { buildTopologicalNets } from './topology'
import { isNetName, isVoidName, buildResourceId } from '../../utils/resourceIdentifier'

const VIRTUAL_GLOBAL_SOURCE = 'Virtual_Global_Source'
const VIRTUAL_GLOBAL_TARGET = 'Virtual_Global_Target'

function resolveIsAuto(data: Record<string, unknown> | undefined): boolean {
  if (typeof data?.mode === 'string') {
    return data.mode !== 'limit' && data.mode !== 'demand'
  }
  if (typeof data?.is_virtual === 'boolean') return data.is_virtual
  return true
}

export interface CalculationPayload {
  payloadNodes: Array<{ id: string; type: string; data: Record<string, unknown> }>
  payloadEdges: Array<{
    source: string
    target: string
    sourceHandle: string | null | undefined
    targetHandle: string | null | undefined
  }>
  globalInputSet: Set<string>
  globalOutputSet: Set<string>
  zeroOutputNodeNames: string[]
}

export function buildCalculationPayload(
  nodes: Node[],
  edges: Edge[],
  recipeStore: Record<string, RecipeNodeData>,
): CalculationPayload {
  const shapedRecipeByNodeId = new Map<string, RecipeNodeData>()
  const globalInputSet = new Set<string>()
  const globalOutputSet = new Set<string>()

  const zeroOutputNodeNames: string[] = []
  const endpointGlobalPorts: Array<{
    nodeId: string
    nodeType: string
    port: { category: string; id: string }
  }> = []

  for (const n of nodes) {
    if (n.type === 'recipeNode') {
      const stored = recipeStore[n.id]
      if (!stored) continue
      shapedRecipeByNodeId.set(n.id, stored)

      for (const port of stored.base_inputs ?? []) {
        if (port.routing_mode === 'global') globalInputSet.add(buildResourceId(port.category, port.id))
      }
      for (const port of stored.base_outputs ?? []) {
        if (port.routing_mode === 'global') globalOutputSet.add(buildResourceId(port.category, port.id))
      }
      for (const port of stored.base_utility_inputs ?? []) {
        if (port.routing_mode === 'global') globalInputSet.add(buildResourceId(port.category, port.id))
      }
      for (const port of stored.base_utility_outputs ?? []) {
        if (port.routing_mode === 'global') globalOutputSet.add(buildResourceId(port.category, port.id))
      }

      const rates = stored._computed ?? runModifierPipeline(stored)
      const materialOutputs = rates.recipe_outputs.filter((r) => !r.is_utility)
      if (materialOutputs.length === 0 || materialOutputs.every((r) => r.amount === 0)) {
        zeroOutputNodeNames.push(stored.machine_name || n.id)
      }
    } else if (n.type === 'sourceNode' || n.type === 'targetNode') {
      const ports = normalizeEndpointPorts(n.data as SourceNodeData | TargetNodeData)
      for (const port of ports) {
        if (port.routing_mode === 'global') {
          const qid = buildResourceId(port.category, port.id)
          if (n.type === 'sourceNode') {
            globalOutputSet.add(qid)
          } else {
            globalInputSet.add(qid)
          }
          endpointGlobalPorts.push({
            nodeId: n.id,
            nodeType: n.type,
            port: { category: port.category, id: port.id },
          })
        }
      }
    }
  }

  const physicalEdges = edges.filter((e) => {
    const srcNode = nodes.find((n) => n.id === e.source)
    const tgtNode = nodes.find((n) => n.id === e.target)

    let srcGlobal = false
    if (srcNode?.type === 'recipeNode') {
      srcGlobal =
        e.sourceHandle
          ? (shapedRecipeByNodeId.get(e.source)?.base_outputs ?? []).some(
              (p) =>
                p.id &&
                buildResourceId(p.category, p.id) === e.sourceHandle &&
                p.routing_mode === 'global',
            ) ||
            (shapedRecipeByNodeId.get(e.source)?.base_utility_outputs ?? []).some(
              (p) =>
                p.id &&
                buildResourceId(p.category, p.id) === e.sourceHandle &&
                p.routing_mode === 'global',
            )
          : false
    } else if (srcNode?.type === 'sourceNode') {
      const ports = normalizeEndpointPorts(srcNode.data as SourceNodeData | TargetNodeData)
      srcGlobal = ports.some(
        (p) => buildResourceId(p.category, p.id) === e.sourceHandle && p.routing_mode === 'global',
      )
    }

    let tgtGlobal = false
    if (tgtNode?.type === 'recipeNode') {
      tgtGlobal =
        e.targetHandle
          ? (shapedRecipeByNodeId.get(e.target)?.base_inputs ?? []).some(
              (p) =>
                p.id &&
                buildResourceId(p.category, p.id) === e.targetHandle &&
                p.routing_mode === 'global',
            ) ||
            (shapedRecipeByNodeId.get(e.target)?.base_utility_inputs ?? []).some(
              (p) =>
                p.id &&
                buildResourceId(p.category, p.id) === e.targetHandle &&
                p.routing_mode === 'global',
            )
          : false
    } else if (tgtNode?.type === 'targetNode') {
      const ports = normalizeEndpointPorts(tgtNode.data as SourceNodeData | TargetNodeData)
      tgtGlobal = ports.some(
        (p) => buildResourceId(p.category, p.id) === e.targetHandle && p.routing_mode === 'global',
      )
    }

    return !srcGlobal && !tgtGlobal
  })

  const topologicalNets = buildTopologicalNets(nodes, physicalEdges, shapedRecipeByNodeId)
  const netLookup = topologicalNets.lookup

  function translateFlattenedKeys(
    nodeId: string,
    dict: Record<string, number>,
  ): Record<string, number> {
    const translated: Record<string, number> = {}
    for (const [key, val] of Object.entries(dict)) {
      const netName = netLookup.get(`${nodeId}|${key}`)
      const finalKey = netName && (isNetName(netName) || isVoidName(netName)) ? netName : key
      translated[finalKey] = (translated[finalKey] ?? 0) + val
    }
    return translated
  }

  const portHandleToSubNodeId = new Map<string, string>()

  const payloadNodes: Array<{ id: string; type: string; data: Record<string, unknown> }> = []

  for (const n of nodes) {
    if (n.type === 'sourceNode' || n.type === 'targetNode') {
      const ports = normalizeEndpointPorts(n.data as SourceNodeData | TargetNodeData)
      const isAuto = resolveIsAuto(n.data as Record<string, unknown> | undefined)
      const mode: string =
        n.data?.mode ??
        (n.type === 'sourceNode'
          ? isAuto
            ? 'infinite'
            : 'limit'
          : isAuto
            ? 'maximize'
            : 'demand')

      ports.forEach((port, pi) => {
        const portCategory = port.category ?? 'item'
        const qualifiedId = buildResourceId(portCategory, port.id)
        const key = `${n.id}|${qualifiedId}`
        const subId = `${n.id}__p${pi}`

        const rawNetId = netLookup.get(key)
        const netId = rawNetId && (isNetName(rawNetId) || isVoidName(rawNetId)) ? rawNetId : qualifiedId

        portHandleToSubNodeId.set(key, subId)

        payloadNodes.push({
          id: subId,
          type: n.type ?? 'sourceNode',
          data: {
            id: netId,
            amount: port.amount,
            mode,
          },
        })
      })
      continue
    }

    if (n.type !== 'recipeNode') {
      payloadNodes.push({
        id: n.id,
        type: n.type ?? 'unknown',
        data: n.data as Record<string, unknown>,
      })
      continue
    }

    const shaped = shapedRecipeByNodeId.get(n.id)
    if (!shaped) {
      console.warn(`Recipe node ${n.id} not found in recipe store, skipping`)
      continue
    }

    const payload =
      (shaped._computed as ComputedNodePayload | undefined) ?? runModifierPipeline(shaped)
    const flattened = flattenForBackend(payload)

    const translatedInputs = translateFlattenedKeys(n.id, flattened.inputs)
    const translatedOutputs = translateFlattenedKeys(n.id, flattened.outputs)

    payloadNodes.push({
      id: n.id,
      type: n.type,
      data: {
        recipe_id: shaped.recipe_id || n.id,
        machine_name: shaped.machine_name || 'Recipe Machine',
        system: shaped.system ?? 'custom',
        inputs: translatedInputs,
        outputs: translatedOutputs,
        mode: payload.duration_seconds <= 0 ? 'auto' : shaped.mode,
        manual_machines: payload.duration_seconds <= 0 ? undefined : shaped.manual_machines,
        metadata: shaped.metadata ?? {},
      },
    })
  }

  const wiredEdges = physicalEdges.map((e) => {
    const srcSubId = e.sourceHandle
      ? portHandleToSubNodeId.get(`${e.source}|${e.sourceHandle}`) ?? e.source
      : e.source
    const tgtSubId = e.targetHandle
      ? portHandleToSubNodeId.get(`${e.target}|${e.targetHandle}`) ?? e.target
      : e.target

    return {
      source: srcSubId,
      target: tgtSubId,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }
  })

  const implicitEdges: Array<{
    source: string
    target: string
    sourceHandle: string | null | undefined
    targetHandle: string | null | undefined
  }> = []

  for (const [nodeId, shaped] of shapedRecipeByNodeId.entries()) {
    for (const port of shaped.base_inputs ?? []) {
      if (port.routing_mode !== 'global' || !port.id) continue
      const key = buildResourceId(port.category, port.id)
      implicitEdges.push({
        source: VIRTUAL_GLOBAL_SOURCE,
        target: nodeId,
        sourceHandle: key,
        targetHandle: key,
      })
    }
    for (const port of shaped.base_outputs ?? []) {
      if (port.routing_mode !== 'global' || !port.id) continue
      const key = buildResourceId(port.category, port.id)
      implicitEdges.push({
        source: nodeId,
        target: VIRTUAL_GLOBAL_TARGET,
        sourceHandle: key,
        targetHandle: key,
      })
    }
    for (const port of shaped.base_utility_inputs ?? []) {
      if (port.routing_mode !== 'global' || !port.id) continue
      const key = buildResourceId(port.category, port.id)
      implicitEdges.push({
        source: VIRTUAL_GLOBAL_SOURCE,
        target: nodeId,
        sourceHandle: key,
        targetHandle: key,
      })
    }
    for (const port of shaped.base_utility_outputs ?? []) {
      if (port.routing_mode !== 'global' || !port.id) continue
      const key = buildResourceId(port.category, port.id)
      implicitEdges.push({
        source: nodeId,
        target: VIRTUAL_GLOBAL_TARGET,
        sourceHandle: key,
        targetHandle: key,
      })
    }
  }

  for (const ep of endpointGlobalPorts) {
    const key = buildResourceId(ep.port.category, ep.port.id)
    const subNodeId = portHandleToSubNodeId.get(`${ep.nodeId}|${key}`) ?? ep.nodeId
    if (ep.nodeType === 'sourceNode') {
      implicitEdges.push({
        source: subNodeId,
        target: VIRTUAL_GLOBAL_TARGET,
        sourceHandle: key,
        targetHandle: key,
      })
    } else {
      implicitEdges.push({
        source: VIRTUAL_GLOBAL_SOURCE,
        target: subNodeId,
        sourceHandle: key,
        targetHandle: key,
      })
    }
  }

  const virtualGlobalNodes = [
    {
      id: VIRTUAL_GLOBAL_SOURCE,
      type: 'virtualNode',
      data: { kind: 'global_source' },
    },
    {
      id: VIRTUAL_GLOBAL_TARGET,
      type: 'virtualNode',
      data: { kind: 'global_target' },
    },
  ]

  return {
    payloadNodes: payloadNodes.concat(virtualGlobalNodes),
    payloadEdges: wiredEdges.concat(implicitEdges),
    globalInputSet,
    globalOutputSet,
    zeroOutputNodeNames,
  }
}
