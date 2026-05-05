import { useCallback, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData } from '../types/recipe'
import type { CalculateResponse } from '../types/api'
import { ensureRecipeDataShape, getCalculatedRates, toLegacyPort, normalizePayloadResources } from '../modifiers/calculate'
import { buildTopologicalNets, translatePortIds } from '../utils/topologicalNets'
import { normalizeEndpointPorts } from '../utils/endpointNorm'

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

  const resetSystemStats = useCallback(() => {
    setSystemInputs({})
    setSystemOutputs({})
    setLastSystemInputs({})
    setLastSystemOutputs({})
    setGlobalInputIds([])
    setGlobalOutputIds([])
  }, [])

  const handleCalculate = useCallback(async () => {
    const shapedRecipeByNodeId = new Map<string, RecipeNodeData>()
    const globalInputSet = new Set<string>()
    const globalOutputSet = new Set<string>()

    // ── Step 1: shape all recipe nodes so we know routing_mode per port ──────
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

      const rates = getCalculatedRates(shaped)
      const materialOutputs = rates.transformedOutputs.filter((r) => !r.is_utility)
      if (materialOutputs.length === 0 || materialOutputs.every((r) => r.amount === 0)) {
        zeroOutputNodeNames.push(shaped.machine_name || n.id)
      }
    }

    if (zeroOutputNodeNames.length > 0) {
      const names = zeroOutputNodeNames.join('、')
      alert(`⚠️ 以下配方节点的输出全部为 0，请先配置有效的输出资源：\n${names}`)
      return
    }

    // ── Step 2: build topological net table (Task 1) ─────────────────────────
    // Only pass wired edges to the net compiler; global ports never appear in
    // physical edges, so filtering is straightforward.
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

    const { lookup: netLookup } = buildTopologicalNets(
      nodesRef.current,
      physicalEdges,
      shapedRecipeByNodeId
    )

    // Build translated-id -> qualified-id alias map so HUD totals can merge
    // namespaced keys (Net_/Global_/Void_) back into the same resource bucket.
    const namespaceAlias = new Map<string, string>()
    for (const n of nodesRef.current) {
      if (n.type === 'recipeNode') {
        const shaped = shapedRecipeByNodeId.get(n.id)
        if (!shaped) continue
        for (const port of shaped.base_inputs ?? []) {
          if (!port.id) continue
          const qualifiedId = `${port.category}:${port.id}`
          const translated = netLookup.get(`${n.id}|${qualifiedId}`) ?? `Void_${n.id}_${qualifiedId}`
          namespaceAlias.set(translated, qualifiedId)
        }
        for (const port of shaped.base_outputs ?? []) {
          if (!port.id) continue
          const qualifiedId = `${port.category}:${port.id}`
          const translated = netLookup.get(`${n.id}|${qualifiedId}`) ?? `Void_${n.id}_${qualifiedId}`
          namespaceAlias.set(translated, qualifiedId)
        }
        continue
      }

      if (n.type === 'sourceNode' || n.type === 'targetNode') {
        const ports = normalizeEndpointPorts(n.data)
        for (const port of ports) {
          if (!port.id) continue
          const itemType = port.item_type ?? 'item'
          const qualifiedId = `${itemType}:${port.id}`
          const translated = netLookup.get(`${n.id}|${qualifiedId}`) ?? `Void_${n.id}_${qualifiedId}`
          namespaceAlias.set(translated, qualifiedId)
        }
      }
    }

    // ── Step 3: compile payload nodes with translated port IDs (Task 2) ──────
    // Multi-port SourceNode/TargetNode are exploded into N single-port nodes
    // so the backend's simple LP model can handle them independently.
    const subNodeToOriginalId = new Map<string, string>() // subId → originalNodeId
    const portHandleToSubNodeId = new Map<string, string>() // "origNodeId|handleId" → subId

    const payloadNodes: Array<{ id: string; type: string; data: Record<string, unknown> }> = []
    for (const n of nodesRef.current) {
      if (n.type === 'sourceNode' || n.type === 'targetNode') {
        const ports = normalizeEndpointPorts(n.data)
        const isAuto = resolveIsAuto(n.data)
        const mode: string = n.data?.mode ?? (n.type === 'sourceNode' ? (isAuto ? 'infinite' : 'limit') : (isAuto ? 'maximize' : 'demand'))

        ports.forEach((port, pi) => {
          const itemType = port.item_type ?? 'item'
          const qualifiedId = `${itemType}:${port.id}`
          const key = `${n.id}|${qualifiedId}`
          const netName = netLookup.get(key) ?? qualifiedId
          const subId = `${n.id}__p${pi}`

          subNodeToOriginalId.set(subId, n.id)
           portHandleToSubNodeId.set(key, subId)

          payloadNodes.push({
             id: subId,
             type: n.type ?? 'sourceNode',
             data: {
               id: netName,
               amount: port.amount,
               is_auto: isAuto,
               mode,
             },
           })
        })
        continue
      }

      if (n.type !== 'recipeNode') {
        payloadNodes.push({ id: n.id, type: n.type ?? 'unknown', data: n.data as Record<string, unknown> })
        continue
      }

      const shaped = shapedRecipeByNodeId.get(n.id)!
      const calculated = getCalculatedRates(shaped)

      const normInputs = normalizePayloadResources(calculated.inputRates)
      const normOutputs = normalizePayloadResources(calculated.outputRates)

      const rawInputs = normInputs.map(toLegacyPort)
      const rawOutputs = normOutputs.map(toLegacyPort)

      payloadNodes.push({
        id: n.id,
        type: n.type,
        data: {
          ...shaped,
          inputs: translatePortIds(rawInputs, n.id, netLookup),
          outputs: translatePortIds(rawOutputs, n.id, netLookup),
          duration_ticks: 20,
        },
      })
    }

    // ── Step 4: build wired edges with translated handle IDs (Task 3) ─────────
    // Redirect edge source/target to exploded sub-node IDs when applicable.
    const wiredEdges = physicalEdges.map((e) => {
      const srcNetName = e.sourceHandle
        ? (netLookup.get(`${e.source}|${e.sourceHandle}`) ?? e.sourceHandle)
        : e.sourceHandle
      const tgtNetName = e.targetHandle
        ? (netLookup.get(`${e.target}|${e.targetHandle}`) ?? e.targetHandle)
        : e.targetHandle

      // Redirect to sub-node ID if the source/target was exploded
      const srcSubId = e.sourceHandle
        ? (portHandleToSubNodeId.get(`${e.source}|${e.sourceHandle}`) ?? e.source)
        : e.source
      const tgtSubId = e.targetHandle
        ? (portHandleToSubNodeId.get(`${e.target}|${e.targetHandle}`) ?? e.target)
        : e.target

      return {
        source: srcSubId,
        target: tgtSubId,
        sourceHandle: srcNetName,
        targetHandle: tgtNetName,
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
        const globalNet = `Global_${port.category}`
        implicitEdges.push({
          source: VIRTUAL_GLOBAL_SOURCE,
          target: nodeId,
          sourceHandle: globalNet,
          targetHandle: globalNet,
        })
      }
      for (const port of shaped.base_outputs ?? []) {
        if (port.routing_mode !== 'global' || !port.id) continue
        const globalNet = `Global_${port.category}`
        implicitEdges.push({
          source: nodeId,
          target: VIRTUAL_GLOBAL_TARGET,
          sourceHandle: globalNet,
          targetHandle: globalNet,
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

    const stripVirtualKeys = (record: Record<string, number>) => {
      const next: Record<string, number> = {}
      for (const [key, value] of Object.entries(record)) {
        if (key.startsWith(VIRTUAL_GLOBAL_SOURCE) || key.startsWith(VIRTUAL_GLOBAL_TARGET)) continue
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
        const nextSystemInputs = stripVirtualKeys(result.system_inputs ?? {})
        const nextSystemOutputs = stripVirtualKeys(result.system_outputs ?? {})

        setNodes((prev) => prev.map((node) => {
          let nextData = node.data
          const directNodeResult = nodeResults[node.id]
          const recipeId = typeof node.data?.recipe_id === 'string' ? node.data.recipe_id : null
          const nodeResult = directNodeResult ?? (recipeId ? nodeResults[recipeId] : undefined)

          if (nodeResult) nextData = { ...nextData, ...nodeResult }

          if (node.type === 'sourceNode') {
            const isAuto = resolveIsAuto(nextData)
            // Aggregate exploded sub-node results → per-port actual_amounts
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
        }))

        setSystemInputs(nextSystemInputs)
        setSystemOutputs(nextSystemOutputs)
        setLastSystemInputs(nextSystemInputs)
        setLastSystemOutputs(nextSystemOutputs)
      } else if (result.status === 'unbounded') {
        setSystemInputs({})
        setSystemOutputs({})
        setGlobalInputIds([])
        setGlobalOutputIds([])
        alert('⚠️ 产线无界：发现"最大化产出"节点，但产线缺乏物理瓶颈。请为任意上游配方节点或输入源设定"产能上限"！')
      } else if (result.status === 'infeasible') {
        setSystemInputs({})
        setSystemOutputs({})
        setGlobalInputIds([])
        setGlobalOutputIds([])
        alert('产线无解，请检查是否有冲突的边界条件或缺少输入源')
      } else {
        setSystemInputs({})
        setSystemOutputs({})
        setGlobalInputIds([])
        setGlobalOutputIds([])
        alert('计算失败，请稍后再试')
      }
    } catch (error) {
      console.error('calculate failed', error)
      setSystemInputs({})
      setSystemOutputs({})
      setGlobalInputIds([])
      setGlobalOutputIds([])
      alert('无法连接后端，请确认服务已启动')
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
    resetSystemStats,
    handleCalculate,
  }
}
