import { useCallback, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData } from '../types/recipe'
import type { CalculateResponse } from '../types/api'
import { ensureRecipeDataShape, runModifierPipeline, flattenForBackend } from '../modifiers/calculate'
import { normalizeEndpointPorts } from '../utils/endpointNorm'
import { buildTopologicalNets } from '../utils/topologicalNets'

const VIRTUAL_GLOBAL_SOURCE = 'Virtual_Global_Source'
const VIRTUAL_GLOBAL_TARGET = 'Virtual_Global_Target'

function resolveIsAuto(data: Record<string, unknown> | undefined): boolean {
  if (typeof data?.mode === 'string') {
    return data.mode !== 'limit' && data.mode !== 'demand'
  }
  if (typeof data?.is_auto === 'boolean') return data.is_auto
  if (typeof data?.is_virtual === 'boolean') return data.is_virtual
  return true
}

type UseCalculationParams = {
  nodesRef: MutableRefObject<Node[]>
  edgesRef: MutableRefObject<Edge[]>
  setNodes: Dispatch<SetStateAction<Node[]>>
}

export function useCalculation({ nodesRef, edgesRef, setNodes }: UseCalculationParams) {
  const [systemInputs, setSystemInputs] = useState<Record<string, number>>({})
  const [systemOutputs, setSystemOutputs] = useState<Record<string, number>>({})
  const [lastSystemInputs, setLastSystemInputs] = useState<Record<string, number>>({})
  const [lastSystemOutputs, setLastSystemOutputs] = useState<Record<string, number>>({})
  const [globalInputIds, setGlobalInputIds] = useState<string[]>([])
  const [globalOutputIds, setGlobalOutputIds] = useState<string[]>([])
  const [capexList, setCapexList] = useState<Record<string, number>>({})

  const resetSystemStats = useCallback(() => {
    setSystemInputs({})
    setSystemOutputs({})
    setLastSystemInputs({})
    setLastSystemOutputs({})
    setGlobalInputIds([])
    setGlobalOutputIds([])
    setCapexList({})
  }, [])

  const handleCalculate = useCallback(async () => {
    const shapedRecipeByNodeId = new Map<string, RecipeNodeData>()
    const globalInputSet = new Set<string>()
    const globalOutputSet = new Set<string>()

    // ── Step 1: shape all recipe nodes, detect global ports & zero-output nodes ──
    const zeroOutputNodeNames: string[] = []

    for (const n of nodesRef.current) {
      if (n.type !== 'recipeNode') continue
      const shaped = ensureRecipeDataShape(n.data as RecipeNodeData)
      shapedRecipeByNodeId.set(n.id, shaped)

      for (const port of shaped.base_inputs ?? []) {
        if (port.routing_mode === 'global') globalInputSet.add(port.category)
      }
      for (const port of shaped.base_outputs ?? []) {
        if (port.routing_mode === 'global') globalOutputSet.add(port.category)
      }

      const rates = runModifierPipeline(shaped)
      const materialOutputs = rates.recipe_outputs.filter((r) => !r.is_utility)
      if (materialOutputs.length === 0 || materialOutputs.every((r) => r.amount === 0)) {
        zeroOutputNodeNames.push(shaped.machine_name || n.id)
      }
    }

    if (zeroOutputNodeNames.length > 0) {
      const names = zeroOutputNodeNames.join(' / ')
      alert(`Outputs of these recipe nodes are all zero:\n${names}\n(Set valid outputs or fix machine parameters.)`)
      return
    }

    // ── Step 2: filter physical (non-global) wired edges ──
    const physicalEdges = edgesRef.current.filter((e) => {
      const srcGlobal =
        e.sourceHandle
          ? (shapedRecipeByNodeId.get(e.source)?.base_outputs ?? []).some(
              (p) => p.id && `${p.category}:${p.id}` === e.sourceHandle && p.routing_mode === 'global'
            )
          : false
      const tgtGlobal =
        e.targetHandle
          ? (shapedRecipeByNodeId.get(e.target)?.base_inputs ?? []).some(
              (p) => p.id && `${p.category}:${p.id}` === e.targetHandle && p.routing_mode === 'global'
            )
          : false
      return !srcGlobal && !tgtGlobal
    })

    // ── Step 2.5: Build topological nets for sub-graph isolation ──
    const topologicalNets = buildTopologicalNets(
      nodesRef.current,
      physicalEdges,
      shapedRecipeByNodeId,
    )
    const netLookup = topologicalNets.lookup

    const translateFlattenedKeys = (
      nodeId: string,
      dict: Record<string, number>,
    ): Record<string, number> => {
      const translated: Record<string, number> = {}
      for (const [key, val] of Object.entries(dict)) {
        const netName = netLookup.get(`${nodeId}|${key}`)
        const finalKey = (netName && netName.startsWith('Net_')) ? netName : key
        translated[finalKey] = (translated[finalKey] ?? 0) + val
      }
      return translated
    }

    // ── Step 3: compile payload nodes with flattened recipe IO ──
    const portHandleToSubNodeId = new Map<string, string>()
    const namespaceAlias = new Map<string, string>()

    const payloadNodes: Array<{ id: string; type: string; data: Record<string, unknown> }> = []

    for (const n of nodesRef.current) {
      // ── Source / Target: explode multi-port into per-port sub-nodes ──
      if (n.type === 'sourceNode' || n.type === 'targetNode') {
        const ports = normalizeEndpointPorts(n.data)
        const isAuto = resolveIsAuto(n.data)
        const mode: string =
          n.data?.mode ??
          (n.type === 'sourceNode'
            ? (isAuto ? 'infinite' : 'limit')
            : (isAuto ? 'maximize' : 'demand'))

        ports.forEach((port, pi) => {
          const itemType = port.item_type ?? 'item'
          const qualifiedId = `${itemType}:${port.id}`
          const key = `${n.id}|${qualifiedId}`
          const subId = `${n.id}__p${pi}`

          const rawNetId = netLookup.get(key)
          const netId = (rawNetId && rawNetId.startsWith('Net_')) ? rawNetId : qualifiedId

          portHandleToSubNodeId.set(key, subId)
          namespaceAlias.set(netId, netId)

          payloadNodes.push({
            id: subId,
            type: n.type ?? 'sourceNode',
            data: {
              id: netId,
              amount: port.amount,
              is_auto: isAuto,
              mode,
            },
          })
        })
        continue
      }

      // ── Non-recipe nodes pass through as-is ──
      if (n.type !== 'recipeNode') {
        payloadNodes.push({ id: n.id, type: n.type ?? 'unknown', data: n.data as Record<string, unknown> })
        continue
      }

      // ── Recipe node: run 5-step pipeline, flatten for backend ──
      const shaped = shapedRecipeByNodeId.get(n.id)!
      const payload = runModifierPipeline(shaped)
      const flattened = flattenForBackend(payload)

      const translatedInputs = translateFlattenedKeys(n.id, flattened.inputs)
      const translatedOutputs = translateFlattenedKeys(n.id, flattened.outputs)

      for (const itemId of Object.keys(translatedInputs)) {
        namespaceAlias.set(itemId, itemId)
      }
      for (const itemId of Object.keys(translatedOutputs)) {
        namespaceAlias.set(itemId, itemId)
      }

      payloadNodes.push({
        id: n.id,
        type: n.type,
        data: {
          recipe_id: shaped.recipe_id,
          machine_name: shaped.machine_name,
          system: shaped.system,
          duration_ticks: 20,
          inputs: translatedInputs,
          outputs: translatedOutputs,
          mode: shaped.mode,
          is_auto: shaped.is_auto ?? true,
          manual_machines: shaped.manual_machines,
          metadata: shaped.metadata ?? {},
        },
      })
    }

    // ── Step 4: translate physical edge handles and redirect to sub-nodes ──
    const wiredEdges = physicalEdges.map((e) => {
      const srcSubId = e.sourceHandle
        ? (portHandleToSubNodeId.get(`${e.source}|${e.sourceHandle}`) ?? e.source)
        : e.source
      const tgtSubId = e.targetHandle
        ? (portHandleToSubNodeId.get(`${e.target}|${e.targetHandle}`) ?? e.target)
        : e.target

      return {
        source: srcSubId,
        target: tgtSubId,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      }
    })

    // ── Step 5: build implicit global bus edges ──
    const implicitEdges: Array<{
      source: string
      target: string
      sourceHandle: string | null | undefined
      targetHandle: string | null | undefined
    }> = []

    for (const [nodeId, shaped] of shapedRecipeByNodeId.entries()) {
      for (const port of shaped.base_inputs ?? []) {
        if (port.routing_mode !== 'global' || !port.id) continue
        const key = `${port.category}:${port.id}`
        implicitEdges.push({
          source: VIRTUAL_GLOBAL_SOURCE,
          target: nodeId,
          sourceHandle: key,
          targetHandle: key,
        })
      }
      for (const port of shaped.base_outputs ?? []) {
        if (port.routing_mode !== 'global' || !port.id) continue
        const key = `${port.category}:${port.id}`
        implicitEdges.push({
          source: nodeId,
          target: VIRTUAL_GLOBAL_TARGET,
          sourceHandle: key,
          targetHandle: key,
        })
      }
    }

    const payload = {
      nodes: payloadNodes.concat([
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
      ]),
      edges: wiredEdges.concat(implicitEdges),
    }

    setGlobalInputIds(Array.from(globalInputSet))
    setGlobalOutputIds(Array.from(globalOutputSet))

    const deduplicateSystemMap = (record: Record<string, number>) => {
      const next: Record<string, number> = {}
      for (const [key, value] of Object.entries(record)) {
        const originalId = namespaceAlias.get(key) ?? key
        next[originalId] = (next[originalId] ?? 0) + value
      }
      return next
    }

    try {
      const response = await fetch('http://localhost:8000/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const result = await response.json() as CalculateResponse

      if (result.status === 'success') {
        const nodeResults = result.node_results ?? {}
        const nextSystemInputs = deduplicateSystemMap(result.system_inputs ?? {})
        const nextSystemOutputs = deduplicateSystemMap(result.system_outputs ?? {})

        setNodes((prev) =>
          prev.map((node) => {
            let nextData = node.data
            const directNodeResult = nodeResults[node.id]
            const recipeId =
              typeof node.data?.recipe_id === 'string' ? node.data.recipe_id : null
            const nodeResult = directNodeResult ?? (recipeId ? nodeResults[recipeId] : undefined)

            if (nodeResult) nextData = { ...nextData, ...nodeResult }

            // ── Aggregate exploded sub-node results back to original endpoint nodes ──
            if (node.type === 'sourceNode') {
              const isAuto = resolveIsAuto(nextData)
              const ports = normalizeEndpointPorts(node.data)
              const actualAmounts: Record<string, number> = {}
              let totalActual = 0
              for (const port of ports) {
                const itemType = port.item_type ?? 'item'
                const qualifiedId = `${itemType}:${port.id}`
                const key = `${node.id}|${qualifiedId}`
                const subNodeId = portHandleToSubNodeId.get(key)
                if (subNodeId) {
                  const subResult = nodeResults[subNodeId]
                  const amt = typeof subResult?.actual_amount === 'number' ? subResult.actual_amount : 0
                  actualAmounts[port.id] = amt
                  totalActual += amt
                }
              }
              nextData = {
                ...nextData,
                is_auto: isAuto,
                actual_amount: totalActual,
                actual_amounts: actualAmounts,
              }
            }

            if (node.type === 'targetNode') {
              const isAuto = resolveIsAuto(nextData)
              const ports = normalizeEndpointPorts(node.data)
              const actualAmounts: Record<string, number> = {}
              let totalActual = 0
              for (const port of ports) {
                const itemType = port.item_type ?? 'item'
                const qualifiedId = `${itemType}:${port.id}`
                const key = `${node.id}|${qualifiedId}`
                const subNodeId = portHandleToSubNodeId.get(key)
                if (subNodeId) {
                  const subResult = nodeResults[subNodeId]
                  const amt = typeof subResult?.actual_amount === 'number' ? subResult.actual_amount : 0
                  actualAmounts[port.id] = amt
                  totalActual += amt
                }
              }
              nextData = {
                ...nextData,
                is_auto: isAuto,
                actual_amount: totalActual,
                actual_amounts: actualAmounts,
              }
            }

            if (node.type === 'recipeNode') {
              nextData = { ...nextData, is_auto: resolveIsAuto(nextData) }
            }

            if (nextData === node.data) return node
            return { ...node, data: nextData }
          })
        )

        setSystemInputs(nextSystemInputs)
        setSystemOutputs(nextSystemOutputs)
        setLastSystemInputs(nextSystemInputs)
        setLastSystemOutputs(nextSystemOutputs)

        // ── CapEx: compute shopping list from consumable:false resources ──
        const capexMap: Record<string, number> = {}
        for (const [nodeId, shaped] of shapedRecipeByNodeId) {
          const nodeResult = nodeResults[nodeId] ?? nodeResults[shaped.recipe_id]
          const machines = nodeResult?.machines_actual ?? nodeResult?.machines_exact ?? 0
          if (machines <= 0) continue
          const allRes = [...(shaped.base_inputs ?? []), ...(shaped.base_outputs ?? [])]
          for (const r of allRes) {
            if (r.consumable !== false && r.consumable_probability !== 0 || !r.id) continue
            const key = `${r.category}:${r.id}`
            capexMap[key] = (capexMap[key] ?? 0) + r.amount * machines
          }
        }
        setCapexList(capexMap)
      } else if (result.status === 'unbounded') {
        setSystemInputs({})
        setSystemOutputs({})
        setGlobalInputIds([])
        setGlobalOutputIds([])
        alert('Unbounded: Found "Maximize" nodes, but no physical bottleneck. Set a machine cap or source limit upstream.')
      } else if (result.status === 'infeasible') {
        setSystemInputs({})
        setSystemOutputs({})
        setGlobalInputIds([])
        setGlobalOutputIds([])
        alert('Infeasible: Check for conflicting constraints or missing input sources.')
      } else {
        setSystemInputs({})
        setSystemOutputs({})
        setGlobalInputIds([])
        setGlobalOutputIds([])
        alert('Calculation failed. Please try again later.')
      }
    } catch (error) {
      console.error('calculate failed', error)
      setSystemInputs({})
      setSystemOutputs({})
      setGlobalInputIds([])
      setGlobalOutputIds([])
      alert('Cannot connect to backend. Please confirm the backend is running.')
    }
  }, [nodesRef, edgesRef, setNodes])

  return {
    systemInputs,
    systemOutputs,
    lastSystemInputs,
    lastSystemOutputs,
    setSystemInputs,
    setSystemOutputs,
    setLastSystemInputs,
    setLastSystemOutputs,
    globalInputIds,
    globalOutputIds,
    capexList,
    resetSystemStats,
    handleCalculate,
  }
}
